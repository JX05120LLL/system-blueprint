export class LayoutScheduler<State, Result> {
  revision = 0;
  committedRevision = 0;
  runs = 0;
  private running = false;
  private pending?: { state: State; revision: number };
  private error: unknown;
  private waiters: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  constructor(private run: (state: State) => Promise<Result>, private commit: (result: Result, state: State, revision: number) => void, private fail: (error: unknown) => void = () => {}) {}
  request(state: State): void {
    this.error = undefined;
    this.pending = { state, revision: ++this.revision };
    if (!this.running) void this.pump();
  }
  whenIdle(): Promise<void> {
    if (!this.running && !this.pending) return this.error ? Promise.reject(this.error) : Promise.resolve();
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }
  private async pump() {
    this.running = true;
    while (this.pending) {
      const job = this.pending; this.pending = undefined; this.runs++;
      try {
        const result = await this.run(job.state);
        if (job.revision === this.revision) { this.commit(result, job.state, job.revision); this.committedRevision = job.revision; this.error = undefined; }
      } catch (error) {
        if (job.revision === this.revision) { this.error = error; this.fail(error); }
      }
    }
    this.running = false;
    for (const waiter of this.waiters.splice(0)) this.error ? waiter.reject(this.error) : waiter.resolve();
  }
}
