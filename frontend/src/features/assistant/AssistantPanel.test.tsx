import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../../services/api";
import { AssistantPanel } from "./AssistantPanel";
afterEach(() => vi.restoreAllMocks());
describe("AssistantPanel", () => {
  it("explains when AI is unconfigured", async () => {
    vi.spyOn(api, "assistantStatus").mockResolvedValue({
      configured: false,
      indexed: 0,
      compatible: 0,
    });
    render(<AssistantPanel revision={0} />);
    expect(await screen.findByText(/isn’t configured yet/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ask a question/)).toBeDisabled();
  });
  it("asks a question and shows the cited evidence", async () => {
    vi.spyOn(api, "assistantStatus").mockResolvedValue({
      configured: true,
      indexed: 1,
      compatible: 1,
    });
    vi.spyOn(api, "ask").mockResolvedValue({
      answer: "Blue cards.",
      abstained: false,
      sources: [
        {
          contentId: "1",
          title: "Design notes",
          link: "https://example.org",
          quote: "The cards are blue.",
        },
      ],
    });
    render(<AssistantPanel revision={0} />);
    await screen.findByText(/1 source ready/);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(/Ask a question/),
      "What color are the cards?",
    );
    await user.click(screen.getByRole("button", { name: "Ask question" }));
    expect(await screen.findByText("Blue cards.")).toBeInTheDocument();
    expect(screen.getByText(/The cards are blue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Design notes/ })).toHaveAttribute(
      "href",
      "https://example.org",
    );
  });
  it("displays provider errors rather than claiming an answer", async () => {
    vi.spyOn(api, "assistantStatus").mockResolvedValue({
      configured: true,
      indexed: 1,
      compatible: 1,
    });
    vi.spyOn(api, "ask").mockRejectedValue(new Error("Provider unavailable"));
    render(<AssistantPanel revision={0} />);
    await screen.findByText(/1 source ready/);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Ask a question/), "What is saved?");
    await user.click(screen.getByRole("button", { name: "Ask question" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider unavailable",
    );
  });
});
