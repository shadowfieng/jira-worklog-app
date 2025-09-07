import { type NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = getAuthFromCookies(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  return NextResponse.json({ siteUrl: auth.siteUrl });
}
