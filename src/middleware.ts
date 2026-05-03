import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);
const hasClerkCredentials = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
    process.env.CLERK_SECRET_KEY?.trim()
);

const clerkAuthMiddleware = hasClerkCredentials
  ? clerkMiddleware(async (auth, req: NextRequest) => {
      if (isProtectedRoute(req)) await auth.protect();
    })
  : undefined;

function setupRequiredMiddleware(req: NextRequest) {
  if (isProtectedRoute(req)) {
    return NextResponse.redirect(new URL('/auth/sign-in', req.url));
  }

  return NextResponse.next();
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (
    process.env.E2E_AUTH_BYPASS === 'true' &&
    req.nextUrl.pathname.startsWith('/e2e-')
  ) {
    return NextResponse.next();
  }

  return clerkAuthMiddleware
    ? clerkAuthMiddleware(req, event)
    : setupRequiredMiddleware(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
