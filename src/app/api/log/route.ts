import { NextResponse } from 'next/server';

type LogRequestBody = Record<string, unknown> & {
  timestamp?: unknown;
  level?: unknown;
  message?: unknown;
  stack?: unknown;
};

function isLogRequestBody(value: unknown): value is LogRequestBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyLogValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value) ?? String(value);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const body: unknown = await request.json();

  if (!isLogRequestBody(body)) {
    return NextResponse.json({ error: 'Invalid log payload' }, { status: 400 });
  }

  const { timestamp, level, message, stack, ...context } = body;
  const logLevel = stringifyLogValue(level).toUpperCase();
  const logMessage = stringifyLogValue(message);
  const stackText = stringifyLogValue(stack);

  const logLine = `[${stringifyLogValue(timestamp)}] [${logLevel}] ${logMessage}
File/Line: ${stackText ? stackText.split('\n')[1]?.trim() : 'N/A'}
Context: ${JSON.stringify(context)}
Stack: ${stackText}
----------------------------------------
`;

  // eslint-disable-next-line no-console
  console.warn(logLine);

  return NextResponse.json({ success: true });
}
