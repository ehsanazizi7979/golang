# golang — Go books + a chapter-one study page

Reference PDFs for Go, plus a self-contained HTML summary of **chapter one of _Let's Go_**
(Alex Edwards, 2nd ed.) and a live Snippetbox demo server.

## What's here

| Path | What it is |
| --- | --- |
| `chapter-one.html` | The deliverable: chapter-one summary with the book's figure and code samples **embedded** (open it directly, no server needed) |
| `build_chapter1.py` | Rebuilds `chapter-one.html` from the PDF (asserts the source pages still match) |
| `web/server.js` | Dependency-free Node server: the book's routes live, plus the pages below |
| `assets/snippetbox-app.png` | The chapter's only figure, extracted from page 6 at 200 dpi |
| `assets/book-cover.png` | Cover art, extracted from page 1 |

## Run the live demo

```sh
node web/server.js          # http://localhost:3000/console
```

| URL | |
| --- | --- |
| `/console` | Request console — press a button, get a real HTTP response |
| `/showcase` | The "Create a new snippet" page rebuilt from the book's screenshot |
| `/routes` | Route table from section 2.3 + `main.go` |
| `/summary` | The chapter-one HTML summary |
| `/` | `Hello from Snippetbox` (raw text, exactly as chapter 2.2) |
| `/snippet/view?id=7` | Query-string handling (chapter 2.5) |
| `/snippet/create` | POST → 200; anything else → 405 + `Allow: POST` (chapter 2.4) |

## Rebuild the summary

```sh
pip install pymupdf
python3 build_chapter1.py
```

## Source

`Let's Go [Alex Edwards].pdf` — chapter one lives on pp. 6–10 (Introduction, Conventions,
About the author, Copyright, Prerequisites). The summary paraphrases the chapter; the figure
and code samples are embedded for study.
