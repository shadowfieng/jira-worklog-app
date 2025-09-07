import { type NextRequest } from "next/server";

export interface JiraAuth {
  email: string;
  token: string;
  siteUrl: string;
  apiUrl: string;
}

export function getAuthFromCookies(request: NextRequest): JiraAuth | null {
  const email = request.cookies.get('jira-email')?.value;
  const token = request.cookies.get('jira-token')?.value;
  const siteUrl = request.cookies.get('jira-site-url')?.value;

  if (!email || !token || !siteUrl) {
    return null;
  }

  return {
    email,
    token,
    siteUrl,
    apiUrl: `${siteUrl}/rest/api/3`,
  };
}

export function createAuthHeader(auth: JiraAuth): string {
  return `Basic ${Buffer.from(`${auth.email}:${auth.token}`).toString("base64")}`;
}