'use client';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from 'next-themes';
import React from 'react';
import { ActiveThemeProvider } from '../active-theme';
import { QueryProvider } from '../providers/query-provider';

export default function Providers({
  activeThemeValue,
  isAuthConfigured,
  children
}: {
  activeThemeValue: string;
  isAuthConfigured: boolean;
  children: React.ReactNode;
}) {
  // we need the resolvedTheme value to set the baseTheme for clerk based on the dark or light theme
  const { resolvedTheme } = useTheme();

  return (
    <>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        {isAuthConfigured ? (
          <ClerkProvider
            appearance={{
              baseTheme: resolvedTheme === 'dark' ? dark : undefined
            }}
          >
            <QueryProvider>{children}</QueryProvider>
          </ClerkProvider>
        ) : (
          <QueryProvider>{children}</QueryProvider>
        )}
      </ActiveThemeProvider>
    </>
  );
}
