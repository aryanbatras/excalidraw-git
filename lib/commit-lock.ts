// Serialize commits to the same repo so concurrent saves never race the
// GitHub ref update (which would otherwise throw "Update is not a fast
// forward"). Each repo gets its own FIFO queue.
const queues = new Map<string, Promise<unknown>>();

export function withRepoLock<T>(repoKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(repoKey) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(
    repoKey,
    next.catch(() => {
      /* swallow so a failed commit doesn't poison the queue */
    }),
  );
  return next;
}

export function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}
