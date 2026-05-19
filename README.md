# Portfolio — Lam Pham

Product manager portfolio, hosted on [GitHub Pages](https://pages.github.com/).

**Live site:** https://lampham1991.github.io/my-portfolio/

## Structure

- `index.html` — main page (Notion HTML + styles)
- `css/notion.css` — styles exported from Notion
- `css/site.css` — small GitHub Pages additions
- `assets/profile.png` — profile photo
- `projects/` — case study pages

## Local preview

```bash
python3 -m http.server 8000
```

Open http://localhost:8000

## Updating from Notion

1. In Notion: **⋯ → Export → HTML**
2. Replace content using the same export path or re-run the build steps in this repo.
3. Commit and push to `main`.
