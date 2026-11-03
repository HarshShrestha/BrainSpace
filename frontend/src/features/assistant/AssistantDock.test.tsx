import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../../services/api";
import { AssistantDock } from "./AssistantDock";
afterEach(() => vi.restoreAllMocks());
describe("AssistantDock", () => {
  it("opens and closes from the launcher and returns keyboard focus", async () => {
    vi.spyOn(api, "assistantStatus").mockResolvedValue({
      configured: false,
      indexed: 0,
      compatible: 0,
    });
    const user = userEvent.setup();
    render(<AssistantDock revision={0} />);
    const launcher = screen.getByRole("button", { name: "Open AI assistant" });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    await user.click(launcher);
    expect(
      screen.getByRole("dialog", { name: "Ask your space" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Close AI assistant" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(launcher).toHaveFocus();
  });
});
