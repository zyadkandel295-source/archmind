const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const root = path.resolve("tmp/file-ui-acceptance");
  const session = JSON.parse(
    await fs.readFile(path.join(root, "session.txt"), "utf8"),
  );
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript((token) => {
      localStorage.setItem("archmind.session", token);
    }, session.token);
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      console.log(`Browser error: ${error.message}`),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        console.log(`Browser console: ${message.text()}`);
    });
    page.on("requestfailed", (request) =>
      console.log(
        `Request failed: ${request.url().split("?")[0]} ${request.failure()?.errorText}`,
      ),
    );
    page.on("response", (response) => {
      if (response.status() >= 400)
        console.log(
          `HTTP ${response.status()}: ${response.url().split("?")[0]}`,
        );
    });
    await page.goto(
      `http://localhost:3100/assistants/${session.assistantId}/chat`,
      { waitUntil: "domcontentloaded", timeout: 120000 },
    );
    await page
      .getByText("File Acceptance Assistant", { exact: true })
      .waitFor({ timeout: 90000 });
    const input = page.locator("textarea").first();
    await input.waitFor({ timeout: 90000 });
    if (process.env.FILE_ACCEPTANCE_BUTTON === "1") {
      await page
        .getByRole("button", { name: "Generate file", exact: true })
        .click();
      await page.getByLabel("File type", { exact: true }).selectOption("pptx");
      await page.getByText("Slides (optional)", { exact: true }).waitFor();
      await page.getByLabel("File type", { exact: true }).selectOption("docx");
      await page.getByLabel("File type", { exact: true }).selectOption("pdf");
      await page.getByLabel("File length", { exact: true }).fill("2");
      await page.screenshot({
        path: path.join(root, "file-button.png"),
        fullPage: true,
      });
    }
    await input.fill(
      "Create a 2-page PDF about how plants grow, with a worked example. Include the title in the total count.",
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.screenshot({
      path: path.join(root, "submitted.png"),
      fullPage: true,
    });
    await page
      .getByText("Your file is queued.", { exact: false })
      .waitFor({ timeout: 60000 });
    console.log(
      "PASS natural chat request produced a queued backend file card",
    );
    await page.screenshot({
      path: path.join(root, "queued.png"),
      fullPage: true,
    });
    const download = page
      .getByRole("button", { name: "Download", exact: true })
      .first();
    await download.waitFor({ timeout: 600000 });
    const completed = await context.request.get(
      "http://127.0.0.1:4401/api/files",
      { headers: { Authorization: `Bearer ${session.token}` } },
    );
    const first = (await completed.json()).files.find(
      (file) => file.status === "completed",
    );
    assert(first);
    assert.equal(first.count, 2);
    const event = page.waitForEvent("download");
    await download.click();
    const file = await event;
    await file.saveAs(path.join(root, file.suggestedFilename()));
    const bytes = await fs.readFile(path.join(root, file.suggestedFilename()));
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    console.log(
      "PASS browser download returned a real PDF from the BullMQ worker",
    );
    await page.screenshot({
      path: path.join(root, "completed.png"),
      fullPage: true,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Download", exact: true })
      .first()
      .waitFor({ timeout: 60000 });
    console.log("PASS file card persisted after refresh");
    await input.fill("Create a DOCX version too.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page
      .getByText("Word Document", { exact: false })
      .waitFor({ timeout: 600000 });
    console.log("PASS follow-up export produced a new Word version in chat");
    const fresh = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await fresh.addInitScript((token) => {
      localStorage.setItem("archmind.session", token);
    }, session.token);
    const restored = await fresh.newPage();
    await restored.goto(page.url(), { waitUntil: "domcontentloaded" });
    await restored
      .getByRole("button", { name: "Download", exact: true })
      .first()
      .waitFor({ timeout: 90000 });
    console.log(
      "PASS file history restored in a fresh browser login with no cached chats",
    );
    await restored.screenshot({
      path: path.join(root, "restored.png"),
      fullPage: true,
    });
    const outsider = await context.request.get(
      `http://127.0.0.1:4401/api/files/${first.id}/download`,
      { headers: { Authorization: "Bearer session_other_user" } },
    );
    assert.equal(outsider.status(), 401);
    console.log("PASS unverified user cannot download the file");
    await fresh.close();
    await context.close();
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
