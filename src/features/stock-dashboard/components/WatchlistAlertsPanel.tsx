'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  History,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';
import type {
  WatchlistAlert,
  WatchlistAlertTrigger,
  WatchlistAlertType
} from '@/types/alerts';
import type { WatchlistPricesMap } from '@/types/stocks';
import { cn } from '@/lib/utils';

const ALERTS_ENDPOINT = '/api/watchlist/alerts';
const ALERT_TRIGGERS_ENDPOINT = '/api/watchlist/alerts/triggers';

const ALERT_TYPE_LABELS: Record<WatchlistAlertType, string> = {
  price_above: 'Price above',
  price_below: 'Price below',
  percent_move: 'Percent move',
  gap_up: 'Gap up',
  gap_down: 'Gap down',
  volume_spike: 'Volume spike'
};

const ALERT_TYPE_OPTIONS: Array<{ value: WatchlistAlertType; label: string }> =
  [
    { value: 'price_above', label: ALERT_TYPE_LABELS.price_above },
    { value: 'price_below', label: ALERT_TYPE_LABELS.price_below },
    { value: 'percent_move', label: ALERT_TYPE_LABELS.percent_move },
    { value: 'gap_up', label: ALERT_TYPE_LABELS.gap_up },
    { value: 'gap_down', label: ALERT_TYPE_LABELS.gap_down },
    { value: 'volume_spike', label: ALERT_TYPE_LABELS.volume_spike }
  ];

interface AlertFormValues {
  symbol: string;
  type: WatchlistAlertType;
  threshold: string;
}

interface TriggerDraft {
  observedValue: number;
  observedPrice: number | null;
  message: string;
}

interface WatchlistAlertsPanelProps {
  symbols: string[];
  pricesMap: WatchlistPricesMap;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function getDefaultThreshold(type: WatchlistAlertType): string {
  if (type === 'volume_spike') return '2';
  if (type === 'price_above' || type === 'price_below') return '';
  return '5';
}

function parseThreshold(
  type: WatchlistAlertType,
  value: string
): { ok: true; threshold: number } | { ok: false; message: string } {
  const threshold = Number(value);

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { ok: false, message: 'Threshold must be greater than 0' };
  }

  if (type === 'volume_spike' && threshold < 1) {
    return {
      ok: false,
      message: 'Volume spike multiplier must be at least 1'
    };
  }

  return { ok: true, threshold };
}

function formatThreshold(alert: Pick<WatchlistAlert, 'type' | 'threshold'>) {
  switch (alert.type) {
    case 'price_above':
      return `above ${formatCurrency(alert.threshold)}`;
    case 'price_below':
      return `below ${formatCurrency(alert.threshold)}`;
    case 'percent_move':
      return `${alert.threshold.toFixed(2)}% move`;
    case 'gap_up':
      return `${alert.threshold.toFixed(2)}% gap up`;
    case 'gap_down':
      return `${alert.threshold.toFixed(2)}% gap down`;
    case 'volume_spike':
      return `${alert.threshold.toFixed(2)}x volume`;
  }
}

function getGapPercent(quote: WatchlistPricesMap[string]): number | undefined {
  if (
    quote.open === undefined ||
    quote.previousClose === undefined ||
    !Number.isFinite(quote.open) ||
    !Number.isFinite(quote.previousClose) ||
    quote.previousClose <= 0
  ) {
    return undefined;
  }

  return ((quote.open - quote.previousClose) / quote.previousClose) * 100;
}

function evaluateAlert(
  alert: WatchlistAlert,
  quote: WatchlistPricesMap[string]
): TriggerDraft | null {
  const observedPrice = Number.isFinite(quote.price) ? quote.price : null;

  switch (alert.type) {
    case 'price_above':
      if (quote.price < alert.threshold) return null;
      return {
        observedValue: quote.price,
        observedPrice,
        message: `${alert.symbol} reached ${formatCurrency(quote.price)}`
      };
    case 'price_below':
      if (quote.price > alert.threshold) return null;
      return {
        observedValue: quote.price,
        observedPrice,
        message: `${alert.symbol} fell to ${formatCurrency(quote.price)}`
      };
    case 'percent_move':
      if (Math.abs(quote.changePercent) < alert.threshold) return null;
      return {
        observedValue: quote.changePercent,
        observedPrice,
        message: `${alert.symbol} moved ${formatPercent(quote.changePercent)}`
      };
    case 'gap_up': {
      const gapPercent = getGapPercent(quote);
      if (gapPercent === undefined || gapPercent < alert.threshold) return null;

      return {
        observedValue: gapPercent,
        observedPrice,
        message: `${alert.symbol} gapped up ${formatPercent(gapPercent)}`
      };
    }
    case 'gap_down': {
      const gapPercent = getGapPercent(quote);
      if (gapPercent === undefined || gapPercent > -alert.threshold)
        return null;

      return {
        observedValue: gapPercent,
        observedPrice,
        message: `${alert.symbol} gapped down ${formatPercent(gapPercent)}`
      };
    }
    case 'volume_spike': {
      const volume = quote.volume;
      const avgVolume = quote.avgVolume;

      if (
        volume === undefined ||
        avgVolume === undefined ||
        avgVolume === null ||
        !Number.isFinite(volume) ||
        !Number.isFinite(avgVolume) ||
        avgVolume <= 0
      ) {
        return null;
      }

      const multiple = volume / avgVolume;
      if (multiple < alert.threshold) return null;

      return {
        observedValue: multiple,
        observedPrice,
        message: `${alert.symbol} volume hit ${multiple.toFixed(2)}x average`
      };
    }
  }
}

function getObservedLabel(trigger: WatchlistAlertTrigger): string {
  if (trigger.type === 'price_above' || trigger.type === 'price_below') {
    return formatCurrency(trigger.observedValue);
  }

  if (
    trigger.type === 'percent_move' ||
    trigger.type === 'gap_up' ||
    trigger.type === 'gap_down'
  ) {
    return formatPercent(trigger.observedValue);
  }

  return `${trigger.observedValue.toFixed(2)}x`;
}

function getStatusBadgeClass(status: WatchlistAlert['status']): string {
  if (status === 'active') return 'border-green-200 bg-green-50 text-green-700';
  if (status === 'triggered')
    return 'border-amber-200 bg-amber-50 text-amber-700';
  return '';
}

export function WatchlistAlertsPanel({
  symbols,
  pricesMap
}: WatchlistAlertsPanelProps) {
  const [alerts, setAlerts] = useState<WatchlistAlert[]>([]);
  const [triggers, setTriggers] = useState<WatchlistAlertTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState<AlertFormValues>({
    symbol: '',
    type: 'price_above',
    threshold: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const triggeringAlertIdsRef = useRef(new Set<string>());

  const symbolOptions = useMemo(
    () => Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase()))),
    [symbols]
  );

  const statusCounts = useMemo(
    () => ({
      active: alerts.filter((alert) => alert.status === 'active').length,
      triggered: alerts.filter((alert) => alert.status === 'triggered').length,
      paused: alerts.filter((alert) => alert.status === 'paused').length
    }),
    [alerts]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadAlerts() {
      try {
        const response = await fetch(ALERTS_ENDPOINT, {
          signal: controller.signal
        });
        const json = await response.json().catch(() => null);

        if (!response.ok || !json?.success) {
          throw new Error(json?.error?.message || 'Failed to load alerts');
        }

        if (!controller.signal.aborted) {
          setAlerts(Array.isArray(json.data?.alerts) ? json.data.alerts : []);
          setTriggers(
            Array.isArray(json.data?.triggers) ? json.data.triggers : []
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;

        logger.error('Failed to load watchlist alerts', { error });
        if (!controller.signal.aborted) {
          toast.error('Failed to load watchlist alerts');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadAlerts();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (symbolOptions.length === 0) return;

    setFormValues((current) => {
      if (current.symbol && symbolOptions.includes(current.symbol)) {
        return current;
      }

      return {
        ...current,
        symbol: symbolOptions[0]
      };
    });
  }, [symbolOptions]);

  const recordTrigger = useCallback(
    async (alert: WatchlistAlert, trigger: TriggerDraft) => {
      triggeringAlertIdsRef.current.add(alert.id);

      try {
        const response = await fetch(ALERT_TRIGGERS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertId: alert.id,
            observedValue: trigger.observedValue,
            observedPrice: trigger.observedPrice,
            message: trigger.message
          })
        });
        const json = await response.json().catch(() => null);

        if (!response.ok || !json?.success) {
          throw new Error(json?.error?.message || 'Failed to record alert');
        }

        const nextAlert = json.data?.alert as WatchlistAlert | undefined;
        const nextTrigger = json.data?.trigger as
          | WatchlistAlertTrigger
          | undefined;

        if (nextAlert) {
          setAlerts((current) =>
            current.map((candidate) =>
              candidate.id === nextAlert.id ? nextAlert : candidate
            )
          );
        }

        if (nextTrigger) {
          setTriggers((current) => [
            nextTrigger,
            ...current.filter((candidate) => candidate.id !== nextTrigger.id)
          ]);
        }

        toast.success('Alert triggered');
      } catch (error) {
        logger.error('Failed to record watchlist alert trigger', {
          error,
          alertId: alert.id
        });
      } finally {
        triggeringAlertIdsRef.current.delete(alert.id);
      }
    },
    []
  );

  useEffect(() => {
    alerts.forEach((alert) => {
      if (
        alert.status !== 'active' ||
        triggeringAlertIdsRef.current.has(alert.id)
      ) {
        return;
      }

      const quote = pricesMap[alert.symbol];
      if (!quote) return;

      const trigger = evaluateAlert(alert, quote);
      if (!trigger) return;

      void recordTrigger(alert, trigger);
    });
  }, [alerts, pricesMap, recordTrigger]);

  async function createAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!formValues.symbol) {
      setFormError('Symbol is required');
      return;
    }

    const parsedThreshold = parseThreshold(
      formValues.type,
      formValues.threshold
    );
    if (!parsedThreshold.ok) {
      setFormError(parsedThreshold.message);
      return;
    }

    try {
      const response = await fetch(ALERTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: formValues.symbol,
          type: formValues.type,
          threshold: parsedThreshold.threshold
        })
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Failed to create alert');
      }

      setAlerts((current) => [...current, json.data.alert]);
      setDialogOpen(false);
      setFormValues((current) => ({
        ...current,
        threshold: getDefaultThreshold(current.type)
      }));
    } catch (error) {
      logger.error('Failed to create watchlist alert', { error });
      setFormError(
        error instanceof Error ? error.message : 'Failed to create alert'
      );
    }
  }

  async function updateAlertStatus(
    alert: WatchlistAlert,
    status: WatchlistAlert['status']
  ) {
    const previousAlerts = alerts;
    setBusyAlertId(alert.id);
    setAlerts((current) =>
      current.map((candidate) =>
        candidate.id === alert.id ? { ...candidate, status } : candidate
      )
    );

    try {
      const response = await fetch(ALERTS_ENDPOINT, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, status })
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Failed to update alert');
      }

      setAlerts((current) =>
        current.map((candidate) =>
          candidate.id === alert.id ? json.data.alert : candidate
        )
      );
    } catch (error) {
      logger.error('Failed to update watchlist alert status', {
        error,
        alertId: alert.id
      });
      setAlerts(previousAlerts);
      toast.error('Failed to update alert');
    } finally {
      setBusyAlertId(null);
    }
  }

  async function deleteAlert(alert: WatchlistAlert) {
    const previousAlerts = alerts;
    setBusyAlertId(alert.id);
    setAlerts((current) =>
      current.filter((candidate) => candidate.id !== alert.id)
    );

    try {
      const response = await fetch(
        `${ALERTS_ENDPOINT}?id=${encodeURIComponent(alert.id)}`,
        {
          method: 'DELETE'
        }
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Failed to delete alert');
      }
    } catch (error) {
      logger.error('Failed to delete watchlist alert', {
        error,
        alertId: alert.id
      });
      setAlerts(previousAlerts);
      toast.error('Failed to delete alert');
    } finally {
      setBusyAlertId(null);
    }
  }

  const canCreateAlert = symbolOptions.length > 0;

  return (
    <section className='space-y-3 rounded-lg border p-3'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2 text-sm font-medium'>
            <BellRing className='h-4 w-4' />
            Alerts
          </div>
          <div className='text-muted-foreground flex flex-wrap gap-2 text-xs'>
            <span>{statusCounts.active} active</span>
            <span>{statusCounts.triggered} triggered</span>
            <span>{statusCounts.paused} paused</span>
          </div>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={!canCreateAlert}
          onClick={() => {
            setFormError(null);
            setFormValues((current) => ({
              symbol: current.symbol || symbolOptions[0] || '',
              type: current.type,
              threshold: current.threshold || getDefaultThreshold(current.type)
            }));
            setDialogOpen(true);
          }}
        >
          <Plus className='h-4 w-4' />
          New alert
        </Button>
      </div>

      {loading ? (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' />
          Loading alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className='text-muted-foreground rounded-md border border-dashed p-4 text-sm'>
          No alerts configured.
        </div>
      ) : (
        <div className='space-y-2'>
          {alerts.map((alert) => {
            const isBusy = busyAlertId === alert.id;
            const nextStatus = alert.status === 'active' ? 'paused' : 'active';

            return (
              <div
                key={alert.id}
                className='flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='min-w-0 space-y-1'>
                  <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <span className='font-medium'>{alert.symbol}</span>
                    <span className='text-sm'>
                      {ALERT_TYPE_LABELS[alert.type]}
                    </span>
                    <Badge
                      variant='outline'
                      className={cn(getStatusBadgeClass(alert.status))}
                    >
                      {alert.status}
                    </Badge>
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {formatThreshold(alert)} · Last triggered{' '}
                    {formatDateTime(alert.lastTriggeredAt)}
                  </div>
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        disabled={isBusy}
                        onClick={() => updateAlertStatus(alert, nextStatus)}
                        aria-label={
                          nextStatus === 'active'
                            ? `Activate ${alert.symbol} alert`
                            : `Pause ${alert.symbol} alert`
                        }
                        className='size-8'
                      >
                        {isBusy ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : nextStatus === 'active' ? (
                          <Play className='h-4 w-4' />
                        ) : (
                          <Pause className='h-4 w-4' />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {nextStatus === 'active' ? 'Activate' : 'Pause'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        disabled={isBusy}
                        onClick={() => deleteAlert(alert)}
                        aria-label={`Delete ${alert.symbol} alert`}
                        className='size-8'
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete alert</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className='space-y-2'>
        <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
          <History className='h-3.5 w-3.5' />
          Trigger history
        </div>
        {triggers.length === 0 ? (
          <div className='text-muted-foreground text-xs'>No triggers yet.</div>
        ) : (
          <ScrollArea className='max-h-36'>
            <div className='space-y-2 pr-3'>
              {triggers.slice(0, 10).map((trigger) => (
                <div
                  key={trigger.id}
                  className='flex items-start justify-between gap-3 text-xs'
                >
                  <div className='min-w-0'>
                    <div className='font-medium'>
                      {trigger.symbol} · {ALERT_TYPE_LABELS[trigger.type]}
                    </div>
                    <div className='text-muted-foreground truncate'>
                      {trigger.message}
                    </div>
                  </div>
                  <div className='text-muted-foreground shrink-0 text-right'>
                    <div>{getObservedLabel(trigger)}</div>
                    <div>{formatDateTime(trigger.triggeredAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Alert</DialogTitle>
            <DialogDescription>
              Create a rule for a watched symbol.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createAlert} className='space-y-4'>
            <div className='grid gap-2'>
              <Label htmlFor='watchlist-alert-symbol'>Symbol</Label>
              <select
                id='watchlist-alert-symbol'
                value={formValues.symbol}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    symbol: event.target.value
                  }))
                }
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
              >
                {symbolOptions.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='watchlist-alert-type'>Type</Label>
              <select
                id='watchlist-alert-type'
                value={formValues.type}
                onChange={(event) => {
                  const type = event.target.value as WatchlistAlertType;
                  setFormValues((current) => ({
                    ...current,
                    type,
                    threshold: getDefaultThreshold(type)
                  }));
                }}
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
              >
                {ALERT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='watchlist-alert-threshold'>Threshold</Label>
              <Input
                id='watchlist-alert-threshold'
                type='number'
                min='0'
                step='any'
                value={formValues.threshold}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    threshold: event.target.value
                  }))
                }
                placeholder={
                  formValues.type === 'volume_spike'
                    ? '2'
                    : formValues.type === 'price_above' ||
                        formValues.type === 'price_below'
                      ? '100'
                      : '5'
                }
              />
            </div>
            {formError ? (
              <div className='text-destructive text-sm'>{formError}</div>
            ) : null}
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit'>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
