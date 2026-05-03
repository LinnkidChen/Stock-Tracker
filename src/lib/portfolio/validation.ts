import { normalizeTicker, validateTicker } from '@/lib/validation/ticker';
import type {
  PortfolioHoldingInput,
  PortfolioTransactionInput,
  PortfolioTransactionType
} from '@/types/portfolio';

export interface PortfolioHoldingRequestBody {
  symbol?: unknown;
  quantity?: unknown;
  avgCost?: unknown;
}

export interface PortfolioTransactionRequestBody {
  symbol?: unknown;
  type?: unknown;
  quantity?: unknown;
  price?: unknown;
  amount?: unknown;
  fee?: unknown;
  splitRatioFrom?: unknown;
  splitRatioTo?: unknown;
  occurredAt?: unknown;
  note?: unknown;
}

export type PortfolioHoldingValidationResult =
  | { ok: true; input: PortfolioHoldingInput }
  | { ok: true; input: Partial<PortfolioHoldingInput> }
  | { ok: false; message: string };

export type PortfolioTransactionValidationResult =
  | { ok: true; input: PortfolioTransactionInput }
  | { ok: false; message: string };

const TRANSACTION_TYPES = [
  'buy',
  'sell',
  'dividend',
  'split',
  'fee',
  'transfer'
] as const;

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

function parseTransactionType(
  value: unknown
):
  | { ok: true; value: PortfolioTransactionType }
  | { ok: false; message: string } {
  if (typeof value !== 'string') {
    return { ok: false, message: 'Transaction type is required' };
  }

  const normalized = value.toLowerCase();
  if (!TRANSACTION_TYPES.includes(normalized as PortfolioTransactionType)) {
    return { ok: false, message: 'Invalid transaction type' };
  }

  return { ok: true, value: normalized as PortfolioTransactionType };
}

function parseOptionalNote(
  value: unknown
): { ok: true; value?: string | null } | { ok: false; message: string } {
  if (value === undefined) {
    return { ok: true };
  }
  if (value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, message: 'note must be a string' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > 500) {
    return { ok: false, message: 'note must be 500 characters or less' };
  }

  return { ok: true, value: trimmed };
}

function parseOptionalDate(
  value: unknown
): { ok: true; value?: string } | { ok: false; message: string } {
  if (isMissing(value)) {
    return { ok: true };
  }
  if (typeof value !== 'string') {
    return { ok: false, message: 'occurredAt must be an ISO date string' };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: 'occurredAt must be a valid date' };
  }

  return { ok: true, value: date.toISOString() };
}

function parseFiniteNumber(
  value: unknown,
  fieldName: string,
  required: boolean
): { ok: true; value?: number } | { ok: false; message: string } {
  if (isMissing(value)) {
    if (required) {
      return { ok: false, message: `${fieldName} is required` };
    }

    return { ok: true };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: `${fieldName} must be a finite number` };
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

export function validatePortfolioTransactionBody(
  body: PortfolioTransactionRequestBody
): PortfolioTransactionValidationResult {
  if (typeof body.symbol !== 'string') {
    return { ok: false, message: 'Ticker symbol is required' };
  }

  const tickerValidation = validateTicker(body.symbol);
  if (!tickerValidation.isValid) {
    return {
      ok: false,
      message: tickerValidation.error || 'Invalid ticker symbol'
    };
  }

  const type = parseTransactionType(body.type);
  if (!type.ok) {
    return type;
  }

  const input: PortfolioTransactionInput = {
    symbol: normalizeTicker(body.symbol),
    type: type.value
  };

  const occurredAt = parseOptionalDate(body.occurredAt);
  if (!occurredAt.ok) {
    return occurredAt;
  }
  if (occurredAt.value !== undefined) {
    input.occurredAt = occurredAt.value;
  }

  const note = parseOptionalNote(body.note);
  if (!note.ok) {
    return note;
  }
  if (note.value !== undefined) {
    input.note = note.value;
  }

  const fee = parseNumberField(body.fee, 'fee', {
    required: false,
    min: 0,
    minMessage: 'fee must be greater than or equal to 0'
  });
  if (!fee.ok) {
    return fee;
  }
  if (fee.value !== undefined) {
    input.fee = fee.value;
  }

  if (type.value === 'buy' || type.value === 'sell') {
    const quantity = parseNumberField(body.quantity, 'quantity', {
      required: true,
      min: Number.MIN_VALUE,
      minMessage: 'quantity must be greater than 0'
    });
    if (!quantity.ok) {
      return quantity;
    }

    const price = parseNumberField(body.price, 'price', {
      required: true,
      min: 0,
      minMessage: 'price must be greater than or equal to 0'
    });
    if (!price.ok) {
      return price;
    }

    input.quantity = quantity.value;
    input.price = price.value;
    return { ok: true, input };
  }

  if (type.value === 'transfer') {
    const quantity = parseFiniteNumber(body.quantity, 'quantity', true);
    if (!quantity.ok) {
      return quantity;
    }
    if (quantity.value === 0) {
      return { ok: false, message: 'quantity must not be 0 for transfer' };
    }

    const price = parseNumberField(body.price, 'price', {
      required: true,
      min: 0,
      minMessage: 'price must be greater than or equal to 0'
    });
    if (!price.ok) {
      return price;
    }

    input.quantity = quantity.value;
    input.price = price.value;
    return { ok: true, input };
  }

  if (type.value === 'dividend' || type.value === 'fee') {
    const amount = parseNumberField(body.amount, 'amount', {
      required: true,
      min: Number.MIN_VALUE,
      minMessage: 'amount must be greater than 0'
    });
    if (!amount.ok) {
      return amount;
    }

    input.amount = amount.value;
    return { ok: true, input };
  }

  const splitRatioFrom = parseNumberField(
    body.splitRatioFrom,
    'splitRatioFrom',
    {
      required: true,
      min: Number.MIN_VALUE,
      minMessage: 'splitRatioFrom must be greater than 0'
    }
  );
  if (!splitRatioFrom.ok) {
    return splitRatioFrom;
  }

  const splitRatioTo = parseNumberField(body.splitRatioTo, 'splitRatioTo', {
    required: true,
    min: Number.MIN_VALUE,
    minMessage: 'splitRatioTo must be greater than 0'
  });
  if (!splitRatioTo.ok) {
    return splitRatioTo;
  }

  input.splitRatioFrom = splitRatioFrom.value;
  input.splitRatioTo = splitRatioTo.value;

  return { ok: true, input };
}
