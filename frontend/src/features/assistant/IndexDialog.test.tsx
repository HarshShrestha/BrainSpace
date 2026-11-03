import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../../services/api";
import { IndexDialog } from "./IndexDialog";
afterEach(() => vi.restoreAllMocks());
describe("IndexDialog", () => {
  it("requires explicit consent and sends the pasted text", async () => {
    vi.spyOn(api, "indexContent").mockResolvedValue({
      indexedAt: "2026-01-01",
      sourceType: "pasted",
      chunks: 1,
    });
    const complete = vi.fn().mockResolvedValue(undefined),
      close = vi.fn();
    render(
      <IndexDialog
        item={{
          _id: "1",
          title: "Notes",
          link: "https://example.com",
          type: "article",
          tags: [],
          createdAt: "2026-01-01",
        }}
        onClose={close}
        onIndexed={complete}
      />,
    );
    expect(screen.getByRole("button", { name: "Index source" })).toBeDisabled();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(/Source text/),
      "A source text to index.",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Index source" }));
    expect(api.indexContent).toHaveBeenCalledWith(
      "1",
      "A source text to index.",
    );
    expect(complete).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
