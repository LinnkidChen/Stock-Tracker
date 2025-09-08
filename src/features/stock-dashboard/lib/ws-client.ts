type Message = any;

export type WsEvents = {
  onOpen?: () => void;
  onClose?: (ev?: CloseEvent) => void;
  onError?: (ev?: Event) => void;
  onMessage?: (data: Message) => void;
};

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 15_000;
  private queue: string[] = [];
  private events: WsEvents;
  private timer: any = null;
  private closedByUser = false;

  constructor(url: string, events: WsEvents = {}) {
    this.url = url;
    this.events = events;
  }

  connect() {
    if (typeof window === 'undefined') return;
    this.closedByUser = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flush();
      this.events.onOpen?.();
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as any);
        this.events.onMessage?.(data);
      } catch {
        // ignore non-JSON messages
      }
    };

    this.ws.onerror = (ev) => {
      this.events.onError?.(ev);
    };

    this.ws.onclose = (ev) => {
      this.events.onClose?.(ev);
      this.ws = null;
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.timer) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts++),
      this.maxReconnectDelay
    );
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }

  private flush() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.queue.length) {
      const msg = this.queue.shift()!;
      this.ws.send(msg);
    }
  }

  send(obj: any) {
    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(msg);
    else this.queue.push(msg);
  }

  subscribe(symbol: string) {
    this.send({ type: 'subscribe', symbol });
  }

  unsubscribe(symbol: string) {
    this.send({ type: 'unsubscribe', symbol });
  }

  close() {
    this.closedByUser = true;
    if (this.ws) this.ws.close();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
