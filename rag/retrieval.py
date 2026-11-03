"""Bounded chunking and exact-quote validation. Vector scoring lives in the API (src/services/rag/retrieval.ts)."""

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
