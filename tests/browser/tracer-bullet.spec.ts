/**
 * Browser smoke test — tracer-bullet demo
 *
 * Verifies that the bundled tRAGar library loads correctly in a real browser
 * and that the tracer-bullet example completes one full create→ingest→query
 * cycle without errors. Uses Playwright + Chromium (headless).
 *
 * Prerequisites: `just build-js` must be run before this test.
 */
import { test, expect } from "@playwright/test";

test("tracer-bullet example completes all checks without errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[uncaught] ${err.message}`);
  });

  await page.goto("/examples/tracer-bullet/index.html");

  // Wait for the run() function to finish — it adds .ok or .err to #output.
  await page.locator("#output.ok, #output.err").waitFor({ timeout: 15_000 });

  const text = await page.locator("#output").textContent();
  await expect(
    page.locator("#output"),
    `Expected #output to have class 'ok'. Content:\n${text}`,
  ).toHaveClass(/\bok\b/);

  await expect(page.locator("#output")).toContainText("All checks passed");

  expect(
    consoleErrors,
    `Expected no browser console errors, got: ${JSON.stringify(consoleErrors)}`,
  ).toHaveLength(0);
});
