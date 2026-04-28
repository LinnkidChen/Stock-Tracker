import { NextResponse } from 'next/server';

function derivedHoldingsResponse() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'PORTFOLIO_HOLDINGS_DERIVED',
        message: 'Portfolio holdings are derived from transactions'
      }
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return derivedHoldingsResponse();
}

export async function DELETE() {
  return derivedHoldingsResponse();
}
