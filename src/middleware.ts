import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if accessing protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    // Check for authentication cookies
    const email = request.cookies.get('jira-email')?.value;
    const token = request.cookies.get('jira-token')?.value;
    const siteUrl = request.cookies.get('jira-site-url')?.value;

    // If not authenticated, redirect to login
    if (!email || !token || !siteUrl) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // If accessing login page while authenticated, redirect to dashboard
  if (request.nextUrl.pathname === '/login') {
    const email = request.cookies.get('jira-email')?.value;
    const token = request.cookies.get('jira-token')?.value;
    const siteUrl = request.cookies.get('jira-site-url')?.value;

    if (email && token && siteUrl) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login']
};