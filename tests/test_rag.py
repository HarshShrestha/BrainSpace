import io
import json
import unittest
from unittest.mock import patch
from rag import extraction, provider, retrieval, worker
from rag.errors import RagError


class RetrievalTests(unittest.TestCase):
    def test_chunk_overlap(self):
        chunks = retrieval.chunk_text("one two three four " * 150, 180, 30)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(0 < len(chunk) <= 180 for chunk in chunks))
        self.assertEqual(chunks[0][-15:], chunks[1][15:30])

    def test_exact_citations(self):
        sources = [
            {
                "id": "S1",
                "text": "The blue whale is the largest known animal.",
                "embedding": [1, 0],
            },
            {"id": "S2", "text": "Music has rhythm.", "embedding": [0, 1]},
        ]
        self.assertTrue(
            retrieval.validate_evidence(
                [{"id": "S1", "quote": "largest known animal"}], sources
            )
        )
        for invalid in [
            [],
            [{"id": "S2", "quote": "largest known animal"}],
            [{"id": "S1", "quote": "invented facts never exist"}],
            [{"id": "S1", "quote": "whale"}],
        ]:
            self.assertFalse(retrieval.validate_evidence(invalid, sources))

    def test_addresses_and_ports_blocked(self):
        for ip in [
            "127.0.0.1",
            "169.254.169.254",
            "10.2.3.4",
            "::1",
            "::ffff:127.0.0.1",
            "fc00::1",
        ]:
            self.assertFalse(extraction.is_public_address(ip), ip)
        self.assertTrue(extraction.is_public_address("8.8.8.8"))
        for url in [
            "http://127.0.0.1/",
            "http://169.254.169.254/",
            "http://[::1]/",
            "http://example.com:8080/",
        ]:
            with self.assertRaises(RagError):
                extraction.fetch_public_text(url)

    @patch("rag.extraction.socket.create_connection")
    @patch("rag.extraction.socket.getaddrinfo")
    def test_mixed_dns_answers_fail_before_connecting(self, dns, connect):
        dns.return_value = [
            (0, 0, 0, "", ("8.8.8.8", 80)),
            (0, 0, 0, "", ("127.0.0.1", 80)),
        ]
        with self.assertRaises(RagError):
            extraction.fetch_public_text("http://example.com/")
        connect.assert_not_called()

    @patch("rag.extraction.http.client.HTTPConnection")
    @patch("rag.extraction.socket.create_connection")
    @patch("rag.extraction.socket.getaddrinfo")
    def test_redirect_to_private_network_is_rejected(self, dns, connect, connection):
        dns.side_effect = [
            [(0, 0, 0, "", ("8.8.8.8", 80))],
            [(0, 0, 0, "", ("169.254.169.254", 80))],
        ]
        response = connection.return_value.getresponse.return_value
        response.status = 302
        response.getheader.return_value = "http://169.254.169.254/latest/meta-data/"
        with self.assertRaises(RagError):
            extraction.fetch_public_text("http://example.com/")
        self.assertEqual(connect.call_count, 1)

    def test_hidden_html_and_void_elements(self):
        parser = extraction.TextParser()
        parser.feed(
            '<nav><img src="x">hidden</nav><main>Hello<script>bad</script> world</main>'
        )
        self.assertEqual(" ".join(parser.text), "Hello  world")

    @patch("rag.provider.request")
    @patch.dict("os.environ", {"RAG_ENABLED": "true", "GEMINI_API_KEY": "test-only"})
    def test_invalid_vectors_fail_closed(self, request):
        request.return_value = {"embeddings": [{"values": [float("nan")]}]}
        with self.assertRaises(RagError):
            provider.embed(["hello"])

    @patch("rag.provider.request")
    @patch.dict("os.environ", {"RAG_ENABLED": "true", "GEMINI_API_KEY": "test-only", "GEMINI_EMBEDDING_MODEL": "gemini-embedding-001", "GEMINI_CHAT_MODEL": "gemini-3.8-flash"})
    def test_gemini_request_contracts(self, request):
        request.return_value = {"embeddings": [{"values": [0.5, 0.2]}]}
        self.assertEqual(provider.embed(["hello"], "RETRIEVAL_QUERY"), [[0.5, 0.2]])
        path, body = request.call_args.args
        self.assertEqual(path, "gemini-embedding-001:batchEmbedContents")
        self.assertEqual(body["requests"][0]["taskType"], "RETRIEVAL_QUERY")
        self.assertEqual(body["requests"][0]["outputDimensionality"], 768)
        request.return_value = {"candidates": [{"content": {"parts": [{"text": '{"supported":true}'}]}}]}
        self.assertTrue(provider.verify("q", "a", ["evidence"]))
        path, body = request.call_args.args
        self.assertEqual(path, "gemini-3.8-flash:generateContent")
        self.assertEqual(body["generationConfig"]["responseFormat"]["text"]["mimeType"], "APPLICATION_JSON")

    @patch("rag.worker.verify", return_value=False)
    @patch(
        "rag.worker.generate",
        return_value={
            "answer": "The answer.",
            "evidence": [{"id": "S1", "quote": "A sufficiently long quotation."}],
        },
    )
    @patch.dict("os.environ", {"RAG_ENABLED": "true", "GEMINI_API_KEY": "test-only"})
    def test_rejects_unsupported_answers(self, _generate, _verify):
        candidate = {"id": "S1", "text": "A sufficiently long quotation."}
        self.assertTrue(
            worker.answer({"question": "question?", "candidates": [candidate]})[
                "abstained"
            ]
        )



class ExtractionRegressionTests(unittest.TestCase):
    body = "Article text that should be indexed. " * 4

    def test_page_wrapped_in_form_is_readable(self):
        html = f'<form id="aspnetForm"><nav>Menu</nav><p>{self.body}</p><button>Go</button></form>'
        text = " ".join(extraction.html_text(html).split())
        self.assertIn("Article text", text)
        self.assertNotIn("Menu", text)
        self.assertNotIn("Go", text)

    def test_unclosed_header_falls_back_to_all_non_code_text(self):
        html = f"<header><h1>Site</h1><p>{self.body}</p><script>bad()</script>"
        text = extraction.html_text(html)
        self.assertIn("Article text", text)
        self.assertNotIn("bad()", text)

    def test_declared_charset_is_used(self):
        latin1 = "café".encode("latin-1")
        self.assertEqual(latin1.decode(extraction.charset("text/plain; charset=ISO-8859-1")), "café")
        self.assertEqual(extraction.charset('text/html; charset="utf-8"'), "utf-8")
        self.assertEqual(extraction.charset("text/html; charset=bogus"), "utf-8")
        self.assertEqual(extraction.charset(None), "utf-8")

    def test_multicast_and_nat64_private_targets_blocked(self):
        for ip in ["224.0.0.1", "ff02::1", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "64:ff9b:1::a00:1"]:
            self.assertFalse(extraction.is_public_address(ip), ip)
        self.assertTrue(extraction.is_public_address("64:ff9b::808:808"))

if __name__ == "__main__":
    unittest.main()
