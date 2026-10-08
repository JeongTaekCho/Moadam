/** Memory only: this cache belongs to one browser session, never a shared server cache. */
export class RequestCache {
  private values = new Map<string, { value: unknown; expires: number }>();
  private pending = new Map<
    string,
    {
      controller: AbortController;
      promise: Promise<unknown>;
      consumers: number;
    }
  >();
  constructor(private limit = 100) {}

  invalidate() {
    this.values.clear();
    for (const entry of this.pending.values()) entry.controller.abort();
    this.pending.clear();
  }

  async get<T>(
    key: string,
    ttl: number,
    load: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    const cached = this.values.get(key);
    if (cached && cached.expires > Date.now())
      return structuredClone(cached.value) as T;
    this.values.delete(key);
    let entry = this.pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, consumers: 0, promise: Promise.resolve() };
      const current = entry;
      entry.promise = Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted();
          return load(controller.signal);
        })
        .then((value) => {
          controller.signal.throwIfAborted();
          if (ttl > 0 && this.pending.get(key) === current) {
            this.values.set(key, {
              value: structuredClone(value),
              expires: Date.now() + ttl,
            });
            while (this.values.size > this.limit)
              this.values.delete(this.values.keys().next().value!);
          }
          return value;
        })
        .finally(() => {
          if (this.pending.get(key) === current) this.pending.delete(key);
        });
      this.pending.set(key, entry);
    }
    const current = entry;
    current.consumers++;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (value?: unknown, error?: unknown) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", abort);
        current.consumers--;
        if (!current.consumers && this.pending.get(key) === current) {
          current.controller.abort();
          this.pending.delete(key);
        }
        if (error) reject(error);
        else resolve(structuredClone(value) as T);
      };
      const abort = () =>
        finish(
          undefined,
          signal?.reason || new DOMException("Cancelled", "AbortError"),
        );
      signal?.addEventListener("abort", abort, { once: true });
      current.promise.then(
        (value) => finish(value),
        (error) => finish(undefined, error),
      );
      if (signal?.aborted) abort();
    });
  }
}
