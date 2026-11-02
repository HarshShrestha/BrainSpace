import { Modal } from "../../components/Modal";
import { useState } from "react";
import { api } from "../../services/api";
export function ShareDialog({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    setMessage("");
    try {
      const { token } = await api.share();
      setLink(`${window.location.origin}/shared/${token}`);
      setMessage("Link created. Anyone with it can view your entire space.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create link");
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setMessage("");
    try {
      await api.revoke();
      setLink("");
      setMessage("Your share link has been revoked.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not revoke link");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copied.");
    } catch {
      setMessage("Select and copy the link manually.");
    }
  }
  return (
    <Modal titleId="share-title" onClose={onClose}>
      <div className="dialog-head">
        <div>
          <span className="eyebrow">SHARE YOUR THINKING</span>
          <h2 id="share-title">Share your space</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="muted">
        Anyone with the link can view all your saved content. Creating a new
        link disables the previous one.
      </p>
      <p className="muted">
        For security, the link is only shown when created. Save it somewhere
        safe.
      </p>
      {link && (
        <label>
          Share link
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
        </label>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="dialog-actions">
        <button className="secondary" disabled={busy} onClick={revoke}>
          Revoke link
        </button>
        {link && (
          <button className="secondary" onClick={copy}>
            Copy link
          </button>
        )}
        <button className="primary" disabled={busy} onClick={create}>
          {busy ? "Please wait…" : link ? "Create new link" : "Create link"}
        </button>
      </div>
    </Modal>
  );
}
