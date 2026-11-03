"""Bounded chunking, vector retrieval, and exact-quote validation."""

import math
import re


def chunk_text(text, size=1000, overlap=150):
    cleaned = re.sub(r"\s+", " ", text).strip()
    chunks, start = [], 0
    while start < len(cleaned) and len(chunks) < 30:
        end = min(len(cleaned), start + size)
        if end < len(cleaned):
            space = cleaned.rfind(" ", start, end + 1)
            if space > start + size / 2:
                end = space
        chunks.append(cleaned[start:end])
        if end == len(cleaned):
            break
        start = max(start + 1, end - overlap)
    return chunks


def cosine(a, b):
    if not a or len(a) != len(b):
        return -1
    dot = sum(x * y for x, y in zip(a, b))
    aa = sum(x * x for x in a)
    bb = sum(y * y for y in b)
    return dot / math.sqrt(aa * bb) if aa and bb else -1


def retrieve(vector, candidates, limit=5, threshold=0.35):
    scored = [(cosine(vector, c["embedding"]), c) for c in candidates]
    scored = [
        pair for pair in scored if math.isfinite(pair[0]) and pair[0] >= threshold
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [c for _, c in scored[:limit]]


def validate_evidence(evidence, candidates):
    if not isinstance(evidence, list) or not 1 <= len(evidence) <= 5:
        return False
    return all(
        isinstance(e, dict)
        and isinstance(e.get("quote"), str)
        and 12 <= len(e["quote"].strip()) <= 1500
        and any(c["id"] == e.get("id") and e["quote"] in c["text"] for c in candidates)
        for e in evidence
    )
