// Exercise built assets against the real API and an isolated temporary MongoDB.
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import net from "node:net";
import { mkdir } from "node:fs/promises";
import path from "node:path";
async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
const apiPort = await freePort(),
  webPort = await freePort();
const baseUrl = `http://127.0.0.1:${webPort}`;
const mongo = await MongoMemoryServer.create();
const env = {
  ...process.env,
  MONGODB_URI: mongo.getUri("brainspace_e2e"),
  ACCESS_TOKEN_SECRET: "test-only-secret-with-at-least-32-characters",
  CORS_ORIGIN: baseUrl,
  PORT: String(apiPort),
  NODE_ENV: "production",
  E2E_API_PROXY: `http://127.0.0.1:${apiPort}`,
  RAG_ENABLED: "true",
  GEMINI_API_KEY: "e2e-test-only",
  GEMINI_EMBEDDING_MODEL: "gemini-embedding-001",
  GEMINI_CHAT_MODEL: "gemini-3.8-flash",
  PYTHONPATH: path.resolve("tests/python_stubs"),
};
const backend = spawn(process.execPath, ["dist/index.js"], {
  env,
  stdio: "inherit",
});
const frontend = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(webPort),
    "--strictPort",
  ],
  { env, cwd: "frontend", stdio: "inherit" },
);
frontend.on("error", console.error);
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if (
        (await fetch(`http://127.0.0.1:${apiPort}/api/health`)).ok &&
        (await fetch(baseUrl)).ok
      )
        break;
    } catch {}
    if (i === 79) throw new Error("Servers did not start");
    await delay(250);
  }
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(baseUrl);
  if (process.env.RAG_QA_DIR) {
    await mkdir(process.env.RAG_QA_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.RAG_QA_DIR, "auth.png"),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill("reader");
  await page.getByLabel("Password").fill("strong-example-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "New", exact: true }).waitFor();
  async function addItem(title, type, tags = "") {
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("button", { name: "Add content" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Link").fill("https://example.com/" + type);
    await page.getByLabel("Content type").selectOption(type);
    if (tags) await page.getByLabel(/Tags/).fill(tags);
    await page.getByRole("button", { name: "Save to space" }).click();
    await page
      .locator(".content-grid")
      .getByRole("link", { name: title })
      .waitFor();
  }
  await addItem(
    "Designing a calmer internet",
    "article",
    "design, inspiration",
  );
  await addItem("A field guide to ideas", "article");
  await addItem("Notes on creative work", "video");
  await addItem("A quieter way to listen", "audio");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Research");
  await page.getByRole("button", { name: "Create folder" }).click();
  await page
    .locator(".folder-card")
    .getByRole("button", { name: "Research", exact: true })
    .waitFor();
  const move = page.getByLabel("Move A field guide to ideas to folder");
  await move.selectOption({ label: "Research" });
  await page
    .locator(".folder-card")
    .getByRole("button", { name: "Research", exact: true })
    .click();
  await page.getByRole("heading", { name: "Research", exact: true }).waitFor();
  await page
    .locator(".content-grid")
    .getByRole("link", { name: "A field guide to ideas" })
    .waitFor();
  assert.equal(await page.locator(".content-grid article").count(), 1);
  await page.locator(".drive-main .back-link").click();
  await page
    .locator("article")
    .filter({
      has: page.getByRole("link", { name: "Designing a calmer internet" }),
    })
    .getByRole("button", { name: "Index for AI" })
    .click();
  await page
    .getByLabel(/Source text/)
    .fill(
      "The example uses blue cards for each source. These cards are arranged with generous spacing to support a calm reading experience.",
    );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Index source", exact: true }).click();
  await page.getByRole("button", { name: "Open AI assistant" }).click();
  await page.getByText("1 source ready").waitFor();
  await page
    .getByLabel(/Ask a question about your indexed sources/)
    .fill("What color are the cards?");
  await page.getByRole("button", { name: "Ask question" }).click();
  await page
    .getByText("The example uses blue cards.", { exact: true })
    .waitFor();
  await page
    .getByText("“The example uses blue cards for each source.”")
    .waitFor();
  await page
    .locator(".chat-sidebar")
    .getByRole("link", { name: "Designing a calmer internet" })
    .waitFor();
  if (process.env.RAG_QA_DIR)
    await page.screenshot({
      path: path.join(process.env.RAG_QA_DIR, "desktop-chat.png"),
      animations: "disabled",
    });
  await page.locator(".chat-sidebar .back-link").click();
  if (process.env.SCREENSHOT_DIR) {
    await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, "workspace.png"),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  if (process.env.RAG_QA_DIR)
    await page.screenshot({
      path: path.join(process.env.RAG_QA_DIR, "dark.png"),
      animations: "disabled",
    });
  await page.reload();
  await page.getByRole("button", { name: "Switch to light mode" }).waitFor();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.getByLabel("Search your content").fill("inspiration");
  assert.equal(
    await page
      .locator(".content-grid")
      .getByRole("link", { name: "Designing a calmer internet" })
      .count(),
    1,
  );
  await page.getByLabel("Search your content").fill("missing");
  await page.getByText("No items match this view.").waitFor();
  await page.getByLabel("Search your content").fill("");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("button", { name: "Create link", exact: true }).click();
  const url = await page.getByLabel("Share link").inputValue();
  const other = await browser.newContext();
  const visitor = await other.newPage();
  await visitor.goto(baseUrl);
  await visitor.getByRole("button", { name: "Create an account" }).click();
  await visitor.getByLabel("Username").fill("friend");
  await visitor.getByLabel("Password").fill("strong-example-password");
  await visitor.getByRole("button", { name: "Create account" }).click();
  await visitor.getByRole("button", { name: "Shared with me" }).click();
  await visitor.getByLabel("Add a shared space").fill(url);
  await visitor.getByRole("button", { name: "Add link" }).click();
  await visitor.getByRole("button", { name: "Open", exact: true }).click();
  await visitor
    .getByRole("link", { name: "Designing a calmer internet" })
    .waitFor();
  await page.getByRole("button", { name: "Revoke link" }).click();
  await visitor.locator(".drive-main .back-link").click();
  await visitor.reload();
  await visitor.getByRole("button", { name: "Shared with me" }).click();
  await visitor.getByText("Unavailable space").waitFor();
  await other.close();
  await page.getByRole("button", { name: "Close" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, "mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
  await page.getByRole("button", { name: "Open AI assistant" }).click();
  await page.getByRole("heading", { name: "Ask your space" }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "Mobile chat should not overflow",
  );
  if (process.env.RAG_QA_DIR)
    await page.screenshot({
      path: path.join(process.env.RAG_QA_DIR, "mobile-chat.png"),
      animations: "disabled",
    });
  await page.locator(".chat-sidebar .back-link").click();
  await page.getByRole("button", { name: /Reindex for AI/ }).click();
  await page.getByRole("button", { name: "Remove AI index" }).click();
  await page.getByRole("button", { name: "Open AI assistant" }).click();
  await page.getByText("0 sources ready").waitFor();
  await page.locator(".chat-sidebar .back-link").click();
  for (const title of [
    "A field guide to ideas",
    "Notes on creative work",
    "A quieter way to listen",
    "Designing a calmer internet",
  ])
    await page.getByRole("button", { name: `Delete ${title}` }).click();
  await page.getByRole("button", { name: "Delete folder Research" }).click();
  await page.getByRole("button", { name: "Open profile" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Username").fill("reader");
  await page.getByLabel("Password").fill("strong-example-password");
  await page
    .getByRole("button", { name: /Sign in/ })
    .first()
    .click();
  await page.getByRole("button", { name: "New", exact: true }).waitFor();
  console.log(
    "E2E passed: auth, folders, capture, indexed chat, search, theme, received sharing/revocation, deletion, mobile (Gemini stubbed).",
  );
} finally {
  await browser?.close();
  backend.kill();
  frontend.kill();
  await mongo.stop();
}
