import axios from "axios";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies, createAuthHeader } from "@/lib/auth";

// Add request tracking to prevent infinite loops
const requestTracker = new Map<string, number>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> },
) {
  const resolvedParams = await params;
  const issueKey = resolvedParams.issueKey;

  // Prevent too many requests to the same issue in a short time
  const now = Date.now();
  const lastRequest = requestTracker.get(issueKey) || 0;

  if (now - lastRequest < 1000) {
    // 1 second cooldown per issue
    console.warn(`Rate limiting worklog requests for issue ${issueKey}`);
    return NextResponse.json(
      { error: "Rate limit exceeded for this issue" },
      { status: 429 },
    );
  }

  requestTracker.set(issueKey, now);

  try {
    const auth = getAuthFromCookies(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const authHeader = createAuthHeader(auth);

    console.log(`Fetching worklogs for issue: ${issueKey}`);

    const response = await axios.get(
      `${auth.apiUrl}/issue/${issueKey}/worklog`,
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
    console.error(
      `JIRA API Error for issue ${issueKey}:`,
      error.response?.data || error.message,
    );
    return NextResponse.json(
      {
        error: "Failed to fetch worklog from JIRA API",
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> },
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

    const response = await axios.post(
      `${auth.apiUrl}/issue/${resolvedParams.issueKey}/worklog`,
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
        error: "Failed to create worklog in JIRA API",
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}
