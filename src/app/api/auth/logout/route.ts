import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Clear all authentication cookies
  response.cookies.delete("jira-email");
  response.cookies.delete("jira-token");
  response.cookies.delete("jira-site-url");

  return response;
}
