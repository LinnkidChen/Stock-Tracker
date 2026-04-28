import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

const clerkAuthMiddleware = clerkMiddleware(async (auth, req: NextRequest) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (
    process.env.E2E_AUTH_BYPASS === 'true' &&
    req.nextUrl.pathname.startsWith('/e2e-')
  ) {
    return NextResponse.next();
  }

  return clerkAuthMiddleware(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
