/** Vector scoring done in-process so only the top excerpts are sent to the Python worker. */
export const RETRIEVAL_LIMIT = 5;
export const RETRIEVAL_THRESHOLD = 0.35;

export function cosine(a: readonly number[], b: readonly number[]) {
  if (!a.length || a.length !== b.length) return -1;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!,
      y = b[i]!;
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : -1;
}

/** Keeps the best `limit` items scoring at or above `threshold`, highest first, in O(limit) memory. */
export class TopK<T> {
  private items: { score: number; item: T }[] = [];
  constructor(
    private limit = RETRIEVAL_LIMIT,
    private threshold = RETRIEVAL_THRESHOLD,
  ) {}
  offer(score: number, item: T) {
    if (!Number.isFinite(score) || score < this.threshold) return;
    const full = this.items.length >= this.limit;
    if (full && score <= this.items[this.items.length - 1]!.score) return;
    let i = this.items.findIndex((entry) => score > entry.score);
    if (i === -1) i = this.items.length;
    this.items.splice(i, 0, { score, item });
    if (this.items.length > this.limit) this.items.pop();
  }
  results() {
    return this.items.map((entry) => entry.item);
  }
}
