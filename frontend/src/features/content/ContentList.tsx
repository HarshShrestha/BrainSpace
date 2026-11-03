import { Spark, Icon } from "../../components/Icons";
import type { Content } from "../../types";
const labels = {
  article: "Article / document",
  video: "Video",
  audio: "Audio",
  image: "Image",
};
const symbols = {
  article: "article",
  video: "video_library",
  audio: "audiotrack",
  image: "image",
};
export function ContentList({
  items,
  onDelete,
  onIndex,
  emptyMessage = "Nothing here yet. Save a link to start building your space.",
}: {
  items: Content[];
  onDelete?: (id: string) => void;
  onIndex?: (item: Content) => void;
  emptyMessage?: string;
}) {
  if (!items.length)
    return (
      <div className="empty">
        <div className="empty-mark">
          <Spark />
        </div>
        <h3>Space to think</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  return (
    <div className="content-grid">
      {items.map((item) => (
        <article className="content-card" key={item._id}>
          <div className="card-top">
            <span className={`type-icon ${item.type}`}>
              <Icon name={symbols[item.type]} />
            </span>
            <span className="type-label">{labels[item.type]}</span>
            {onDelete && (
              <button
                className="delete"
                onClick={() => onDelete(item._id)}
                aria-label={`Delete ${item.title}`}
              >
                <Icon name="delete" />
              </button>
            )}
          </div>
          <a
            className="card-title"
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.title}
          </a>
          <p className="domain">
            {(() => {
              try {
                return new URL(item.link).hostname.replace(/^www\./, "");
              } catch {
                return item.link;
              }
            })()}
          </p>
          {onIndex && (
            <div className="index-row">
              <button
                className="index-button"
                type="button"
                onClick={() => onIndex(item)}
              >
                {item.rag?.indexedAt ? "Reindex for AI" : "Index for AI"}
              </button>
              {item.rag?.indexedAt && (
                <span className="indexed-indicator">Indexed</span>
              )}
            </div>
          )}
          <div className="card-bottom">
            <div className="tags">
              {item.tags.map((tag) => (
                <span key={tag._id}>#{tag.title}</span>
              ))}
            </div>
            <time dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>
        </article>
      ))}
    </div>
  );
}
