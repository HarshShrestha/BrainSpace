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

    def test_retrieval_and_exact_citations(self):
        sources = [
            {
                "id": "S1",
                "text": "The blue whale is the largest known animal.",
                "embedding": [1, 0],
            },
            {"id": "S2", "text": "Music has rhythm.", "embedding": [0, 1]},
        ]
        self.assertEqual(retrieval.retrieve([1, 0], sources, 1)[0]["id"], "S1")
        self.assertEqual(retrieval.retrieve([-1, 0], sources), [])
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
    @patch.dict("os.environ", {"RAG_ENABLED": "true", "OPENAI_API_KEY": "test-only"})
    def test_invalid_vectors_fail_closed(self, request):
        request.return_value = {"data": [{"index": 0, "embedding": [float("nan")]}]}
        with self.assertRaises(RagError):
            provider.embed(["hello"])

    @patch("rag.worker.verify", return_value=False)
    @patch(
        "rag.worker.generate",
        return_value={
            "answer": "The answer.",
            "evidence": [{"id": "S1", "quote": "A sufficiently long quotation."}],
        },
    )
    @patch("rag.worker.embed", return_value=[[1, 0]])
    @patch.dict("os.environ", {"RAG_ENABLED": "true", "OPENAI_API_KEY": "test-only"})
    def test_rejects_unsupported_answers(self, _embed, _generate, _verify):
        candidate = {
            "id": "S1",
            "text": "A sufficiently long quotation.",
            "embedding": [1, 0],
        }
        self.assertTrue(
            worker.ask({"question": "question?", "candidates": [candidate]})[
                "abstained"
            ]
        )


if __name__ == "__main__":
    unittest.main()
