import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../services/api";
import type { ReceivedShare, SharedBrain } from "../../types";
import { Icon } from "../../components/Icons";
import { ContentList } from "../content/ContentList";
export function ReceivedSpaces() {
  const [entries, setEntries] = useState<ReceivedShare[]>([]),
    [selected, setSelected] = useState<SharedBrain | null>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setEntries(await api.receivedShares());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load shared spaces");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.saveReceivedShare(url);
      setUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add link");
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setError("");
    try {
      setSelected(await api.openReceivedShare(id));
    } catch (e) {
      await load();
      setError(e instanceof Error ? e.message : "Unable to open shared space");
    }
  }
  async function remove(id: string) {
    setError("");
    try {
      await api.removeReceivedShare(id);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to remove shared space",
      );
    }
  }
  if (selected)
    return (
      <section className="drive-main">
        <button className="back-link" onClick={() => setSelected(null)}>
          <Icon name="arrow_back" /> Shared with me
        </button>
        <div className="drive-heading">
          <div>
            <p className="drive-kicker">SHARED SPACE</p>
            <h1>{selected.username}’s space</h1>
            <p>Read-only collection shared with you.</p>
          </div>
        </div>
        <ContentList items={selected.content} />
      </section>
    );
  return (
    <section className="drive-main">
      <div className="drive-heading">
        <div>
          <p className="drive-kicker">YOUR NETWORK</p>
          <h1>Shared with me</h1>
          <p>Keep the BrainSpace links others have shared with you.</p>
        </div>
      </div>
      <form className="share-import" onSubmit={add}>
        <label htmlFor="shared-url">Add a shared space</label>
        <div>
          <input
            id="shared-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a BrainSpace share link"
          />
          <button className="primary" disabled={busy}>
            {busy ? "Adding…" : "Add link"}
          </button>
        </div>
        <p>
          Only people with the link can add it. The owner can revoke access at
          any time.
        </p>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading shared spaces…</p>
      ) : entries.length ? (
        <div className="received-list">
          {entries.map((e) => (
            <article className="received-item" key={e.id}>
              <span className="received-icon">
                <Icon name="group" />
              </span>
              <div>
                <strong>
                  {e.available ? `${e.username}’s space` : "Unavailable space"}
                </strong>
                <p>
                  {e.available
                    ? "Shared collection · Read only"
                    : "The owner revoked or rotated this link."}
                </p>
              </div>
              <div className="received-actions">
                {e.available && (
                  <button className="secondary" onClick={() => void open(e.id)}>
                    Open
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label={`Remove ${e.username || "unavailable"} shared space`}
                  onClick={() => void remove(e.id)}
                >
                  <Icon name="delete" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="shared-empty">
          <Icon name="group" />
          <h2>No shared spaces yet</h2>
          <p>Paste a BrainSpace share link above to keep it here.</p>
        </div>
      )}
    </section>
  );
}
