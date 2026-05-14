/**
 * Render PRESENTATION.html (a Reveal.js deck) to PRESENTATION.pdf
 * using Reveal's built-in print stylesheet via Chromium.
 *
 * Run with:  npx tsx scripts/presentation-to-pdf.ts
 */
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

async function main() {
  const htmlPath = resolve(process.cwd(), "PRESENTATION.html");
  const pdfPath = resolve(process.cwd(), "PRESENTATION.pdf");
  const url = `${pathToFileURL(htmlPath).href}?print-pdf`;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  // Reveal print mode needs an extra tick to lay out slides for paged media.
  await page.waitForTimeout(1500);

  await page.pdf({
    path: pdfPath,
    width: "1280px",
    height: "720px",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });

  await browser.close();
  // eslint-disable-next-line no-console
  console.log(`[presentation-to-pdf] wrote ${pdfPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
