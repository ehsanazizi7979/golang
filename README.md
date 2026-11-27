# golang — Go books + a chapters 1–3 study page

Reference PDFs for Go, plus a self-contained HTML summary of **chapters 1–3 of _Let's Go_**
(Alex Edwards, 2nd ed.) and a live Snippetbox demo server.

## What's here

| Path | What it is |
| --- | --- |
| `chapter-one.html` | The deliverable: chapters 1–3 summary, with all 15 figures and the code samples **embedded** (open it directly, no server needed) |
| `content/chapter1.html` | Chapter 1 text fragment (Introduction, Prerequisites) |
| `content/chapter2.html` | Chapter 2 text fragment (Foundations, sections 2.1–2.9) |
| `content/chapter3.html` | Chapter 3 text fragment (Configuration and error handling, 3.1–3.5 — no figures) |
| `content/page.js` | The summary page's script (demo buttons, live badges, Go highlighting) |
| `build_chapter1.py` | Rebuilds `chapter-one.html` from the PDF and the two fragments |
| `web/server.js` | Dependency-free Node server: the book's routes live, plus the pages below |
| `web/snippetbox/` | The book's actual project tree: `ui/html/*.tmpl`, `ui/static/{css,img,js}`, plus `app.js` (flags, leveled loggers, app struct) and `chapter3.js` (the demo pages) |
| `assets/` | The chapter-1 figures (`snippetbox-app.png`, `book-cover.png`) |
| `assets/ch2/` | The 14 chapter-2 figures, cropped from pp. 13–56 at 150 dpi |

## Run the live demo

```sh
node web/server.js          # http://localhost:3000/console
```

| URL | |
| --- | --- |
| `/summary` | The chapters 1–3 HTML summary (`chapter-one.html`) |
| `/logs` | Live `INFO`/`ERROR` stream from the custom loggers (chapter 3.2) |
| `/config` | The command-line flags this server parsed (chapter 3.1) |
| `/break` | Toggle the deliberate missing-template error (chapters 3.3/3.4) |
| `/console` | Request console — chapter 1: press a button, get a real HTTP response |
| `/home` | Templated home page — `base` + `nav` + `main`, rendered from the real `.tmpl` files |
| `/templates` | The same page with every template file shown beside it |
| `/static/` | `http.FileServer` + `StripPrefix` equivalent: listings, MIME types, 301/304/206 |
| `/book` | Chapter index page |
| `/showcase` | The "Create a new snippet" page rebuilt from the book's screenshot |
| `/routes` | Route table from section 2.3 + `main.go` |
| `/` | `Hello from Snippetbox` (raw text, exactly as chapter 2.2) |
| `/snippet/view?id=7` | Query-string handling (chapter 2.5) |
| `/snippet/create` | POST → 200; anything else → 405 + `Allow: POST` (chapter 2.4) |

### Command-line flags

The server implements the flag set from chapter 3.1, including `-help`:

```sh
node web/server.js -addr=:4000 -static-dir=./web/snippetbox/ui/static
node web/server.js -help
```

## Rebuild the summary

```sh
pip install pymupdf
python3 build_chapter1.py
```

The builder asserts that each source page still contains the text it summarises, and refuses
to run if an image placeholder is unresolved or unused.

## Source

`Let's Go [Alex Edwards].pdf` — chapter 1 on pp. 6–10 (Introduction, Conventions,
Prerequisites), chapter 2 on pp. 11–61 (Foundations, 2.1–2.9), chapter 3 on pp. 62–85
(Configuration and error handling, 3.1–3.5; this chapter contains no figures). The summary
paraphrases the text; the figures and code samples are embedded for study.
