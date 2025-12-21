import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const body = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { timestamp, level, message, stack, ...context } = body;

  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}
File/Line: ${stack ? stack.split('\n')[1]?.trim() : 'N/A'}
Context: ${JSON.stringify(context)}
Stack: ${stack}
----------------------------------------
`;

  const logFilePath = path.join(process.cwd(), 'error.log');
  fs.appendFileSync(logFilePath, logLine);

  return NextResponse.json({ success: true });
}
