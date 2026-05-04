export const WATCHLIST_ALERT_TYPES = [
  'price_above',
  'price_below',
  'percent_move',
  'gap_up',
  'gap_down',
  'volume_spike'
] as const;

export type WatchlistAlertType = (typeof WATCHLIST_ALERT_TYPES)[number];

export const WATCHLIST_ALERT_STATUSES = [
  'active',
  'triggered',
  'paused'
] as const;

export type WatchlistAlertStatus = (typeof WATCHLIST_ALERT_STATUSES)[number];

export interface WatchlistAlert {
  id: string;
  symbol: string;
  type: WatchlistAlertType;
  threshold: number;
  status: WatchlistAlertStatus;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistAlertTrigger {
  id: string;
  alertId: string;
  symbol: string;
  type: WatchlistAlertType;
  threshold: number;
  observedValue: number;
  observedPrice: number | null;
  message: string;
  triggeredAt: string;
}

export interface WatchlistAlertInput {
  symbol: string;
  type: WatchlistAlertType;
  threshold: number;
}
