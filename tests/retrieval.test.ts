import { describe, expect, it } from "vitest";
import { cosine, TopK } from "../src/services/rag/retrieval.js";

describe("cosine", () => {
  it("scores parallel, orthogonal and opposite vectors", () => {
    expect(cosine([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
  it("returns -1 for empty, zero or mismatched vectors", () => {
    expect(cosine([], [])).toBe(-1);
    expect(cosine([0, 0], [1, 0])).toBe(-1);
    expect(cosine([1, 0], [1, 0, 0])).toBe(-1);
  });
});

describe("TopK", () => {
  it("keeps the highest scores at or above the threshold, best first", () => {
    const top = new TopK<string>(3, 0.35);
    for (const [score, id] of [
      [0.5, "a"],
      [0.9, "b"],
      [0.34, "below"],
      [0.35, "edge"],
      [0.7, "c"],
      [Number.NaN, "nan"],
      [0.6, "d"],
    ] as const)
      top.offer(score, id);
    expect(top.results()).toEqual(["b", "c", "d"]);
  });
  it("keeps the earlier item on ties, like a stable sort", () => {
    const top = new TopK<string>(2, 0);
    top.offer(0.5, "first");
    top.offer(0.5, "second");
    top.offer(0.5, "third");
    expect(top.results()).toEqual(["first", "second"]);
  });
  it("returns nothing when no score clears the threshold", () => {
    const top = new TopK<string>();
    top.offer(0.1, "x");
    expect(top.results()).toEqual([]);
  });
});
