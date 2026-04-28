import { createClient } from '../supabase/server';
import type {
  WatchlistAlert,
  WatchlistAlertInput,
  WatchlistAlertStatus,
  WatchlistAlertTrigger,
  WatchlistAlertType
} from '@/types/alerts';

const ALERT_COLUMNS =
  'id,clerk_user_id,symbol,alert_type,threshold,status,last_triggered_at,created_at,updated_at';
const TRIGGER_COLUMNS =
  'id,alert_id,clerk_user_id,symbol,alert_type,threshold,observed_value,observed_price,message,triggered_at';

interface WatchlistAlertRow {
  id: string;
  clerk_user_id: string;
  symbol: string;
  alert_type: WatchlistAlertType;
  threshold: number | string;
  status: WatchlistAlertStatus;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WatchlistAlertTriggerRow {
  id: string;
  alert_id: string;
  clerk_user_id: string;
  symbol: string;
  alert_type: WatchlistAlertType;
  threshold: number | string;
  observed_value: number | string;
  observed_price: number | string | null;
  message: string;
  triggered_at: string;
}

export interface WatchlistAlertTriggerInput {
  alertId: string;
  observedValue: number;
  observedPrice?: number | null;
  message: string;
  triggeredAt?: string;
}

export class WatchlistAlertStorageError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'WatchlistAlertStorageError';
  }
}

export class WatchlistAlertNotFoundError extends WatchlistAlertStorageError {
  constructor(originalError?: any) {
    super('Watchlist alert not found', originalError);
    this.name = 'WatchlistAlertNotFoundError';
  }
}

export class WatchlistAlertNotActiveError extends WatchlistAlertStorageError {
  constructor() {
    super('Watchlist alert is not active');
    this.name = 'WatchlistAlertNotActiveError';
  }
}

function isNotFoundError(error: any): boolean {
  return (
    error?.code === 'PGRST116' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('no rows')
  );
}

function mapAlert(row: WatchlistAlertRow): WatchlistAlert {
  return {
    id: row.id,
    symbol: String(row.symbol).toUpperCase(),
    type: row.alert_type,
    threshold: Number(row.threshold),
    status: row.status,
    lastTriggeredAt: row.last_triggered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTrigger(row: WatchlistAlertTriggerRow): WatchlistAlertTrigger {
  return {
    id: row.id,
    alertId: row.alert_id,
    symbol: String(row.symbol).toUpperCase(),
    type: row.alert_type,
    threshold: Number(row.threshold),
    observedValue: Number(row.observed_value),
    observedPrice:
      row.observed_price === null || row.observed_price === undefined
        ? null
        : Number(row.observed_price),
    message: row.message,
    triggeredAt: row.triggered_at
  };
}

export async function getWatchlistAlerts(
  userId: string
): Promise<WatchlistAlert[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_watchlist_alerts')
    .select(ALERT_COLUMNS)
    .eq('clerk_user_id', userId)
    .order('symbol', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new WatchlistAlertStorageError(
      'Failed to fetch watchlist alerts',
      error
    );
  }

  return ((data ?? []) as WatchlistAlertRow[]).map(mapAlert);
}

export async function getWatchlistAlertTriggers(
  userId: string,
  limit = 25
): Promise<WatchlistAlertTrigger[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_watchlist_alert_triggers')
    .select(TRIGGER_COLUMNS)
    .eq('clerk_user_id', userId)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new WatchlistAlertStorageError(
      'Failed to fetch watchlist alert triggers',
      error
    );
  }

  return ((data ?? []) as WatchlistAlertTriggerRow[]).map(mapTrigger);
}

export async function createWatchlistAlert(
  userId: string,
  input: WatchlistAlertInput
): Promise<WatchlistAlert> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_watchlist_alerts')
    .insert({
      clerk_user_id: userId,
      symbol: input.symbol.toUpperCase(),
      alert_type: input.type,
      threshold: input.threshold,
      status: 'active'
    })
    .select(ALERT_COLUMNS)
    .single();

  if (error) {
    throw new WatchlistAlertStorageError(
      'Failed to create watchlist alert',
      error
    );
  }

  return mapAlert(data as WatchlistAlertRow);
}

export async function updateWatchlistAlert(
  userId: string,
  id: string,
  input: Partial<
    Pick<WatchlistAlertInput, 'threshold' | 'type'> & {
      status: WatchlistAlertStatus;
      lastTriggeredAt: string | null;
    }
  >
): Promise<WatchlistAlert> {
  const supabase = await createClient();
  const updates: Record<string, string | number | null> = {};

  if (input.type !== undefined) {
    updates.alert_type = input.type;
  }
  if (input.threshold !== undefined) {
    updates.threshold = input.threshold;
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }
  if (input.lastTriggeredAt !== undefined) {
    updates.last_triggered_at = input.lastTriggeredAt;
  }

  const { data, error } = await supabase
    .from('stock_watchlist_alerts')
    .update(updates)
    .eq('clerk_user_id', userId)
    .eq('id', id)
    .select(ALERT_COLUMNS)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      throw new WatchlistAlertNotFoundError(error);
    }

    throw new WatchlistAlertStorageError(
      'Failed to update watchlist alert',
      error
    );
  }

  return mapAlert(data as WatchlistAlertRow);
}

export async function deleteWatchlistAlert(
  userId: string,
  id: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('stock_watchlist_alerts')
    .delete()
    .eq('clerk_user_id', userId)
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      throw new WatchlistAlertNotFoundError(error);
    }

    throw new WatchlistAlertStorageError(
      'Failed to delete watchlist alert',
      error
    );
  }
}

export async function recordWatchlistAlertTrigger(
  userId: string,
  input: WatchlistAlertTriggerInput
): Promise<{ alert: WatchlistAlert; trigger: WatchlistAlertTrigger }> {
  const supabase = await createClient();
  const triggeredAt = input.triggeredAt ?? new Date().toISOString();

  const { data: alertData, error: alertError } = await supabase
    .from('stock_watchlist_alerts')
    .select(ALERT_COLUMNS)
    .eq('clerk_user_id', userId)
    .eq('id', input.alertId)
    .single();

  if (alertError) {
    if (isNotFoundError(alertError)) {
      throw new WatchlistAlertNotFoundError(alertError);
    }

    throw new WatchlistAlertStorageError(
      'Failed to fetch watchlist alert',
      alertError
    );
  }

  const alert = mapAlert(alertData as WatchlistAlertRow);
  if (alert.status !== 'active') {
    throw new WatchlistAlertNotActiveError();
  }

  const { data: triggerData, error: triggerError } = await supabase
    .from('stock_watchlist_alert_triggers')
    .insert({
      alert_id: alert.id,
      clerk_user_id: userId,
      symbol: alert.symbol,
      alert_type: alert.type,
      threshold: alert.threshold,
      observed_value: input.observedValue,
      observed_price: input.observedPrice ?? null,
      message: input.message,
      triggered_at: triggeredAt
    })
    .select(TRIGGER_COLUMNS)
    .single();

  if (triggerError) {
    throw new WatchlistAlertStorageError(
      'Failed to record watchlist alert trigger',
      triggerError
    );
  }

  const updatedAlert = await updateWatchlistAlert(userId, alert.id, {
    status: 'triggered',
    lastTriggeredAt: triggeredAt
  });

  return {
    alert: updatedAlert,
    trigger: mapTrigger(triggerData as WatchlistAlertTriggerRow)
  };
}
