import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecoilRoot, useRecoilValue } from "recoil";
import { userState } from "../../store/state";
import { api } from "../../services/api";
import { Auth } from "./Auth";
function Observer() {
  const user = useRecoilValue(userState);
  return <div data-testid="current-user">{user?.username || "anonymous"}</div>;
}
afterEach(() => vi.restoreAllMocks());
describe("authentication and Recoil state", () => {
  it("signs in and stores the returned user", async () => {
    vi.spyOn(api, "login").mockResolvedValue({ id: "1", username: "alice" });
    render(
      <RecoilRoot>
        <Auth />
        <Observer />
      </RecoilRoot>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
    expect(await screen.findByTestId("current-user")).toHaveTextContent(
      "alice",
    );
    expect(api.login).toHaveBeenCalledWith("alice", "password123");
  });
  it("shows authentication failures without changing the user", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new Error("Invalid username or password"),
    );
    render(
      <RecoilRoot>
        <Auth />
        <Observer />
      </RecoilRoot>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password",
    );
    expect(screen.getByTestId("current-user")).toHaveTextContent("anonymous");
  });
});
