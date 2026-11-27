# golang — Go books + a chapters 1–7 study page

Reference PDFs for Go, plus a self-contained HTML summary of **chapters 1–7 of _Let's Go_**
(Alex Edwards, 2nd ed.) and a live Snippetbox demo server.

## What's here

| Path | What it is |
| --- | --- |
| `chapter-one.html` | The deliverable: chapters 1–7 summary, with all 31 figures and the code samples **embedded** (open it directly, no server needed) |
| `content/chapter1.html` | Chapter 1 text fragment (Introduction, Prerequisites) |
| `content/chapter2.html` | Chapter 2 text fragment (Foundations, sections 2.1–2.9) |
| `content/chapter3.html` | Chapter 3 text fragment (Configuration and error handling, 3.1–3.5 — no figures) |
| `content/chapter4.html` | Chapter 4 text fragment (Database-driven responses, 4.1–4.9) |
| `content/chapter5.html` | Chapter 5 text fragment (Dynamic HTML templates, 5.1–5.6) |
| `content/chapter6.html` | Chapter 6 text fragment (Middleware, 6.1–6.5) |
| `content/chapter7.html` | Chapter 7 text fragment (Advanced routing, 7.1–7.2) |
| `content/page.js` | The summary page's script (demo buttons for every chapter, live badges, Go highlighting) |
| `build_chapter1.py` | Rebuilds `chapter-one.html` from the PDF and the chapter fragments |
| `web/server.js` | Dependency-free Node server: the book's routes live, plus the pages below |
| `web/snippetbox/` | The book's actual project tree: `ui/html/*.tmpl`, `ui/static/{css,img,js}`, plus `app.js` (flags, leveled loggers, app struct), `chapter3.js` (config/logging demo pages), `models.js` (an in-memory `snippets` table with the chapter's `SnippetModel`), `chapter4.js` (the SQL playground), `template.js` (a working `html/template`), `chapter5.js` (the template demo pages), `middleware.js` (the chapter-6 chain, real and traced), `chapter6.js`, `httprouter.js` (a working httprouter) and `chapter7.js` |
| `assets/` | The chapter-1 figures (`snippetbox-app.png`, `book-cover.png`) |
| `assets/ch2/` | The 14 chapter-2 figures, cropped from pp. 13–56 at 150 dpi |
| `assets/ch4/` | The 5 chapter-4 figures, cropped from pp. 92–120 at 150 dpi |
| `assets/ch5/` | The 9 chapter-5 figures, cropped from pp. 128–160 at 150 dpi |
| `assets/ch6/` | The chapter-6 figure (Firefox CSP console), p. 170 |
| `assets/ch7/` | The chapter-7 figure (a clean URL), p. 188 |

## Run the live demo

```sh
node web/server.js          # http://localhost:3000/console
```

| URL | |
| --- | --- |
| `/summary` | The chapters 1–7 HTML summary (`chapter-one.html`) |
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
| `/snippet/create` | POST → `Insert()` → 303 to `/snippet/view?id=N`; anything else → 405 + `Allow: POST` (chapters 2.4, 4.6) |
| `/db` | SQL playground: `?` parameters vs. interpolation, `Exec()`, the connection pool (chapter 4) |
| `/db/transaction` | Begin → two statements → Rollback, with the all-or-nothing guarantee (chapter 4.9) |
| `/snippet/view?id=1` | The `%+v` struct dump from figure 4.3 (chapter 4.7) |
| `/snippets` | The `Latest()` dump from figure 4.5 (chapter 4.8) |
| `/newsnippets` | The home page rendered from the real `home.tmpl` (chapter 5.2/5.3) |
| `/newsnippets/view?id=1` | The snippet page from `view.tmpl` with `humanDate` (chapter 5.6) |
| `/tplx` | Template playground: edit a template, run it (chapter 5.2) |
| `/tplx/escape` | `html/template` vs `text/template` escaping (chapter 5.1) |
| `/tplx/error` | The two-stage render and the `len nil` runtime error (chapter 5.4) |
| `/middleware` | The chain executed link by link, with the five security headers (chapter 6) |
| `/middleware/panic` | Panic recovery: empty reply vs. a proper 500 (chapter 6.4) |
| `/middleware/alice` | `alice.New(...).Then(mux)` and named chains (chapter 6.5) |
| `/router` | The route table, plus a probe that asks the real matcher (chapter 7) |
| `/clean`, `/clean/snippet/view/1` | The same app on httprouter: clean URLs, 405 + `Allow`, custom 404 (chapter 7.2) |

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
(Configuration and error handling, 3.1–3.5; this chapter contains no figures) and chapter 4
on pp. 86–126 (Database-driven responses, 4.1–4.9) and chapter 5 on pp. 127–161 (Dynamic HTML
templates, 5.1–5.6) chapter 6 on pp. 162–179 (Middleware, 6.1–6.5) and chapter 7 on pp. 180–192 (Advanced routing, 7.1–7.2). The summary
paraphrases the text; the figures and code samples are embedded for study.
