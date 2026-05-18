/**
 * Replace Notion link-to-page blocks with inline detail panels.
 * Run after: node scripts/fetch-drova-details.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const drovaPath = join(root, "projects/drova.html");
let html = readFileSync(drovaPath, "utf8");

const linkRe =
  /<figure[^>]*id="([^"]+)"[^>]*link-to-page[^>]*><a href="https:\/\/www\.notion\.so\/([^"?]+)[^"]*">([^<]*)<\/a><\/figure>/g;

html = html.replace(linkRe, (match, figureId, slug, label) => {
  const detailPath = join(root, "assets/drova/details", `${figureId}.html`);
  const title = (label || "Details").replace(/:$/, "").trim();
  if (!existsSync(detailPath)) {
    console.warn(`Missing fragment: ${figureId}`);
    return `<p class="drova-details-missing"><em>${title}</em> — content not available.</p>`;
  }
  const fragment = readFileSync(detailPath, "utf8");
  if (!fragment.trim()) {
    return `<p class="drova-details-missing"><em>${title}</em> — content not available.</p>`;
  }
  return `<details class="drova-details" id="drova-${figureId}">
  <summary>${title}</summary>
  <div class="drova-details-body notion-detail-content">${fragment}</div>
</details>`;
});

if (!html.includes("drova.css")) {
  html = html.replace(
    '<link rel="stylesheet" href="../css/project-page.css" />',
    '<link rel="stylesheet" href="../css/project-page.css" />\n  <link rel="stylesheet" href="../css/drova.css" />'
  );
}

writeFileSync(drovaPath, html);
console.log("Updated projects/drova.html");
