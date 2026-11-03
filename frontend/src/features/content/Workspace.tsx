import { Spark, SearchIcon, GridIcon } from "../../components/Icons";
import { useEffect, useMemo, useState } from "react";
import { useRecoilState } from "recoil";
import { contentState, userState } from "../../store/state";
import { api } from "../../services/api";
import type { Content, ContentInput } from "../../types";
import { ContentForm } from "./ContentForm";
import { ContentList } from "./ContentList";
import { ShareDialog } from "../share/ShareDialog";
import { AssistantPanel } from "../assistant/AssistantPanel";
import { IndexDialog } from "../assistant/IndexDialog";
export function Workspace() {
  const [user, setUser] = useRecoilState(userState),
    [items, setItems] = useRecoilState(contentState);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState<"add" | "share" | null>(null),
    [indexItem, setIndexItem] = useState<Content | null>(null),
    [revision, setRevision] = useState(0);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await api.list());
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
        (filter === "all" || i.type === filter) &&
        (!q ||
          [i.title, i.link, ...i.tags.map((t) => t.title)].some((s) =>
            s.toLowerCase().includes(q),
          )),
    );
  }, [items, query, filter]);
  async function save(input: ContentInput) {
    const item = await api.add(input);
    setItems((old) => [item, ...old]);
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Spark className="brand-mark" /> brainspace
          <span className="brand-dot">.</span>
        </div>
        <div className="sidebar-main">
          <div className="eyebrow">YOUR SPACE</div>
          <div className="nav-active">
            <GridIcon /> All content{" "}
            <span className="nav-count">{items.length}</span>
          </div>
          <div className="sidebar-note">
            <Spark />
            <p>A little space for everything worth remembering.</p>
          </div>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{user?.username[0]?.toUpperCase()}</span>
          <div>
            <strong>{user?.username}</strong>
            <small>Personal space</small>
          </div>
          <button onClick={logout} className="text-button sign-out">
            Sign out
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <span>YOUR PERSONAL KNOWLEDGE SPACE</span>
          <div>
            <button className="secondary" onClick={() => setDialog("share")}>
              ↗ &nbsp;Share
            </button>
            <button className="primary" onClick={() => setDialog("add")}>
              + &nbsp;Add content
            </button>
          </div>
        </header>
        <section className="workspace-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR SECOND BRAIN</span>
              <h1>
                All your ideas, <em>in one place.</em>
              </h1>
              <p>
                A home for the links, thoughts and discoveries you want to keep.
              </p>
            </div>
            <div className="count-block">
              <strong>{String(items.length).padStart(2, "0")}</strong>
              <span>THINGS SAVED</span>
            </div>
          </div>
          <AssistantPanel revision={revision} />
          <div className="section-rule" />
          <div className="collection-heading">
            <div>
              <span className="eyebrow">THE COLLECTION</span>
              <h2>
                Your space <span>{items.length}</span>
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
          {error && (
            <div className="error-row" role="alert">
              {error}{" "}
              <button className="text-button" onClick={load}>
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <p role="status" className="muted">
              Loading your space…
            </p>
          ) : (
            <ContentList
              items={visible}
              onDelete={(id) => void remove(id)}
              onIndex={setIndexItem}
              emptyMessage={
                items.length
                  ? "No items match your search or filter."
                  : undefined
              }
            />
          )}
        </section>
      </main>
      {dialog === "add" && (
        <ContentForm onSave={save} onClose={() => setDialog(null)} />
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
