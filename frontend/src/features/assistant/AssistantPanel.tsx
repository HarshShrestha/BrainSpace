import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../services/api";
import type { RagAnswer, RagStatus } from "../../types";
interface Exchange {
  question: string;
  result: RagAnswer;
}
export function AssistantPanel({ revision }: { revision: number }) {
  const [status, setStatus] = useState<RagStatus | null>(null),
    [statusError, setStatusError] = useState(false),
    [error, setError] = useState(""),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState<Exchange[]>([]);
  useEffect(() => {
    let alive = true;
    setStatusError(false);
    api
      .assistantStatus()
      .then((v) => {
        if (alive) setStatus(v);
      })
      .catch(() => {
        if (alive) {
          setStatus(null);
          setStatusError(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [revision]);
  useEffect(() => {
    setMessages([]);
  }, [revision]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.ask(q);
      setMessages((prev) => [...prev, { question: q, result }]);
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="assistant-panel" aria-labelledby="assistant-title">
      <div className="assistant-heading">
        <h2 id="assistant-title">Ask your space</h2>
        <p>Answers from your indexed sources.</p>
        <div className="assistant-count">
          {status?.compatible ?? 0}{" "}
          {(status?.compatible ?? 0) === 1 ? "source" : "sources"} ready
        </div>
      </div>
      <div className="assistant-body">
        {statusError ? (
          <p className="assistant-hint" role="alert">
            Could not check AI availability. Refresh the page to try again.
          </p>
        ) : !status ? (
          <p className="assistant-hint">Checking AI availability…</p>
        ) : !status.configured ? (
          <p className="assistant-hint">
            AI search isn’t configured yet. An administrator can enable it in
            the server environment.
          </p>
        ) : status.compatible === 0 ? (
          <p className="assistant-hint">
            Index a saved source to begin. Choose “Index for AI” beside a source
            in the sidebar.
          </p>
        ) : (
          <p className="assistant-hint">
            Check the evidence; answers can be incomplete or wrong.
          </p>
        )}
        {status && status.indexed > status.compatible && (
          <p className="assistant-hint">
            Some sources need reindexing because the embedding model changed.
          </p>
        )}
        {messages.length > 0 && (
          <div className="chat-history" aria-live="polite">
            {messages.map((m, index) => (
              <div className="exchange" key={index}>
                <div className="question-bubble">{m.question}</div>
                <div className="answer-bubble">
                  <span className="answer-label">BRAINSPACE</span>
                  <p>{m.result.answer}</p>
                  {m.result.sources.length > 0 && (
                    <div className="evidence">
                      <strong>Sources &amp; evidence</strong>
                      {m.result.sources.map((source, i) => (
                        <div
                          className="evidence-item"
                          key={`${source.contentId}-${i}`}
                        >
                          <a
                            href={source.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {source.title}
                          </a>
                          <p className="source-provenance">
                            {source.sourceType === "pasted"
                              ? "Pasted text — not verified against the linked page"
                              : source.sourceType === "page"
                                ? "Extracted page text"
                                : "Source origin unavailable"}
                            {source.indexedAt
                              ? ` · indexed ${new Date(source.indexedAt).toLocaleDateString()}`
                              : ""}
                          </p>
                          <blockquote>“{source.quote}”</blockquote>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <form className="ask-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="ask-space">
            Ask a question about your indexed sources
          </label>
          <input
            id="ask-space"
            value={question}
            minLength={3}
            maxLength={1000}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your space…"
            disabled={!status?.configured || !status.compatible || busy}
          />
          <button
            type="submit"
            disabled={
              !status?.configured ||
              !status.compatible ||
              busy ||
              question.trim().length < 3
            }
            aria-label="Ask question"
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </form>
        <p className="privacy-note">
          Questions and excerpts go to the AI provider. Each question is
          independent.
        </p>
      </div>
    </section>
  );
}
