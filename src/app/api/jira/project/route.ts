import axios from "axios";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies, createAuthHeader } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = getAuthFromCookies(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const authHeader = createAuthHeader(auth);

    const response = await axios.get(`${auth.apiUrl}/project`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      params: Object.fromEntries(searchParams.entries()),
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("JIRA API Error:", error.response?.data || error.message);
    return NextResponse.json(
      {
        error: "Failed to fetch projects from JIRA API",
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}
