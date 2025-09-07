import axios from "axios";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies, createAuthHeader } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string; worklogId: string }> },
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const auth = getAuthFromCookies(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const authHeader = createAuthHeader(auth);

    const response = await axios.put(
      `${auth.apiUrl}/issue/${resolvedParams.issueKey}/worklog/${resolvedParams.worklogId}`,
      body,
      {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("JIRA API Error:", error.response?.data || error.message);
    return NextResponse.json(
      {
        error: "Failed to update worklog in JIRA API",
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string; worklogId: string }> },
) {
  try {
    const resolvedParams = await params;
    const auth = getAuthFromCookies(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const authHeader = createAuthHeader(auth);

    await axios.delete(
      `${auth.apiUrl}/issue/${resolvedParams.issueKey}/worklog/${resolvedParams.worklogId}`,
      {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("JIRA API Error:", error.response?.data || error.message);
    return NextResponse.json(
      {
        error: "Failed to delete worklog from JIRA API",
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}
