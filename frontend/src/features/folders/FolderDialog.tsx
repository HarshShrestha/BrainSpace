import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import { Icon } from "../../components/Icons";
export function FolderDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onCreate(name.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create folder");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal titleId="folder-title" onClose={onClose}>
      <div className="dialog-head">
        <h2 id="folder-title">New folder</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <form onSubmit={submit}>
        <label>
          Folder name
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Research"
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create folder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
