"""Test-only OpenAI HTTP simulator; never imported by the production runtime."""

import io
import json
import urllib.request


def fake_urlopen(req, timeout=None):
    url = req.full_url
    if not url.startswith("https://api.openai.com/v1/"):
        raise AssertionError("Unexpected network call in Python provider test")
    body = json.loads(req.data)
    if url.endswith("/embeddings"):
        result = {
            "data": [
                {
                    "index": i,
                    "embedding": [0, 1] if "unrelated question" in text else [1, 0],
                }
                for i, text in enumerate(body["input"])
            ]
        }
    elif url.endswith("/chat/completions"):
        payload = json.loads(body["messages"][1]["content"])
        if body["response_format"]["json_schema"]["name"] == "support_check":
            result_data = {"supported": "unsupported" not in payload["question"]}
        else:
            question = payload["question"]
            source = payload["sources"][0]
            if "The example uses blue cards for each source." in source["text"]:
                answer, quote = (
                    "The example uses blue cards.",
                    "The example uses blue cards for each source.",
                )
            else:
                answer, quote = (
                    "The project uses blue cards.",
                    "The project uses blue cards for each source.",
                )
            if "invent" in question:
                quote = "This quotation is fabricated."
            result_data = {
                "answer": answer,
                "evidence": [{"id": source["id"], "quote": quote}],
            }
        result = {"choices": [{"message": {"content": json.dumps(result_data)}}]}
    else:
        raise AssertionError("Unexpected provider endpoint")
    return io.BytesIO(json.dumps(result).encode())


urllib.request.urlopen = fake_urlopen
