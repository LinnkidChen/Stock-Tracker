import { normalizeTicker, validateTicker } from '@/lib/validation/ticker';
import type { PortfolioHoldingInput } from '@/types/portfolio';

export interface PortfolioHoldingRequestBody {
  symbol?: unknown;
  quantity?: unknown;
  avgCost?: unknown;
}

export type PortfolioHoldingValidationResult =
  | { ok: true; input: PortfolioHoldingInput }
  | { ok: true; input: Partial<PortfolioHoldingInput> }
  | { ok: false; message: string };

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function parseNumberField(
  value: unknown,
  fieldName: string,
  options: { required: boolean; min: number; minMessage: string }
): { ok: true; value?: number } | { ok: false; message: string } {
  if (isMissing(value)) {
    if (options.required) {
      return { ok: false, message: `${fieldName} is required` };
    }

    return { ok: true };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: `${fieldName} must be a finite number` };
  }

  if (parsed < options.min || (options.min === 0 && fieldName === 'quantity')) {
    return { ok: false, message: options.minMessage };
  }

  return { ok: true, value: parsed };
}

export function validatePortfolioHoldingBody(
  body: PortfolioHoldingRequestBody,
  options: { partial: false }
): { ok: true; input: PortfolioHoldingInput } | { ok: false; message: string };
export function validatePortfolioHoldingBody(
  body: PortfolioHoldingRequestBody,
  options: { partial: true }
):
  | { ok: true; input: Partial<PortfolioHoldingInput> }
  | { ok: false; message: string };
export function validatePortfolioHoldingBody(
  body: PortfolioHoldingRequestBody,
  options: { partial: boolean }
): PortfolioHoldingValidationResult {
  const input: Partial<PortfolioHoldingInput> = {};

  if (!options.partial || !isMissing(body.symbol)) {
    if (typeof body.symbol !== 'string') {
      return { ok: false, message: 'Ticker symbol is required' };
    }

    const validation = validateTicker(body.symbol);
    if (!validation.isValid) {
      return {
        ok: false,
        message: validation.error || 'Invalid ticker symbol'
      };
    }

    input.symbol = normalizeTicker(body.symbol);
  }

  const quantity = parseNumberField(body.quantity, 'quantity', {
    required: !options.partial,
    min: Number.MIN_VALUE,
    minMessage: 'quantity must be greater than 0'
  });
  if (!quantity.ok) {
    return quantity;
  }
  if (quantity.value !== undefined) {
    input.quantity = quantity.value;
  }

  const avgCost = parseNumberField(body.avgCost, 'avgCost', {
    required: !options.partial,
    min: 0,
    minMessage: 'avgCost must be greater than or equal to 0'
  });
  if (!avgCost.ok) {
    return avgCost;
  }
  if (avgCost.value !== undefined) {
    input.avgCost = avgCost.value;
  }

  if (options.partial && Object.keys(input).length === 0) {
    return { ok: false, message: 'At least one field is required' };
  }

  return {
    ok: true,
    input: input as PortfolioHoldingInput
  };
}
