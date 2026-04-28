import { LongbridgeRequestGuard } from '../longbridge-request-guard';

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('LongbridgeRequestGuard', () => {
  it('limits concurrent operations and queues excess work', async () => {
    let now = 0;
    const sleepResolvers: Array<() => void> = [];
    const sleep = jest.fn(
      (ms: number) =>
        new Promise<void>((resolve) => {
          sleepResolvers.push(() => {
            now += ms;
            resolve();
          });
        })
    );
    const guard = new LongbridgeRequestGuard({
      maxConcurrent: 2,
      maxStartsPerWindow: 100,
      queueTimeoutMs: 100,
      concurrencyPollMs: 1,
      now: () => now,
      sleep
    });
    const first = createDeferred();
    const second = createDeferred();
    let active = 0;
    let maxActive = 0;
    let thirdStarted = false;

    const runBlockingOperation = (
      deferred: ReturnType<typeof createDeferred>
    ) =>
      guard.run(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await deferred.promise;
        active -= 1;
      });

    const firstRun = runBlockingOperation(first);
    const secondRun = runBlockingOperation(second);
    const thirdRun = guard.run(async () => {
      thirdStarted = true;
      active += 1;
      maxActive = Math.max(maxActive, active);
      active -= 1;
    });

    await flushPromises();

    expect(active).toBe(2);
    expect(thirdStarted).toBe(false);

    first.resolve();
    await flushPromises();
    sleepResolvers.shift()?.();
    await flushPromises();

    expect(thirdStarted).toBe(true);
    expect(maxActive).toBe(2);

    second.resolve();
    await Promise.all([firstRun, secondRun, thirdRun]);
  });

  it('limits operation starts per window', async () => {
    let now = 0;
    const sleep = jest.fn(async (ms: number) => {
      now += ms;
    });
    const guard = new LongbridgeRequestGuard({
      maxConcurrent: 10,
      maxStartsPerWindow: 2,
      windowMs: 1000,
      now: () => now,
      sleep
    });

    await guard.run(async () => 'first');
    await guard.run(async () => 'second');
    const startedAt = await guard.run(async () => now);

    expect(sleep).toHaveBeenCalledWith(1000);
    expect(startedAt).toBe(1000);
  });

  it('fails queued work when the queue is full', async () => {
    let now = 0;
    const sleepResolvers: Array<() => void> = [];
    const sleep = jest.fn(
      (ms: number) =>
        new Promise<void>((resolve) => {
          sleepResolvers.push(() => {
            now += ms;
            resolve();
          });
        })
    );
    const guard = new LongbridgeRequestGuard({
      maxConcurrent: 1,
      maxStartsPerWindow: 100,
      queueLimit: 1,
      queueTimeoutMs: 100,
      now: () => now,
      sleep
    });
    const first = createDeferred();

    const firstRun = guard.run(async () => {
      await first.promise;
    });

    await flushPromises();

    const secondRun = guard.run(async () => undefined);
    await flushPromises();

    await expect(guard.run(async () => undefined)).rejects.toMatchObject({
      code: 'API_LIMIT_EXCEEDED',
      details: {
        source: 'longbridge-request-guard',
        reason: 'queue-full'
      }
    });

    first.resolve();
    await flushPromises();
    sleepResolvers.shift()?.();
    await Promise.all([firstRun, secondRun]);
  });
});
