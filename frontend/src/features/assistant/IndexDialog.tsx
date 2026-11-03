import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import { api } from "../../services/api";
import type { Content } from "../../types";
export function IndexDialog({
  item,
  onClose,
  onIndexed,
}: {
  item: Content;
  onClose: () => void;
  onIndexed: () => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.indexContent(item._id, text);
      await onIndexed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not index this source");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api.removeIndex(item._id);
      await onIndexed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove index");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal titleId="index-title" onClose={onClose}>
      <div className="dialog-head">
        <div>
          <span className="eyebrow">TEACH YOUR SPACE</span>
          <h2 id="index-title">Index this source</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="muted">{item.title}</p>
      <p className="muted">
        Leave the text box empty to read the public page, or paste text or a
        transcript for private, blocked or unsupported sources. Only the first
        24,000 characters are indexed.
      </p>
      <form onSubmit={submit}>
        <label>
          Source text <span className="label-note">optional</span>
          <textarea
            value={text}
            maxLength={24000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste source text here…"
            rows={6}
          />
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />{" "}
          <span>
            I understand this text will be sent to the configured AI provider
            and may incur charges.
          </span>
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {item.rag?.indexedAt && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={remove}
            >
              Remove AI index
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !consent}>
            {busy ? "Indexing…" : "Index source"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
