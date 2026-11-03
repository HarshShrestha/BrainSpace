import { describe, it, expect, vi, afterEach } from "vitest";
import { api, setUnauthorizedHandler } from "./api";
const reply = (status: number, body: unknown) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
afterEach(() => {
  vi.restoreAllMocks();
  setUnauthorizedHandler(() => {});
});
describe("session expiry handling", () => {
  it("reports an ended session when an authenticated call returns 401", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    reply(401, { message: "Invalid or expired session" });
    await expect(api.list()).rejects.toThrow("Invalid or expired session");
    expect(handler).toHaveBeenCalledOnce();
  });
  it("treats a 401 from sign-in as wrong credentials, not an ended session", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    reply(401, { message: "Invalid username or password" });
    await expect(api.login("alice", "password123")).rejects.toThrow(
      "Invalid username or password",
    );
    expect(handler).not.toHaveBeenCalled();
  });
  it("does not report other errors as an ended session", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    reply(404, { message: "Content not found" });
    await expect(api.remove("x")).rejects.toThrow("Content not found");
    expect(handler).not.toHaveBeenCalled();
  });
});
