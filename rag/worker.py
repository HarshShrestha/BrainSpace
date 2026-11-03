"""Single-request worker invoked privately by the authenticated Express API."""

import json
import sys
from .errors import RagError
from .extraction import fetch_public_text
from .provider import config, embed, generate, verify
from .retrieval import chunk_text, retrieve, validate_evidence

ABSTAIN = {
    "answer": "I couldn’t find enough reliable evidence in your indexed sources to answer that. Try another question or index a relevant source.",
    "sources": [],
    "abstained": True,
}


def index(payload):
    _, model, _ = config()
    pasted = payload.get("text", "").strip()
    text = pasted or fetch_public_text(payload["link"])
    if len(text.strip()) < 80:
        raise RagError(
            422,
            "Not enough readable text. Paste at least 80 characters from the source.",
        )
    chunks = chunk_text(text[:24000])
    vectors = embed(chunks)
    return {
        "model": model,
        "sourceType": "pasted" if pasted else "page",
        "chunks": [{"text": t, "embedding": v} for t, v in zip(chunks, vectors)],
    }


def ask(payload):
    config()
    candidates = payload["candidates"]
    if not candidates:
        return ABSTAIN
    selected = retrieve(embed([payload["question"]], "RETRIEVAL_QUERY")[0], candidates)
    if not selected:
        return ABSTAIN
    result = generate(payload["question"], selected)
    if (
        not isinstance(result, dict)
        or not isinstance(result.get("answer"), str)
        or not result["answer"].strip()
        or len(result["answer"]) > 5000
        or not validate_evidence(result.get("evidence"), selected)
    ):
        return ABSTAIN
    if not verify(
        payload["question"], result["answer"], [e["quote"] for e in result["evidence"]]
    ):
        return ABSTAIN
    sources = []
    for evidence in result["evidence"]:
        candidate = next(c for c in selected if c["id"] == evidence["id"])
        sources.append(
            {
                k: candidate[k]
                for k in ("contentId", "title", "link", "sourceType", "indexedAt")
                if k in candidate
            }
            | {"quote": evidence["quote"]}
        )
    return {"answer": result["answer"], "sources": sources, "abstained": False}


def dispatch(data):
    operation, payload = data["operation"], data["payload"]
    if operation == "index":
        return index(payload)
    if operation == "ask":
        return ask(payload)
    if operation == "evaluate_retrieval":
        return [
            c["contentId"]
            for c in retrieve(embed([payload["question"]], "RETRIEVAL_QUERY")[0], payload["candidates"])
        ]
    raise RagError(400, "Invalid AI operation")


def main():
    try:
        data = json.load(sys.stdin)
        result = {"ok": True, "data": dispatch(data)}
    except RagError as err:
        result = {"ok": False, "status": err.status, "message": err.message}
    except Exception:
        result = {
            "ok": False,
            "status": 500,
            "message": "AI processing failed. Please try again.",
        }
    print(json.dumps(result, allow_nan=False), flush=True)


if __name__ == "__main__":
    main()
