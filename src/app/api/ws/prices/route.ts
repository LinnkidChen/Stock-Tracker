export const runtime = 'edge';

function seedRand(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export async function GET(request: Request) {
  const upgradeHeader = request.headers.get('upgrade') || '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 400 });
  }

  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  const subs = new Set<string>();
  const rand = seedRand(Date.now() % 1000);

  server.accept();

  let interval: any = null;

  function startTicker() {
    if (interval) return;
    interval = setInterval(() => {
      subs.forEach((symbol) => {
        const base = 100 + Math.floor(rand() * 50);
        const change = (rand() - 0.5) * 2;
        const price = Math.max(1, base + change);
        const payload = {
          type: 'price_update',
          symbol,
          price: Number(price.toFixed(2)),
          ts: Date.now()
        };
        try {
          server.send(JSON.stringify(payload));
        } catch {}
      });
    }, 1500);
  }

  function stopTicker() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  server.addEventListener('message', (event: any) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg?.type === 'subscribe' && typeof msg.symbol === 'string') {
        subs.add(String(msg.symbol).toUpperCase());
        startTicker();
        server.send(JSON.stringify({ type: 'subscribed', symbol: msg.symbol }));
      } else if (
        msg?.type === 'unsubscribe' &&
        typeof msg.symbol === 'string'
      ) {
        subs.delete(String(msg.symbol).toUpperCase());
        if (subs.size === 0) stopTicker();
        server.send(
          JSON.stringify({ type: 'unsubscribed', symbol: msg.symbol })
        );
      } else if (msg?.type === 'ping') {
        server.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      }
    } catch {
      server.send(
        JSON.stringify({ type: 'error', message: 'Invalid message' })
      );
    }
  });

  server.addEventListener('close', () => {
    stopTicker();
  });

  return new Response(null, { status: 101, webSocket: client });
}
