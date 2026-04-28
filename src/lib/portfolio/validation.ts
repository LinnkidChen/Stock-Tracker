import { normalizeTicker, validateTicker } from '@/lib/validation/ticker';
import type {
  PortfolioCurrency,
  PortfolioTransactionInput,
  PortfolioTransactionType
} from '@/types/portfolio';

export interface PortfolioTransactionRequestBody {
  type?: unknown;
  symbol?: unknown;
  quantity?: unknown;
  price?: unknown;
  amount?: unknown;
  feeAmount?: unknown;
  currency?: unknown;
  transactionDate?: unknown;
  note?: unknown;
}

export type PortfolioTransactionValidationResult =
  | { ok: true; input: PortfolioTransactionInput }
  | { ok: false; message: string };

export type PortfolioTransactionPatchValidationResult =
  | { ok: true; input: Partial<PortfolioTransactionInput> }
  | { ok: false; message: string };

const TRANSACTION_TYPES: PortfolioTransactionType[] = [
  'opening_balance',
  'buy',
  'sell',
  'dividend',
  'deposit',
  'withdrawal',
  'fee'
];

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function isTransactionType(value: unknown): value is PortfolioTransactionType {
  return typeof value === 'string' && TRANSACTION_TYPES.includes(value as any);
}

function parseNullableNumber(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    min: number;
    minMessage: string;
    allowZero?: boolean;
  }
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (isMissing(value)) {
    if (options.required) {
      return { ok: false, message: `${fieldName} is required` };
    }

    return { ok: true, value: null };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: `${fieldName} must be a finite number` };
  }

  if (
    parsed < options.min ||
    (!options.allowZero && options.min === 0 && parsed === 0)
  ) {
    return { ok: false, message: options.minMessage };
  }

  return { ok: true, value: parsed };
}

function parseNonNegativeNumber(
  value: unknown,
  fieldName: string
): { ok: true; value: number } | { ok: false; message: string } {
  if (isMissing(value)) return { ok: true, value: 0 };

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: `${fieldName} must be a finite number` };
  }
  if (parsed < 0) {
    return {
      ok: false,
      message: `${fieldName} must be greater than or equal to 0`
    };
  }

  return { ok: true, value: parsed };
}

function parseSymbol(
  value: unknown,
  options: { required: boolean }
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (isMissing(value)) {
    if (options.required) {
      return { ok: false, message: 'Ticker symbol is required' };
    }

    return { ok: true, value: null };
  }

  if (typeof value !== 'string') {
    return { ok: false, message: 'Ticker symbol is required' };
  }

  const validation = validateTicker(value);
  if (!validation.isValid) {
    return {
      ok: false,
      message: validation.error || 'Invalid ticker symbol'
    };
  }

  return { ok: true, value: normalizeTicker(value) };
}

function parseCurrency(value: unknown): PortfolioCurrency | null {
  if (isMissing(value)) return 'USD';
  if (value === 'USD') return 'USD';
  return null;
}

function parseTransactionDate(value: unknown): string | null {
  if (isMissing(value)) return new Date().toISOString();
  if (typeof value !== 'string') return null;

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;

  return new Date(timestamp).toISOString();
}

function parseNote(value: unknown): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return false;

  return trimmed;
}

export function normalizePortfolioTransactionInput(
  input: PortfolioTransactionInput
): PortfolioTransactionValidationResult {
  const type = input.type;
  const currency = parseCurrency(input.currency);
  if (!currency) {
    return { ok: false, message: 'currency must be USD' };
  }

  const note = parseNote(input.note);
  if (note === false) {
    return { ok: false, message: 'Note must be 500 characters or less' };
  }

  const transactionDate = parseTransactionDate(input.transactionDate);
  if (!transactionDate) {
    return { ok: false, message: 'transactionDate must be a valid date' };
  }

  if (type === 'opening_balance' || type === 'buy' || type === 'sell') {
    const symbol = parseSymbol(input.symbol, { required: true });
    if (!symbol.ok) return symbol;

    const quantity = parseNullableNumber(input.quantity, 'quantity', {
      required: true,
      min: 0,
      minMessage: 'quantity must be greater than 0'
    });
    if (!quantity.ok) return quantity;

    const price = parseNullableNumber(input.price, 'price', {
      required: true,
      min: 0,
      minMessage: 'price must be greater than or equal to 0',
      allowZero: true
    });
    if (!price.ok) return price;

    const feeAmount = parseNonNegativeNumber(input.feeAmount, 'feeAmount');
    if (!feeAmount.ok) return feeAmount;

    return {
      ok: true,
      input: {
        type,
        symbol: symbol.value,
        quantity: quantity.value,
        price: price.value,
        amount: null,
        feeAmount: feeAmount.value,
        currency,
        transactionDate,
        note
      }
    };
  }

  if (type === 'dividend') {
    const symbol = parseSymbol(input.symbol, { required: true });
    if (!symbol.ok) return symbol;

    const amount = parseNullableNumber(input.amount, 'amount', {
      required: true,
      min: 0,
      minMessage: 'amount must be greater than 0'
    });
    if (!amount.ok) return amount;

    return {
      ok: true,
      input: {
        type,
        symbol: symbol.value,
        quantity: null,
        price: null,
        amount: amount.value,
        feeAmount: 0,
        currency,
        transactionDate,
        note
      }
    };
  }

  const amount = parseNullableNumber(input.amount, 'amount', {
    required: true,
    min: 0,
    minMessage: 'amount must be greater than 0'
  });
  if (!amount.ok) return amount;

  return {
    ok: true,
    input: {
      type,
      symbol: null,
      quantity: null,
      price: null,
      amount: amount.value,
      feeAmount: 0,
      currency,
      transactionDate,
      note
    }
  };
}

export function validatePortfolioTransactionBody(
  body: PortfolioTransactionRequestBody
): PortfolioTransactionValidationResult {
  if (!isTransactionType(body.type)) {
    return { ok: false, message: 'type must be a valid transaction type' };
  }

  const currency = parseCurrency(body.currency);
  if (!currency) {
    return { ok: false, message: 'currency must be USD' };
  }

  const date = parseTransactionDate(body.transactionDate);
  if (!date) {
    return { ok: false, message: 'transactionDate must be a valid date' };
  }

  return normalizePortfolioTransactionInput({
    type: body.type,
    symbol: isMissing(body.symbol) ? null : (body.symbol as any),
    quantity: isMissing(body.quantity) ? null : Number(body.quantity),
    price: isMissing(body.price) ? null : Number(body.price),
    amount: isMissing(body.amount) ? null : Number(body.amount),
    feeAmount: isMissing(body.feeAmount) ? 0 : Number(body.feeAmount),
    currency,
    transactionDate: date,
    note: isMissing(body.note) ? null : (body.note as any)
  });
}

export function validatePortfolioTransactionPatchBody(
  body: PortfolioTransactionRequestBody
): PortfolioTransactionPatchValidationResult {
  const input: Partial<PortfolioTransactionInput> = {};

  if (body.type !== undefined) {
    if (!isTransactionType(body.type)) {
      return { ok: false, message: 'type must be a valid transaction type' };
    }
    input.type = body.type;
  }

  if (body.symbol !== undefined) {
    if (body.symbol === null || body.symbol === '') {
      input.symbol = null;
    } else {
      const symbol = parseSymbol(body.symbol, { required: true });
      if (!symbol.ok) return symbol;
      input.symbol = symbol.value;
    }
  }

  for (const field of ['quantity', 'price', 'amount'] as const) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === '') {
      input[field] = null;
      continue;
    }

    const parsed = Number(body[field]);
    if (!Number.isFinite(parsed)) {
      return { ok: false, message: `${field} must be a finite number` };
    }
    input[field] = parsed;
  }

  if (body.feeAmount !== undefined) {
    const feeAmount = parseNonNegativeNumber(body.feeAmount, 'feeAmount');
    if (!feeAmount.ok) return feeAmount;
    input.feeAmount = feeAmount.value;
  }

  if (body.currency !== undefined) {
    const currency = parseCurrency(body.currency);
    if (!currency) return { ok: false, message: 'currency must be USD' };
    input.currency = currency;
  }

  if (body.transactionDate !== undefined) {
    const transactionDate = parseTransactionDate(body.transactionDate);
    if (!transactionDate) {
      return { ok: false, message: 'transactionDate must be a valid date' };
    }
    input.transactionDate = transactionDate;
  }

  if (body.note !== undefined) {
    const note = parseNote(body.note);
    if (note === false) {
      return { ok: false, message: 'Note must be 500 characters or less' };
    }
    input.note = note;
  }

  if (Object.keys(input).length === 0) {
    return { ok: false, message: 'At least one field is required' };
  }

  return { ok: true, input };
}
