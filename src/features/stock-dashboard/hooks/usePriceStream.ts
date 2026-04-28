'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WatchlistPricesMap } from '@/types/stocks';
import { useDashboardStore } from '../store';
import { WebSocketClient } from '../lib/ws-client';

interface PriceUpdateMessage {
  type: 'price_update';
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  ts: number;
  lastUpdated?: string;
}

interface StreamErrorMessage {
  type: 'error';
  symbol?: string;
  message?: string;
}

type StreamMessage = PriceUpdateMessage | StreamErrorMessage;

export interface UsePriceStreamResult {
  pricesMap: WatchlistPricesMap;
  errorSymbols: string[];
  isConnected: boolean;
}

export function usePriceStream(
  symbols: string[],
  provider: string
): UsePriceStreamResult {
  const clientRef = useRef<WebSocketClient | null>(null);
  const previousSymbolsRef = useRef<string[]>([]);
  const [pricesMap, setPricesMap] = useState<WatchlistPricesMap>({});
  const [errorSymbols, setErrorSymbols] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const setWsConnected = useDashboardStore((state) => state.setWsConnected);

  const normalizedSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
        )
      ),
    [symbols]
  );
  const symbolsKey = normalizedSymbols.join('|');
  const hasSymbols = normalizedSymbols.length > 0;

  useEffect(() => {
    if (
      !hasSymbols ||
      typeof window === 'undefined' ||
      typeof WebSocket === 'undefined'
    ) {
      setIsConnected(false);
      setWsConnected(false);
      return;
    }

    const client = new WebSocketClient(createStreamUrl(provider), {
      onOpen: () => {
        setIsConnected(true);
        setWsConnected(true);
      },
      onClose: () => {
        setIsConnected(false);
        setWsConnected(false);
      },
      onError: () => {
        setIsConnected(false);
        setWsConnected(false);
      },
      onMessage: (message: StreamMessage) => {
        if (message?.type === 'price_update') {
          const symbol = normalizeSymbol(message.symbol);
          if (!symbol) return;

          setPricesMap((current) => ({
            ...current,
            [symbol]: {
              price: Number(message.price),
              change: Number(message.change),
              changePercent: Number(message.changePercent),
              lastUpdated: new Date(message.lastUpdated ?? message.ts)
            }
          }));
          setErrorSymbols((current) =>
            current.filter((candidate) => candidate !== symbol)
          );
        } else if (message?.type === 'error' && message.symbol) {
          const symbol = normalizeSymbol(message.symbol);
          if (!symbol) return;

          setErrorSymbols((current) =>
            current.includes(symbol) ? current : [...current, symbol]
          );
        }
      }
    });

    clientRef.current = client;
    previousSymbolsRef.current = [];
    client.connect();

    return () => {
      client.close();
      clientRef.current = null;
      previousSymbolsRef.current = [];
      setIsConnected(false);
      setWsConnected(false);
    };
  }, [hasSymbols, provider, setWsConnected]);

  useEffect(() => {
    const client = clientRef.current;
    const previousSymbols = previousSymbolsRef.current;
    const previousSet = new Set(previousSymbols);
    const nextSet = new Set(normalizedSymbols);

    previousSymbols
      .filter((symbol) => !nextSet.has(symbol))
      .forEach((symbol) => {
        client?.unsubscribe(symbol);
      });

    normalizedSymbols
      .filter((symbol) => !previousSet.has(symbol))
      .forEach((symbol) => {
        client?.subscribe(symbol);
      });

    previousSymbolsRef.current = normalizedSymbols;

    setPricesMap((current) => {
      const nextPrices: WatchlistPricesMap = {};
      normalizedSymbols.forEach((symbol) => {
        if (current[symbol]) {
          nextPrices[symbol] = current[symbol];
        }
      });
      return nextPrices;
    });
    setErrorSymbols((current) =>
      current.filter((symbol) => nextSet.has(symbol))
    );
  }, [normalizedSymbols, symbolsKey]);

  return {
    pricesMap,
    errorSymbols,
    isConnected
  };
}

function createStreamUrl(provider: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ provider });

  return `${protocol}//${window.location.host}/api/ws/prices?${params}`;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
