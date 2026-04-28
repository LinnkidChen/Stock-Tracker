'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';
import type {
  PortfolioHolding,
  PortfolioSnapshot,
  PortfolioSummary,
  PortfolioTransaction,
  PortfolioTransactionInput,
  PortfolioTransactionType
} from '@/types/portfolio';
import { useWatchlistPrices } from '../hooks/useWatchlistPrices';

const HOLDINGS_ENDPOINT = '/api/portfolio/holdings';
const TRANSACTIONS_ENDPOINT = '/api/portfolio/transactions';
const EMPTY_HOLDINGS: PortfolioHolding[] = [];
const EMPTY_TRANSACTIONS: PortfolioTransaction[] = [];

const TRANSACTION_TYPES: Array<{
  value: PortfolioTransactionType;
  label: string;
}> = [
  { value: 'opening_balance', label: 'Opening Balance' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'fee', label: 'Fee' }
];

interface PortfolioData {
  holdings: PortfolioHolding[];
  summary: PortfolioSummary;
}

interface TransactionData {
  transactions: PortfolioTransaction[];
  summary: PortfolioSummary;
}

interface TransactionFormValues {
  type: PortfolioTransactionType;
  symbol: string;
  quantity: string;
  price: string;
  amount: string;
  feeAmount: string;
  transactionDate: string;
  note: string;
}

type ApiError = Error & { status?: number };

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return todayInputValue();
  return new Date(parsed).toISOString().slice(0, 10);
}

function getTransactionLabel(type: PortfolioTransactionType) {
  return TRANSACTION_TYPES.find((item) => item.value === type)?.label ?? type;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6
  }).format(value);
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(parsed));
}

async function readApiJson<T>(
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const error = new Error(
      payload?.error?.message || 'Portfolio request failed'
    ) as ApiError;
    error.status = response.status;
    throw error;
  }

  return payload.data as T;
}

function createEmptyFormValues(): TransactionFormValues {
  return {
    type: 'buy',
    symbol: '',
    quantity: '',
    price: '',
    amount: '',
    feeAmount: '',
    transactionDate: todayInputValue(),
    note: ''
  };
}

function createFormValues(
  transaction: PortfolioTransaction | null
): TransactionFormValues {
  if (!transaction) return createEmptyFormValues();

  return {
    type: transaction.type,
    symbol: transaction.symbol ?? '',
    quantity: transaction.quantity !== null ? String(transaction.quantity) : '',
    price: transaction.price !== null ? String(transaction.price) : '',
    amount: transaction.amount !== null ? String(transaction.amount) : '',
    feeAmount: transaction.feeAmount ? String(transaction.feeAmount) : '',
    transactionDate: toDateInputValue(transaction.transactionDate),
    note: transaction.note ?? ''
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function buildTransactionInput(
  values: TransactionFormValues
): PortfolioTransactionInput {
  const type = values.type;
  const symbol = values.symbol.trim().toUpperCase() || null;
  const quantity = parseOptionalNumber(values.quantity);
  const price = parseOptionalNumber(values.price);
  const amount = parseOptionalNumber(values.amount);
  const feeAmount = parseOptionalNumber(values.feeAmount) ?? 0;

  return {
    type,
    symbol,
    quantity,
    price,
    amount,
    feeAmount,
    currency: 'USD',
    transactionDate: values.transactionDate || todayInputValue(),
    note: values.note.trim() || null
  };
}

function SummaryMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className='rounded-md border p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div
        className={`mt-1 text-lg font-semibold ${
          tone === 'positive'
            ? 'text-green-600'
            : tone === 'negative'
              ? 'text-red-600'
              : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function TransactionDialog({
  open,
  transaction,
  busy,
  error,
  onOpenChange,
  onSubmit
}: {
  open: boolean;
  transaction: PortfolioTransaction | null;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: PortfolioTransactionInput) => Promise<void>;
}) {
  const [values, setValues] = useState<TransactionFormValues>(
    createFormValues(transaction)
  );

  useEffect(() => {
    if (open) setValues(createFormValues(transaction));
  }, [open, transaction]);

  const needsSymbol = ['opening_balance', 'buy', 'sell', 'dividend'].includes(
    values.type
  );
  const needsQuantityPrice = ['opening_balance', 'buy', 'sell'].includes(
    values.type
  );
  const needsAmount = ['dividend', 'deposit', 'withdrawal', 'fee'].includes(
    values.type
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(buildTransactionInput(values));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='portfolio-transaction-type'>Type</Label>
              <Select
                value={values.type}
                onValueChange={(value) =>
                  setValues((current) => ({
                    ...current,
                    type: value as PortfolioTransactionType
                  }))
                }
              >
                <SelectTrigger
                  id='portfolio-transaction-type'
                  className='w-full'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='portfolio-transaction-date'>Date</Label>
              <Input
                id='portfolio-transaction-date'
                type='date'
                value={values.transactionDate}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    transactionDate: event.target.value
                  }))
                }
              />
            </div>
          </div>

          {needsSymbol ? (
            <div className='grid gap-2'>
              <Label htmlFor='portfolio-transaction-symbol'>Symbol</Label>
              <Input
                id='portfolio-transaction-symbol'
                value={values.symbol}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    symbol: event.target.value.toUpperCase()
                  }))
                }
                placeholder='AAPL'
                maxLength={5}
              />
            </div>
          ) : null}

          {needsQuantityPrice ? (
            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='grid gap-2'>
                <Label htmlFor='portfolio-transaction-quantity'>Quantity</Label>
                <Input
                  id='portfolio-transaction-quantity'
                  type='number'
                  step='any'
                  min='0'
                  value={values.quantity}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      quantity: event.target.value
                    }))
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='portfolio-transaction-price'>Price</Label>
                <Input
                  id='portfolio-transaction-price'
                  type='number'
                  step='any'
                  min='0'
                  value={values.price}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      price: event.target.value
                    }))
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='portfolio-transaction-fee'>Fee</Label>
                <Input
                  id='portfolio-transaction-fee'
                  type='number'
                  step='any'
                  min='0'
                  value={values.feeAmount}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      feeAmount: event.target.value
                    }))
                  }
                />
              </div>
            </div>
          ) : null}

          {needsAmount ? (
            <div className='grid gap-2'>
              <Label htmlFor='portfolio-transaction-amount'>Amount</Label>
              <Input
                id='portfolio-transaction-amount'
                type='number'
                step='any'
                min='0'
                value={values.amount}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    amount: event.target.value
                  }))
                }
              />
            </div>
          ) : null}

          <div className='grid gap-2'>
            <Label htmlFor='portfolio-transaction-note'>Note</Label>
            <Textarea
              id='portfolio-transaction-note'
              value={values.note}
              maxLength={500}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  note: event.target.value
                }))
              }
            />
          </div>

          {error ? (
            <div className='text-destructive text-sm'>{error}</div>
          ) : null}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PortfolioManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<PortfolioTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] =
    useState<PortfolioTransaction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const holdingsQuery = useQuery({
    queryKey: ['portfolio', 'holdings'],
    queryFn: () => readApiJson<PortfolioData>(HOLDINGS_ENDPOINT)
  });
  const transactionsQuery = useQuery({
    queryKey: ['portfolio', 'transactions'],
    queryFn: () => readApiJson<TransactionData>(TRANSACTIONS_ENDPOINT)
  });

  const holdings = holdingsQuery.data?.holdings ?? EMPTY_HOLDINGS;
  const summary =
    holdingsQuery.data?.summary ?? transactionsQuery.data?.summary ?? null;
  const transactions =
    transactionsQuery.data?.transactions ?? EMPTY_TRANSACTIONS;
  const symbols = useMemo(
    () => holdings.map((holding) => holding.symbol),
    [holdings]
  );
  const { pricesMap, isLoading: pricesLoading } = useWatchlistPrices(symbols);

  const marketSummary = useMemo(() => {
    let marketValue = 0;
    let unrealizedPnl = 0;

    for (const holding of holdings) {
      const price = pricesMap[holding.symbol]?.price;
      if (!price) continue;

      const value = holding.quantity * price;
      marketValue += value;
      unrealizedPnl += value - holding.costBasis;
    }

    return { marketValue, unrealizedPnl };
  }, [holdings, pricesMap]);

  const refreshPortfolio = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'holdings'] }),
      queryClient.invalidateQueries({
        queryKey: ['portfolio', 'transactions']
      })
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (input: PortfolioTransactionInput) => {
      const endpoint = editingTransaction
        ? `${TRANSACTIONS_ENDPOINT}/${editingTransaction.id}`
        : TRANSACTIONS_ENDPOINT;

      return readApiJson<PortfolioSnapshot>(endpoint, {
        method: editingTransaction ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setEditingTransaction(null);
      setFormError(null);
      await refreshPortfolio();
      toast.success(
        editingTransaction ? 'Transaction updated' : 'Transaction added'
      );
    },
    onError: (error) => {
      logger.error('Portfolio transaction save failed', { error });
      setFormError(
        error instanceof Error ? error.message : 'Failed to save transaction'
      );
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (transaction: PortfolioTransaction) =>
      readApiJson<{ id: string }>(
        `${TRANSACTIONS_ENDPOINT}/${transaction.id}`,
        {
          method: 'DELETE'
        }
      ),
    onSuccess: async () => {
      setDeletingTransaction(null);
      await refreshPortfolio();
      toast.success('Transaction deleted');
    },
    onError: (error) => {
      logger.error('Portfolio transaction delete failed', { error });
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete transaction'
      );
    }
  });

  function openAddDialog() {
    setEditingTransaction(null);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(transaction: PortfolioTransaction) {
    setEditingTransaction(transaction);
    setFormError(null);
    setDialogOpen(true);
  }

  const totalPnl = marketSummary.unrealizedPnl + (summary?.realizedPnl ?? 0);

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Portfolio</h1>
          <p className='text-muted-foreground text-sm'>
            Ledger-backed holdings and P&L
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <PlusIcon className='size-4' />
          Add Transaction
        </Button>
      </div>

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <SummaryMetric
          label='Market Value'
          value={
            pricesLoading && marketSummary.marketValue === 0
              ? 'Loading'
              : formatCurrency(marketSummary.marketValue)
          }
        />
        <SummaryMetric
          label='Unrealized P&L'
          value={formatCurrency(marketSummary.unrealizedPnl)}
          tone={marketSummary.unrealizedPnl >= 0 ? 'positive' : 'negative'}
        />
        <SummaryMetric
          label='Realized P&L'
          value={formatCurrency(summary?.realizedPnl ?? 0)}
          tone={(summary?.realizedPnl ?? 0) >= 0 ? 'positive' : 'negative'}
        />
        <SummaryMetric
          label='Cash Balance'
          value={formatCurrency(summary?.cashBalance ?? 0)}
        />
      </div>

      <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]'>
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {holdingsQuery.isLoading ? (
              <div className='text-muted-foreground text-sm'>
                Loading holdings...
              </div>
            ) : holdingsQuery.isError ? (
              <div className='text-destructive text-sm'>
                Failed to load portfolio holdings
              </div>
            ) : holdings.length === 0 ? (
              <div className='text-muted-foreground text-sm'>
                No holdings yet. Add a buy or opening balance transaction.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className='text-right'>Quantity</TableHead>
                    <TableHead className='text-right'>Avg Cost</TableHead>
                    <TableHead className='text-right'>Cost Basis</TableHead>
                    <TableHead className='text-right'>Market Value</TableHead>
                    <TableHead className='text-right'>Unrealized</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding) => {
                    const price = pricesMap[holding.symbol]?.price;
                    const marketValue = price ? holding.quantity * price : null;
                    const unrealized =
                      marketValue !== null
                        ? marketValue - holding.costBasis
                        : null;

                    return (
                      <TableRow key={holding.id}>
                        <TableCell className='font-medium'>
                          {holding.symbol}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatQuantity(holding.quantity)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatCurrency(holding.avgCost)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatCurrency(holding.costBasis)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {marketValue !== null
                            ? formatCurrency(marketValue)
                            : 'Loading'}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            unrealized === null
                              ? ''
                              : unrealized >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
                          }`}
                        >
                          {unrealized !== null
                            ? formatCurrency(unrealized)
                            : ''}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ledger Summary</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Invested cost</span>
              <span>{formatCurrency(summary?.investedCost ?? 0)}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Dividends</span>
              <span>{formatCurrency(summary?.dividends ?? 0)}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Fees</span>
              <span>{formatCurrency(summary?.fees ?? 0)}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Deposits</span>
              <span>{formatCurrency(summary?.deposits ?? 0)}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Withdrawals</span>
              <span>{formatCurrency(summary?.withdrawals ?? 0)}</span>
            </div>
            <div className='border-t pt-3'>
              <div className='text-muted-foreground text-xs'>Total P&L</div>
              <div
                className={`text-2xl font-semibold ${
                  totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(totalPnl)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsQuery.isLoading ? (
            <div className='text-muted-foreground text-sm'>
              Loading transactions...
            </div>
          ) : transactionsQuery.isError ? (
            <div className='text-destructive text-sm'>
              Failed to load portfolio transactions
            </div>
          ) : transactions.length === 0 ? (
            <div className='text-muted-foreground text-sm'>
              Add the first transaction to start tracking this portfolio.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead className='text-right'>Quantity</TableHead>
                  <TableHead className='text-right'>Price/Amount</TableHead>
                  <TableHead className='text-right'>Realized P&L</TableHead>
                  <TableHead className='w-24 text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {formatDate(transaction.transactionDate)}
                    </TableCell>
                    <TableCell>
                      {getTransactionLabel(transaction.type)}
                    </TableCell>
                    <TableCell>{transaction.symbol ?? '-'}</TableCell>
                    <TableCell className='text-right'>
                      {transaction.quantity !== null
                        ? formatQuantity(transaction.quantity)
                        : '-'}
                    </TableCell>
                    <TableCell className='text-right'>
                      {transaction.price !== null
                        ? formatCurrency(transaction.price)
                        : transaction.amount !== null
                          ? formatCurrency(transaction.amount)
                          : '-'}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        transaction.realizedPnl === null
                          ? ''
                          : transaction.realizedPnl >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                      }`}
                    >
                      {transaction.realizedPnl !== null
                        ? formatCurrency(transaction.realizedPnl)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-end gap-1'>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='size-8'
                              aria-label={`Edit ${getTransactionLabel(
                                transaction.type
                              )}`}
                              onClick={() => openEditDialog(transaction)}
                            >
                              <PencilIcon className='size-4' />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit transaction</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='size-8'
                              aria-label={`Delete ${getTransactionLabel(
                                transaction.type
                              )}`}
                              onClick={() =>
                                setDeletingTransaction(transaction)
                              }
                            >
                              <Trash2Icon className='size-4' />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete transaction</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TransactionDialog
        open={dialogOpen}
        transaction={editingTransaction}
        busy={saveMutation.isPending}
        error={formError}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTransaction(null);
            setFormError(null);
          }
        }}
        onSubmit={async (input) => {
          await saveMutation.mutateAsync(input);
        }}
      />
      <AlertDialog
        open={Boolean(deletingTransaction)}
        onOpenChange={(open) => {
          if (!open) setDeletingTransaction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this portfolio transaction? Derived holdings and P&L will
              be recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingTransaction) {
                  deleteMutation.mutate(deletingTransaction);
                }
              }}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
