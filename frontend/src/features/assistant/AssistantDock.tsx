import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icons";
import { AssistantPanel } from "./AssistantPanel";

/** Non-modal assistant: the collection remains available while the chat is open. */
export function AssistantDock({ revision }: { revision: number }) {
  const [open, setOpen] = useState(false);
  const launch = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    launch.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".overlay")) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="assistant-dock">
      <div
        id="assistant-popover"
        className="assistant-popover"
        role="dialog"
        aria-label="Ask your space"
        hidden={!open}
      >
        <button
          ref={closeButton}
          type="button"
          className="assistant-close"
          onClick={close}
          aria-label="Close AI assistant"
        >
          <Icon name="close" />
        </button>
        <AssistantPanel revision={revision} />
      </div>
      <button
        ref={launch}
        type="button"
        className="assistant-launch"
        aria-label={open ? "Minimize AI assistant" : "Open AI assistant"}
        aria-controls="assistant-popover"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name={open ? "close" : "chat_bubble"} />
        <span>Ask your space</span>
      </button>
    </div>
  );
}
