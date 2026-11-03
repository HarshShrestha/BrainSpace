export interface Candidate {
  id: string;
  contentId: string;
  title: string;
  link: string;
  text: string;
  embedding: number[];
  sourceType?: "page" | "pasted";
  indexedAt?: Date;
}
export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length && chunks.length < 30) {
    let end = Math.min(cleaned.length, start + size);
    if (end < cleaned.length) {
      const space = cleaned.lastIndexOf(" ", end);
      if (space > start + size / 2) end = space;
    }
    chunks.push(cleaned.slice(start, end));
    if (end === cleaned.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}
export function cosine(a: number[], b: number[]): number {
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
export function retrieve(
  questionVector: number[],
  candidates: Candidate[],
  limit = 5,
  threshold = 0.35,
): Candidate[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: cosine(questionVector, candidate.embedding),
    }))
    .filter((x) => Number.isFinite(x.score) && x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.candidate);
}
export type Evidence = { id: string; quote: string };
export function validateEvidence(
  evidence: Evidence[],
  candidates: Candidate[],
): boolean {
  if (!evidence.length || evidence.length > 5) return false;
  return evidence.every(
    (e) =>
      e.quote.trim().length >= 12 &&
      candidates.some((c) => c.id === e.id && c.text.includes(e.quote)),
  );
}
