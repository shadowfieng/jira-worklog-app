import axios from "axios";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, apiToken, siteUrl } = body;

    if (!email || !apiToken || !siteUrl) {
      return NextResponse.json(
        { error: "Email, API token, and site URL are required" },
        { status: 400 },
      );
    }

    // Validate credentials by attempting to fetch user info
    const jiraApiUrl = `${siteUrl}/rest/api/3`;
    const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;

    try {
      const response = await axios.get(`${jiraApiUrl}/myself`, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      // If successful, create response with httpOnly cookies
      const loginResponse = NextResponse.json({
        success: true,
        user: response.data,
      });

      // Set httpOnly cookies with authentication data
      loginResponse.cookies.set("jira-email", email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      loginResponse.cookies.set("jira-token", apiToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      loginResponse.cookies.set("jira-site-url", siteUrl, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      return loginResponse;
    } catch (jiraError: any) {
      console.error(
        "JIRA validation error:",
        jiraError.response?.data || jiraError.message,
      );
      return NextResponse.json(
        {
          error: "Invalid JIRA credentials or site URL",
          details: jiraError.response?.data?.errorMessages || [
            "Authentication failed",
          ],
        },
        { status: 401 },
      );
    }
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
