import { useEffect, useMemo, useState } from "react";
import { useRecoilState } from "recoil";
import { contentState, userState } from "../../store/state";
import { api } from "../../services/api";
import type { Content, ContentInput, Folder } from "../../types";
import { Icon, Spark, SearchIcon } from "../../components/Icons";
import { ContentForm } from "./ContentForm";
import { ContentList } from "./ContentList";
import { FolderDialog } from "../folders/FolderDialog";
import { ShareDialog } from "../share/ShareDialog";
import { ReceivedSpaces } from "../share/ReceivedSpaces";
import { AssistantPanel } from "../assistant/AssistantPanel";
import { IndexDialog } from "../assistant/IndexDialog";
type View = "all" | "folder" | "shared" | "chat";
export function Workspace() {
  const [user, setUser] = useRecoilState(userState),
    [items, setItems] = useRecoilState(contentState);
  const [folders, setFolders] = useState<Folder[]>([]),
    [view, setView] = useState<View>("all"),
    [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [dialog, setDialog] = useState<"add" | "folder" | "share" | null>(null),
    [indexItem, setIndexItem] = useState<Content | null>(null),
    [revision, setRevision] = useState(0);
  const [newMenu, setNewMenu] = useState(false),
    [profile, setProfile] = useState(false);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("brainspace-theme");
    return saved
      ? saved === "dark"
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("brainspace-theme", dark ? "dark" : "light");
  }, [dark]);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [content, dirs] = await Promise.all([api.list(), api.folders()]);
      setItems(content);
      setFolders(dirs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your space");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter(
      (i) =>
        (view !== "folder" || i.folderId === activeFolder) &&
        (filter === "all" || i.type === filter) &&
        (!q ||
          [i.title, i.link, ...i.tags.map((t) => t.title)].some((s) =>
            s.toLowerCase().includes(q),
          )),
    );
  }, [items, query, filter, view, activeFolder]);
  async function save(input: ContentInput) {
    const item = await api.add(input);
    setItems((old) => [item, ...old]);
    if (view === "folder" && activeFolder) {
      try {
        const moved = await api.moveContent(item._id, activeFolder);
        setItems((old) => old.map((i) => (i._id === moved._id ? moved : i)));
      } catch (e) {
        setError(
          e instanceof Error
            ? `Saved, but could not move: ${e.message}`
            : "Saved outside the folder.",
        );
      }
    }
  }
  async function createFolder(name: string) {
    const folder = await api.createFolder(name);
    setFolders((old) =>
      [...old, folder].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  async function deleteFolder(folder: Folder) {
    if (!window.confirm(`Delete the empty folder “${folder.name}”?`)) return;
    setError("");
    try {
      await api.deleteFolder(folder._id);
      setFolders((old) => old.filter((f) => f._id !== folder._id));
      if (activeFolder === folder._id) {
        setActiveFolder(null);
        setView("all");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete folder");
    }
  }
  async function move(id: string, folderId: string | null) {
    setError("");
    try {
      const changed = await api.moveContent(id, folderId);
      setItems((old) => old.map((i) => (i._id === id ? changed : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move item");
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this item from your space?")) return;
    setError("");
    try {
      await api.remove(id);
      setItems((old) => old.filter((i) => i._id !== id));
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }
  async function logout() {
    try {
      await api.logout();
      setItems([]);
      setUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign out");
    }
  }
  function openFolder(id: string) {
    setActiveFolder(id);
    setView("folder");
    setQuery("");
    setNewMenu(false);
  }
  function goAll() {
    setView("all");
    setActiveFolder(null);
    setQuery("");
    setNewMenu(false);
  }
  const folderName =
    folders.find((f) => f._id === activeFolder)?.name || "Folder";
  return (
    <div className={`drive-shell ${view === "chat" ? "in-chat" : ""}`}>
      <aside className="drive-sidebar">
        <div className="brand">
          <Spark className="brand-mark" />
          brainspace<span className="brand-dot">.</span>
        </div>
        {view === "chat" ? (
          <div className="chat-sidebar">
            <button className="back-link" onClick={goAll}>
              <Icon name="arrow_back" /> All contents
            </button>
            <div className="source-heading">
              <span>YOUR SOURCES</span>
              <span>{items.length}</span>
            </div>
            <p className="source-intro">
              Indexed sources are available to your assistant.
            </p>
            <div className="source-list">
              {items.length ? (
                items.map((item) => (
                  <div className="source-item" key={item._id}>
                    <Icon name="article" />
                    <div>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                      </a>
                      <button onClick={() => setIndexItem(item)}>
                        {item.rag?.indexedAt ? "Reindex" : "Index for AI"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No content saved yet.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="new-container">
              <button
                className="new-button"
                aria-expanded={newMenu}
                onClick={() => setNewMenu(!newMenu)}
              >
                <Icon name="add" /> New
              </button>
              {newMenu && (
                <div className="new-menu">
                  <button
                    onClick={() => {
                      setDialog("add");
                      setNewMenu(false);
                    }}
                  >
                    <Icon name="add" /> Add content
                  </button>
                  <button
                    onClick={() => {
                      setDialog("folder");
                      setNewMenu(false);
                    }}
                  >
                    <Icon name="folder" /> New folder
                  </button>
                </div>
              )}
            </div>
            <nav className="drive-nav" aria-label="Workspace navigation">
              <button
                className={view === "all" ? "active" : ""}
                onClick={goAll}
              >
                <Icon name="apps" /> All contents <span>{items.length}</span>
              </button>
              <button
                className={view === "shared" ? "active" : ""}
                onClick={() => {
                  setView("shared");
                  setNewMenu(false);
                }}
              >
                <Icon name="group" /> Shared with me
              </button>
              <button
                onClick={() => {
                  setView("chat");
                  setNewMenu(false);
                }}
              >
                <Icon name="chat_bubble" /> Ask your space
              </button>
              <div className="nav-label">FOLDERS</div>
              {folders.map((f) => (
                <button
                  key={f._id}
                  className={
                    view === "folder" && activeFolder === f._id ? "active" : ""
                  }
                  onClick={() => openFolder(f._id)}
                >
                  <Icon name="folder" />
                  <span className="folder-label">{f.name}</span>
                </button>
              ))}
              {!folders.length && (
                <p className="nav-empty">
                  Create a folder to organize your links.
                </p>
              )}
            </nav>
          </>
        )}
      </aside>
      <main className="drive-workspace">
        <header className="drive-topbar">
          <div className="topbar-title">Your personal knowledge space</div>
          <div className="topbar-actions">
            <button
              className="secondary share-action"
              onClick={() => setDialog("share")}
            >
              <Icon name="share" /> Share
            </button>
            <button
              className="top-icon"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setDark(!dark)}
            >
              <Icon name={dark ? "light_mode" : "dark_mode"} />
            </button>
            <div className="profile-wrap">
              <button
                className="profile-button"
                aria-label="Open profile"
                aria-expanded={profile}
                onClick={() => setProfile(!profile)}
              >
                {user?.username[0]?.toUpperCase()}
              </button>
              {profile && (
                <div className="profile-menu">
                  <strong>{user?.username}</strong>
                  <span>Personal account</span>
                  <button onClick={() => void logout()}>
                    <Icon name="logout" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {error && (
          <div className="workspace-error" role="alert">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        {view === "chat" ? (
          <div className="chat-main">
            <AssistantPanel revision={revision} />
          </div>
        ) : view === "shared" ? (
          <ReceivedSpaces />
        ) : (
          <section className="drive-main">
            {view === "folder" && (
              <button className="back-link" onClick={goAll}>
                <Icon name="arrow_back" /> All contents
              </button>
            )}
            <div className="drive-heading">
              <div>
                <p className="drive-kicker">
                  {view === "folder" ? "FOLDER" : "YOUR SECOND BRAIN"}
                </p>
                <h1>{view === "folder" ? folderName : "Your space"}</h1>
                <p>
                  {view === "folder"
                    ? "Your saved ideas, gathered together."
                    : "A home for the links, thoughts and discoveries you want to keep."}
                </p>
              </div>
              <div className="drive-count">
                <strong>{String(items.length).padStart(2, "0")}</strong>
                <span>ITEMS SAVED</span>
              </div>
            </div>
            {view === "all" && folders.length > 0 && (
              <section className="folder-section">
                <div className="section-title">
                  <h2>Folders</h2>
                  <span>{folders.length}</span>
                </div>
                <div className="folder-grid">
                  {folders.map((f) => (
                    <div className="folder-card" key={f._id}>
                      <button onClick={() => openFolder(f._id)}>
                        <Icon name="folder" />
                        <span>{f.name}</span>
                      </button>
                      <button
                        aria-label={`Delete folder ${f.name}`}
                        onClick={() => void deleteFolder(f)}
                      >
                        <Icon name="delete" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="collection-heading drive-collection">
              <div>
                <span className="drive-kicker">THE COLLECTION</span>
                <h2>
                  {view === "folder" ? "In this folder" : "All contents"}{" "}
                  <span>{visible.length}</span>
                </h2>
              </div>
              <div className="controls">
                <label className="search">
                  <span aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <span className="sr-only">Search your content</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your space"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter by type</span>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All types</option>
                    <option value="article">Articles</option>
                    <option value="video">Videos</option>
                    <option value="audio">Audio</option>
                    <option value="image">Images</option>
                  </select>
                </label>
              </div>
            </div>
            {loading ? (
              <p role="status" className="muted">
                Loading your space…
              </p>
            ) : (
              <ContentList
                items={visible}
                onDelete={(id) => void remove(id)}
                onIndex={setIndexItem}
                folders={folders}
                onMove={(id, folderId) => void move(id, folderId)}
                emptyMessage={
                  items.length ? "No items match this view." : undefined
                }
              />
            )}
          </section>
        )}
      </main>
      {view !== "chat" && (
        <button
          className="assistant-launch drive-chat-launch"
          aria-label="Open AI assistant"
          onClick={() => setView("chat")}
        >
          <Icon name="chat_bubble" />
          <span>Ask your space</span>
        </button>
      )}
      {dialog === "add" && (
        <ContentForm onSave={save} onClose={() => setDialog(null)} />
      )}
      {dialog === "folder" && (
        <FolderDialog onCreate={createFolder} onClose={() => setDialog(null)} />
      )}
      {dialog === "share" && <ShareDialog onClose={() => setDialog(null)} />}
      {indexItem && (
        <IndexDialog
          item={indexItem}
          onClose={() => setIndexItem(null)}
          onIndexed={async () => {
            await load();
            setRevision((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
