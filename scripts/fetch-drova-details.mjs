/**
 * Fetch public Notion subpages for Drova and save clean HTML fragments.
 * Run: node scripts/fetch-drova-details.mjs
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const drovaHtml = readFileSync(join(root, "projects/drova.html"), "utf8");
const outDir = join(root, "assets/drova/details");
mkdirSync(outDir, { recursive: true });

const linkRe =
  /<figure[^>]*id="([^"]+)"[^>]*link-to-page[^>]*><a href="https:\/\/www\.notion\.so\/([^"?]+)[^"]*">([^<]*)<\/a><\/figure>/g;

const pages = [];
let m;
while ((m = linkRe.exec(drovaHtml)) !== null) {
  pages.push({
    figureId: m[1],
    slug: m[2],
    label: m[3].trim() || "Details",
    url: `https://www.notion.so/${m[2]}`,
  });
}

console.log(`Found ${pages.length} detail pages to fetch`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  viewport: { width: 1100, height: 900 },
});

const manifest = [];

for (const page of pages) {
  const outPath = join(outDir, `${page.figureId}.html`);
  console.log(`Fetching ${page.label} → ${page.url}`);

  const tab = await context.newPage();
  try {
    await tab.goto(page.url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await tab.waitForSelector("main [data-block-id]", { timeout: 60000 });
    await tab.waitForTimeout(2500);

    const extracted = await tab.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return { html: "", title: document.title };

      const seen = new Set();
      const parts = [];

      main.querySelectorAll("[data-block-id]").forEach((el) => {
        const id = el.getAttribute("data-block-id");
        if (!id || seen.has(id)) return;
        seen.add(id);

        const row = el.closest(".notion-selectable") || el;
        if (row.closest("header")) return;

        const text = (row.innerText || "").trim();
        if (!text) return;
        if (text === "Details:" || text === "Detail - Persona:") return;
        if (text.startsWith("🍃") && text.includes("Portfolio")) return;
        if (text === "Get Notion free") return;

        const wrap = document.createElement("div");
        wrap.className = "notion-block";
        wrap.setAttribute("data-block-id", id);
        wrap.innerHTML = row.innerHTML;

        wrap.querySelectorAll("[style]").forEach((n) => n.removeAttribute("style"));
        wrap.querySelectorAll("button, [role='button'], svg").forEach((n) => n.remove());

        parts.push(wrap.outerHTML);
      });

      return { html: parts.join("\n"), title: document.title };
    });

    if (!extracted.html || extracted.html.length < 80) {
      console.warn(`  ⚠ Short content (${extracted.html?.length || 0} chars)`);
    } else {
      console.log(`  ✓ ${extracted.html.length} chars — ${extracted.title}`);
    }

    writeFileSync(outPath, extracted.html, "utf8");
    manifest.push({
      figureId: page.figureId,
      label: page.label,
      file: `assets/drova/details/${page.figureId}.html`,
    });
  } catch (err) {
    console.error(`  ✗ ${page.label}:`, err.message);
    manifest.push({ figureId: page.figureId, label: page.label, file: null, error: err.message });
  } finally {
    await tab.close();
  }
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await browser.close();
console.log("Done.");
