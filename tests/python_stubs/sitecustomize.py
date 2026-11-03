"""Test-only Gemini HTTP simulator; never imported by the production runtime."""
import io
import json
import urllib.request


def fake_urlopen(req, timeout=None):
    url = req.full_url
    if not url.startswith("https://generativelanguage.googleapis.com/v1beta/models/"):
        raise AssertionError("Unexpected network call in Python provider test")
    body = json.loads(req.data)
    if url.endswith(":batchEmbedContents"):
        result = {"embeddings": [{"values": [0, 1] if "unrelated question" in r["content"]["parts"][0]["text"] else [1, 0]} for r in body["requests"]]}
    elif url.endswith(":generateContent"):
        payload = json.loads(body["contents"][0]["parts"][0]["text"])
        if "quotes" in payload:
            result_data = {"supported": "unsupported" not in payload["question"]}
        else:
            question = payload["question"]
            source = payload["sources"][0]
            if "The example uses blue cards for each source." in source["text"]:
                answer, quote = "The example uses blue cards.", "The example uses blue cards for each source."
            else:
                answer, quote = "The project uses blue cards.", "The project uses blue cards for each source."
            if "invent" in question:
                quote = "This quotation is fabricated."
            result_data = {"answer": answer, "evidence": [{"id": source["id"], "quote": quote}]}
        result = {"candidates": [{"content": {"parts": [{"text": json.dumps(result_data)}]}}]}
    else:
        raise AssertionError("Unexpected provider endpoint")
    return io.BytesIO(json.dumps(result).encode())

urllib.request.urlopen = fake_urlopen
