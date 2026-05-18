#!/usr/bin/env python3
"""Clean Drova detail fragments: semantic tables, lists, paragraphs."""

import re
from html import escape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DETAILS = ROOT / "assets" / "drova" / "details"


def strip_tags(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ")
    text = text.replace("|", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self._row = []
        self._cell = []
        self._in_td = False
        self._capture = False

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag == "td":
            self._in_td = True
            self._cell = []
        elif self._in_td and tag in ("motion", "div", "span"):
            cls = dict(attrs).get("class", "")
            if "content-editable-leaf" in cls or "notion-table-cell" in cls:
                self._capture = True

    def handle_endtag(self, tag):
        if tag == "td" and self._in_td:
            self._row.append(strip_tags("".join(self._cell)))
            self._in_td = False
            self._capture = False
        elif tag == "tr" and self._row:
            self.rows.append(self._row)

    def handle_data(self, data):
        if self._in_td and self._capture:
            self._cell.append(data)


def table_to_html(table_html: str) -> str:
    parser = TableParser()
    parser.feed(table_html)
    if not parser.rows:
        return table_html

    lines = ['<table class="simple-table">', "<tbody>"]
    for i, row in enumerate(parser.rows):
        lines.append("<tr>")
        tag = "th" if i == 0 else "td"
        for cell in row:
            cell_html = escape(cell).replace("\n", "<br />")
            lines.append(f"<{tag}>{cell_html}</{tag}>")
        lines.append("</tr>")
    lines.append("</tbody></table>")
    return "\n".join(lines)


def extract_leaf_text(block_html: str) -> str:
    m = re.search(
        r'class="[^"]*content-editable-leaf[^"]*"[^>]*>(.*?)</div>',
        block_html,
        re.DOTALL | re.I,
    )
    if m:
        return strip_tags(m.group(1))
    return strip_tags(block_html)


def is_table_block(block: str) -> bool:
    return "<table" in block


def is_list_block(block: str) -> bool:
    return "notion-list-item-box-left" in block


def is_heading_block(block: str) -> bool:
    if is_table_block(block) or is_list_block(block):
        return False
    text = extract_leaf_text(block)
    if not text or len(text) > 120:
        return False
    # short title-like lines
    if re.match(r"^[IVX]+\.|^[IVX]+\)|^\d+\.|^[A-Z][\w\s\-/&]+$", text):
        return True
    if "notion-enable-hover" in block and len(text) < 80:
        return True
    return False


def block_to_html(block: str) -> str:
    block = block.strip()
    if not block:
        return ""

    if is_table_block(block):
        m = re.search(r"<table>.*?</table>", block, re.DOTALL | re.I)
        if m:
            return table_to_html(m.group(0))
        return ""

    if is_list_block(block):
        text = extract_leaf_text(block)
        if text:
            return f"<li>{escape(text)}</li>"
        return ""

    text = extract_leaf_text(block)
    if not text:
        return ""

    if is_heading_block(block):
        return f"<h4>{escape(text)}</h4>"

    return f"<p>{escape(text).replace(chr(10), '<br />')}</p>"


def sanitize_file(html: str) -> str:
    blocks = re.findall(
        r'<div class="notion-block" data-block-id="[^"]+">.*?</div>(?=\s*(?:<div class="notion-block"|$))',
        html,
        re.DOTALL,
    )
    if not blocks:
        return html

    out = []
    list_buf = []

    def flush_list():
        nonlocal list_buf
        if list_buf:
            out.append("<ul>")
            out.extend(list_buf)
            out.append("</ul>")
            list_buf = []

    for block in blocks:
        if is_list_block(block):
            item = block_to_html(block)
            if item:
                list_buf.append(item)
            continue

        flush_list()
        piece = block_to_html(block)
        if piece:
            out.append(piece)

    flush_list()
    return "\n".join(out)


def main():
    for path in sorted(DETAILS.glob("*.html")):
        if path.name == "manifest.json":
            continue
        raw = path.read_text(encoding="utf-8")
        if "notion-block" not in raw:
            continue
        cleaned = sanitize_file(raw)
        if cleaned and len(cleaned) < len(raw) * 0.95:
            path.write_text(cleaned, encoding="utf-8")
            print(f"✓ {path.name} ({len(raw)} → {len(cleaned)} chars)")
        else:
            print(f"· {path.name} (unchanged)")


if __name__ == "__main__":
    main()
