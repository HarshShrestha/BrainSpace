import { describe, it, expect } from "vitest";
import {
  chunkText,
  cosine,
  retrieve,
  validateEvidence,
  type Candidate,
} from "../src/services/rag/retrieval.js";
import {
  isPublicAddress,
  fetchPublicText,
} from "../src/services/rag/extraction.js";
const source = (id: string, text: string, embedding: number[]): Candidate => ({
  id,
  contentId: id,
  title: id,
  link: "https://example.com",
  text,
  embedding,
});
describe("RAG retrieval and evidence evaluation", () => {
  it("chunks long text with overlap and no empty chunks", () => {
    const parts = chunkText("one two three four ".repeat(150), 180, 30);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length > 0 && p.length <= 180)).toBe(true);
    expect(parts[0]!.slice(-15)).toBe(parts[1]!.slice(15, 30));
  });
  it("retrieves the relevant labelled source in the top results", () => {
    const documents = [
      source("rain", "Rain falls from clouds.", [1, 0]),
      source("music", "Music has rhythm.", [0, 1]),
    ];
    expect(retrieve([1, 0], documents, 1)[0]?.id).toBe("rain");
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(retrieve([-1, 0], documents)).toEqual([]);
  });
  it("rejects invented, misattributed, short, and missing citations", () => {
    const docs = [
      source("S1", "The blue whale is the largest known animal.", [1, 0]),
    ];
    expect(
      validateEvidence([{ id: "S1", quote: "largest known animal" }], docs),
    ).toBe(true);
    expect(
      validateEvidence(
        [{ id: "S1", quote: "invented facts never exist" }],
        docs,
      ),
    ).toBe(false);
    expect(
      validateEvidence([{ id: "S2", quote: "largest known animal" }], docs),
    ).toBe(false);
    expect(validateEvidence([{ id: "S1", quote: "whale" }], docs)).toBe(false);
    expect(validateEvidence([], docs)).toBe(false);
  });
  it("blocks loopback, metadata, local, mapped IPv6 and nonstandard ports", async () => {
    for (const address of [
      "127.0.0.1",
      "169.254.169.254",
      "10.2.3.4",
      "::1",
      "::ffff:127.0.0.1",
      "fc00::1",
    ])
      expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    for (const url of [
      "http://127.0.0.1/",
      "http://169.254.169.254/",
      "http://[::1]/",
      "http://example.com:8080/",
    ])
      await expect(fetchPublicText(url)).rejects.toThrow();
  });
});
