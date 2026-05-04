'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';
import { normalizeTicker, validateTicker } from '@/lib/validation/ticker';
import type {
  PortfolioHolding,
  PortfolioHoldingInput
} from '@/types/portfolio';
import { useWatchlistPrices } from '../hooks/useWatchlistPrices';
import { LoadingSkeleton } from './LoadingSkeleton';

const PORTFOLIO_ENDPOINT = '/api/portfolio/holdings';

type SpanLike = {
  setAttribute?: (key: string, value: string | number | boolean) => void;
};

interface HoldingFormValues {
  symbol: string;
  quantity: string;
  avgCost: string;
}

async function runWithSpan<T>(
  context: Parameters<typeof Sentry.startSpan>[0],
  fn: (span?: SpanLike) => Promise<T>
): Promise<T> {
  if (typeof Sentry.startSpan !== 'function') {
    return fn();
  }

  let ran = false;

  try {
    const result = await Sentry.startSpan(context, async (span: SpanLike) => {
      ran = true;
      return fn(span);
    });

    if (ran) {
      return result;
    }
  } catch (error) {
    if (!ran) {
      return fn();
    }
    throw error;
  }

  return fn();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6
  }).format(value);
}

function getErrorMessage(payload: any, fallback: string) {
  return payload?.error?.message || payload?.message || fallback;
}

function parseHoldingForm(
  values: HoldingFormValues
): { ok: true; input: PortfolioHoldingInput } | { ok: false; message: string } {
  const tickerValidation = validateTicker(values.symbol);
  if (!tickerValidation.isValid) {
    return {
      ok: false,
      message: tickerValidation.error || 'Invalid ticker symbol'
    };
  }

  const quantity = Number(values.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: 'Quantity must be greater than 0' };
  }

  const avgCost = Number(values.avgCost);
  if (!Number.isFinite(avgCost) || avgCost < 0) {
    return {
      ok: false,
      message: 'Average cost must be greater than or equal to 0'
    };
  }

  return {
    ok: true,
    input: {
      symbol: normalizeTicker(values.symbol),
      quantity,
      avgCost
    }
  };
}

function SummaryRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-sm'>{label}</span>
      <span
        className={`text-sm font-medium ${
          tone === 'positive'
            ? 'text-green-600'
            : tone === 'negative'
              ? 'text-red-600'
              : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function HoldingFormDialog({
  open,
  holding,
  busy,
  error,
  onOpenChange,
  onSubmit
}: {
  open: boolean;
  holding: PortfolioHolding | null;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: PortfolioHoldingInput) => Promise<void>;
}) {
  const [values, setValues] = useState<HoldingFormValues>({
    symbol: '',
    quantity: '',
    avgCost: ''
  });
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setValues({
      symbol: holding?.symbol || '',
      quantity: holding ? String(holding.quantity) : '',
      avgCost: holding ? String(holding.avgCost) : ''
    });
    setLocalError(null);
  }, [holding, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseHoldingForm(values);

    if (!parsed.ok) {
      setLocalError(parsed.message);
      return;
    }

    setLocalError(null);
    await onSubmit(parsed.input);
  }

  const title = holding ? 'Edit Position' : 'Add Position';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {holding
              ? 'Update the current shares and average cost.'
              : 'Create a current portfolio position.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='grid gap-2'>
            <Label htmlFor='portfolio-symbol'>Symbol</Label>
            <Input
              id='portfolio-symbol'
              value={values.symbol}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  symbol: event.target.value.toUpperCase()
                }))
              }
              placeholder='AAPL'
              maxLength={5}
              autoComplete='off'
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='portfolio-quantity'>Quantity</Label>
            <Input
              id='portfolio-quantity'
              type='number'
              min='0'
              step='any'
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
            <Label htmlFor='portfolio-avg-cost'>Average Cost</Label>
            <Input
              id='portfolio-avg-cost'
              type='number'
              min='0'
              step='any'
              value={values.avgCost}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  avgCost: event.target.value
                }))
              }
            />
          </div>
          {localError || error ? (
            <div className='text-destructive text-sm'>
              {localError || error}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={busy}
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

function DeleteHoldingDialog({
  holding,
  busy,
  onOpenChange,
  onConfirm
}: {
  holding: PortfolioHolding | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <AlertDialog
      open={Boolean(holding)}
      onOpenChange={(open) => onOpenChange(open)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Position</AlertDialogTitle>
          <AlertDialogDescription>
            Delete {holding?.symbol || 'this'} from your portfolio?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PortfolioCard() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<PortfolioHolding | null>(
    null
  );
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioHolding | null>(
    null
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  const symbols = useMemo(
    () => holdings.map((holding) => holding.symbol),
    [holdings]
  );
  const { pricesMap, isLoading, errorSymbols } = useWatchlistPrices(symbols);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHoldings() {
      await runWithSpan(
        { op: 'ui.load', name: 'Load Portfolio Holdings' },
        async (span) => {
          try {
            const response = await fetch(PORTFOLIO_ENDPOINT, {
              signal: controller.signal
            });
            span?.setAttribute?.('http.status_code', response.status);

            const payload = await response.json();
            if (!response.ok || !payload?.success) {
              throw new Error(
                getErrorMessage(payload, 'Failed to load portfolio holdings')
              );
            }

            if (!controller.signal.aborted) {
              setHoldings(payload.data.holdings);
              span?.setAttribute?.(
                'portfolio.holdings_count',
                payload.data.holdings.length
              );
            }
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return;
            logger.error('Failed to load portfolio holdings', { error });
            if (!controller.signal.aborted) {
              setLoadError(true);
            }
          } finally {
            if (!controller.signal.aborted) {
              setInitialLoading(false);
            }
          }
        }
      );
    }

    loadHoldings();
    return () => {
      controller.abort();
    };
  }, [retryCount]);

  const calculations = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let totalPnL = 0;
    let dayPnL = 0;
    let pricedHoldingsCount = 0;

    for (const holding of holdings) {
      const priceData = pricesMap[holding.symbol];
      if (!priceData) continue;

      const marketValue = holding.quantity * priceData.price;
      const costValue = holding.quantity * holding.avgCost;

      totalValue += marketValue;
      totalCost += costValue;
      totalPnL += marketValue - costValue;
      dayPnL += holding.quantity * priceData.change;
      pricedHoldingsCount++;
    }

    const previousValue = totalValue - dayPnL;

    return {
      totalValue,
      totalPnL,
      dayPnL,
      totalPnLPercent: totalCost > 0 ? (totalPnL / totalCost) * 100 : 0,
      dayPnLPercent: previousValue > 0 ? (dayPnL / previousValue) * 100 : 0,
      pricedHoldingsCount
    };
  }, [holdings, pricesMap]);

  const failedSymbols = useMemo(
    () =>
      holdings
        .filter((holding) => errorSymbols.includes(holding.symbol))
        .map((holding) => holding.symbol),
    [errorSymbols, holdings]
  );

  const pendingPriceCount =
    holdings.length - calculations.pricedHoldingsCount - failedSymbols.length;

  function openAddForm() {
    setEditingHolding(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditForm(holding: PortfolioHolding) {
    setEditingHolding(holding);
    setFormError(null);
    setFormOpen(true);
  }

  async function submitHolding(input: PortfolioHoldingInput) {
    const duplicate = holdings.find(
      (holding) =>
        holding.symbol === input.symbol && holding.id !== editingHolding?.id
    );
    if (duplicate) {
      setFormError('A position already exists for this symbol.');
      return;
    }

    setFormBusy(true);
    setFormError(null);

    await runWithSpan(
      {
        op: 'http.client',
        name: editingHolding
          ? 'PATCH /api/portfolio/holdings/[id]'
          : 'POST /api/portfolio/holdings'
      },
      async (span) => {
        span?.setAttribute?.('portfolio.symbol', input.symbol);

        try {
          const endpoint = editingHolding
            ? `${PORTFOLIO_ENDPOINT}/${editingHolding.id}`
            : PORTFOLIO_ENDPOINT;
          const response = await fetch(endpoint, {
            method: editingHolding ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
          });
          span?.setAttribute?.('http.status_code', response.status);

          const payload = await response.json();
          if (!response.ok || !payload?.success) {
            setFormError(
              getErrorMessage(payload, 'Failed to save portfolio position')
            );
            return;
          }

          const savedHolding = payload.data.holding as PortfolioHolding;
          setHoldings((current) =>
            editingHolding
              ? current.map((holding) =>
                  holding.id === savedHolding.id ? savedHolding : holding
                )
              : [...current, savedHolding]
          );
          setFormOpen(false);
          setEditingHolding(null);
          toast.success(editingHolding ? 'Position updated' : 'Position added');
        } catch (error) {
          logger.error('Portfolio holding save failed', { error });
          setFormError('Failed to save portfolio position');
        } finally {
          setFormBusy(false);
        }
      }
    );
  }

  async function deleteHolding() {
    if (!deleteTarget) return;

    setDeleteBusy(true);

    await runWithSpan(
      { op: 'http.client', name: 'DELETE /api/portfolio/holdings/[id]' },
      async (span) => {
        span?.setAttribute?.('portfolio.symbol', deleteTarget.symbol);

        try {
          const response = await fetch(
            `${PORTFOLIO_ENDPOINT}/${deleteTarget.id}`,
            { method: 'DELETE' }
          );
          span?.setAttribute?.('http.status_code', response.status);

          let payload: any = null;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }

          if (!response.ok || !payload?.success) {
            toast.error(
              getErrorMessage(payload, 'Failed to delete portfolio position')
            );
            return;
          }

          setHoldings((current) =>
            current.filter((holding) => holding.id !== deleteTarget.id)
          );
          setDeleteTarget(null);
          toast.success('Position deleted');
        } catch (error) {
          logger.error('Portfolio holding delete failed', { error });
          toast.error('Failed to delete portfolio position');
        } finally {
          setDeleteBusy(false);
        }
      }
    );
  }

  const totalTone = calculations.totalPnL >= 0 ? 'positive' : 'negative';
  const dayTone = calculations.dayPnL >= 0 ? 'positive' : 'negative';

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Portfolio</CardTitle>
        <Button size='sm' onClick={openAddForm}>
          <PlusIcon className='size-4' />
          Add Position
        </Button>
      </CardHeader>
      <CardContent className='space-y-4'>
        {initialLoading ? (
          <LoadingSkeleton count={3} />
        ) : loadError ? (
          <div className='flex flex-col items-center gap-2'>
            <div className='text-destructive text-sm'>
              Failed to load portfolio
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setLoadError(false);
                setInitialLoading(true);
                setRetryCount((count) => count + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : holdings.length === 0 ? (
          <div className='text-muted-foreground text-sm'>
            No holdings yet. Add a position to see your portfolio overview.
          </div>
        ) : (
          <>
            <div className='space-y-2'>
              <SummaryRow
                label='Total Value'
                value={formatCurrency(calculations.totalValue)}
              />
              <SummaryRow
                label='Day P&L'
                value={`${formatCurrency(calculations.dayPnL)} (${formatPercent(
                  calculations.dayPnLPercent
                )})`}
                tone={dayTone}
              />
              <SummaryRow
                label='Total P&L'
                value={`${formatCurrency(
                  calculations.totalPnL
                )} (${formatPercent(calculations.totalPnLPercent)})`}
                tone={totalTone}
              />
              {failedSymbols.length > 0 ? (
                <div className='text-muted-foreground text-xs'>
                  Prices unavailable for {failedSymbols.join(', ')}.
                </div>
              ) : pendingPriceCount > 0 || isLoading ? (
                <div className='text-muted-foreground text-xs'>
                  Loading latest prices...
                </div>
              ) : null}
            </div>

            <div className='border-t pt-3'>
              <div className='text-muted-foreground mb-2 text-xs'>
                Holdings ({holdings.length})
              </div>
              <ScrollArea className='max-h-72'>
                <div className='space-y-3 pr-3'>
                  {holdings.map((holding) => {
                    const priceData = pricesMap[holding.symbol];
                    const marketValue = priceData
                      ? holding.quantity * priceData.price
                      : null;
                    const pnl =
                      marketValue !== null
                        ? marketValue - holding.quantity * holding.avgCost
                        : null;
                    const isHoldingPositive = (pnl || 0) >= 0;
                    const hasPriceError = failedSymbols.includes(
                      holding.symbol
                    );

                    return (
                      <div
                        key={holding.id}
                        className='flex items-start justify-between gap-3 border-b pb-3 text-sm last:border-b-0 last:pb-0'
                      >
                        <div className='min-w-0 space-y-1'>
                          <div className='flex items-center gap-2'>
                            <span className='font-medium'>
                              {holding.symbol}
                            </span>
                            <span className='text-muted-foreground'>
                              x{formatQuantity(holding.quantity)}
                            </span>
                          </div>
                          <div className='text-muted-foreground text-xs'>
                            Avg {formatCurrency(holding.avgCost)}
                            {priceData
                              ? ` / Last ${formatCurrency(priceData.price)}`
                              : ''}
                          </div>
                          {hasPriceError ? (
                            <div className='text-destructive text-xs'>
                              Price unavailable
                            </div>
                          ) : null}
                        </div>
                        <div className='flex items-start gap-2'>
                          <div className='min-w-24 text-right'>
                            <div className='font-medium'>
                              {marketValue !== null
                                ? formatCurrency(marketValue)
                                : 'Loading'}
                            </div>
                            {pnl !== null ? (
                              <div
                                className={`text-xs ${
                                  isHoldingPositive
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {formatCurrency(pnl)}
                              </div>
                            ) : null}
                          </div>
                          <div className='flex items-center gap-1'>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type='button'
                                  variant='ghost'
                                  size='icon'
                                  className='size-8'
                                  aria-label={`Edit ${holding.symbol}`}
                                  onClick={() => openEditForm(holding)}
                                >
                                  <PencilIcon className='size-4' />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit position</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type='button'
                                  variant='ghost'
                                  size='icon'
                                  className='size-8'
                                  aria-label={`Delete ${holding.symbol}`}
                                  onClick={() => setDeleteTarget(holding)}
                                >
                                  <Trash2Icon className='size-4' />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete position</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>

      <HoldingFormDialog
        open={formOpen}
        holding={editingHolding}
        busy={formBusy}
        error={formError}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingHolding(null);
            setFormError(null);
          }
        }}
        onSubmit={submitHolding}
      />
      <DeleteHoldingDialog
        holding={deleteTarget}
        busy={deleteBusy}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={deleteHolding}
      />
    </Card>
  );
}
