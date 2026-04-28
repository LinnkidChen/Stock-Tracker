import type { APIErrorCode, APIResponse } from '@/lib/types/stock-api';

export class StockApiResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: APIErrorCode
  ) {
    super(message);
    this.name = 'StockApiResponseError';
  }
}

export async function readStockApiResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  let payload: APIResponse<T> | null = null;

  try {
    payload = (await response.json()) as APIResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success || !payload.data) {
    throw new StockApiResponseError(
      payload?.error?.message || fallbackMessage,
      response.status,
      payload?.error?.code
    );
  }

  return payload.data;
}

export function isLongbridgeCredentialError(error: unknown): boolean {
  return (
    error instanceof StockApiResponseError && error.code === 'INVALID_API_KEY'
  );
}
