#!/usr/bin/env python3
"""
Build chapter-one.html — a single self-contained file.

Sources
  Let's Go [Alex Edwards].pdf  (2nd ed., v2.20.0)
    page  6  -> Chapter 1   Introduction   (the screenshot on this page is the
                                            only figure in chapter one)
    page  7  -> Conventions, About the author
    page  8  -> Copyright and disclaimer
    page  9  -> Chapter 1.1 Prerequisites / Background knowledge / Go 1.20
    page 10  -> Other software
    page 14  -> the Hello world main.go used by the live demo (chapter 2.1)
  assets/snippetbox-app.png  -> cropped figure from page 6, embedded as base64
  assets/book-cover.png      -> page 1 cover art, embedded as base64
"""

import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
PDF = ROOT / "Let's Go [Alex Edwards].pdf"


def b64(p: pathlib.Path) -> str:
    return base64.b64encode(p.read_bytes()).decode("ascii")


def verify_pages() -> None:
    """Fail loudly if the PDF no longer matches the source pages we summarised."""
    try:
        import pymupdf
    except ImportError:  # pragma: no cover
        print("pymupdf not installed; skipping page verification")
        return
    doc = pymupdf.open(PDF)
    checks = {6: "Chapter 1.", 9: "Chapter 1.1.", 10: "A web browser with good developer tools"}
    for pno, needle in checks.items():
        text = doc[pno - 1].get_text()
        assert needle in text, f"page {pno} no longer contains {needle!r}"
    print("verified source pages", sorted(checks))


APP_IMG = b64(ROOT / "assets" / "snippetbox-app.png")
COVER_IMG = b64(ROOT / "assets" / "book-cover.png")
DEMO_PORT = 3000

HTML = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Let's Go — Chapter 1 summary</title>
<style>
:root{{
  --ink:#283c46; --soft:#54636c; --faint:#7b8b93; --paper:#fff; --page:#f1f3f6;
  --green:#64c52f; --green-dark:#4ea61f;
  --code-bg:#f9f9f9; --term:#283c46; --term-fg:#e8edf0;
  --kw:#a82255; --str:#008075; --lit:#5642a6; --com:#818181;
  --mono:"Ubuntu Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  --sans:"Source Sans Pro","Source Sans 3",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --maxw:820px;
}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth}}
body{{margin:0;background:var(--page);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}}
a{{color:#0f7ea3;text-decoration:none;border-bottom:1px solid rgba(15,126,163,.28)}}
a:hover{{border-bottom-color:#0f7ea3}}
.wrap{{max-width:var(--maxw);margin:0 auto;padding:0 22px}}

/* ---------- hero ---------- */
.hero{{background:var(--page);padding:54px 0 34px}}
.hero .kicker{{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:0 0 10px}}
.hero h1{{font-size:46px;line-height:1.1;letter-spacing:-1px;margin:0 0 16px}}
.hero h1 span{{color:var(--green)}}
.hero p{{font-size:18px;color:var(--soft);margin:0 0 24px;max-width:640px}}
.meta{{display:flex;flex-wrap:wrap;gap:10px;font-size:13px;color:var(--faint)}}
.meta span{{background:#fff;border:1px solid #e4e9ed;border-radius:999px;padding:4px 12px}}

/* ---------- layout ---------- */
.layout{{display:grid;grid-template-columns:1fr;gap:28px;align-items:start;padding-bottom:80px}}
@media (min-width:1080px){{
  .layout{{grid-template-columns:230px minmax(0,1fr);max-width:1120px;margin:0 auto;padding:0 22px 90px}}
  .toc{{position:sticky;top:24px}}
}}
.toc{{background:#fff;border:1px solid #e4e9ed;border-radius:10px;padding:18px 20px;font-size:14px}}
.toc h2{{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);margin:0 0 10px;font-weight:600}}
.toc ol{{margin:0;padding-left:18px;color:var(--soft)}}
.toc li{{margin:5px 0}}
.toc a{{border:0;color:var(--soft)}}
.toc a:hover{{color:var(--green-dark)}}
article{{min-width:0}}

/* ---------- prose ---------- */
h2.sec{{font-size:14px;letter-spacing:.13em;text-transform:uppercase;color:var(--green-dark);
  margin:52px 0 6px;font-weight:700}}
h2.sec:first-child{{margin-top:0}}
h3{{font-size:27px;line-height:1.25;letter-spacing:-.4px;margin:0 0 14px}}
p{{margin:0 0 16px}}
.lead{{font-size:19px;color:var(--soft)}}
hr.rule{{border:0;border-top:1px solid #e0e6ea;margin:40px 0}}
.note{{border-left:3px solid var(--green);background:#f4faf0;border-radius:0 6px 6px 0;padding:14px 18px;margin:22px 0;font-size:16px}}
.note b{{color:#40761c}}
blockquote{{margin:0 0 16px;padding:2px 0 2px 18px;border-left:3px solid #d6dee3;color:var(--soft)}}

/* ---------- figures ---------- */
figure{{margin:26px 0 30px}}
figure.shot{{background:#fff;border:1px solid #e0e6ea;border-radius:10px;padding:10px}}
figure.shot img{{display:block;width:100%;height:auto;border-radius:5px}}
figcaption{{font-size:13.5px;color:var(--faint);padding:10px 4px 2px;line-height:1.5}}
figcaption b{{color:var(--soft);font-weight:600}}
.cover{{display:flex;gap:22px;align-items:flex-start;background:#fff;border:1px solid #e4e9ed;border-radius:10px;
  padding:18px;margin:0 0 30px;flex-wrap:wrap}}
.cover img{{width:150px;border-radius:5px;display:block;box-shadow:0 8px 20px rgba(40,60,70,.18)}}
.cover div{{flex:1;min-width:240px;font-size:15px;color:var(--soft)}}
.cover strong{{display:block;color:var(--ink);font-size:17px;margin-bottom:2px}}

/* ---------- code ---------- */
.codeblock{{margin:22px 0 26px;border:1px solid #e6ebee;border-radius:8px;overflow:hidden;background:#fff}}
.codeblock .titlebar{{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#f7f9fa;
  border-bottom:1px solid #e9eef1;font-family:var(--mono);font-size:12.5px;color:var(--faint)}}
.codeblock .dots{{display:flex;gap:5px}}
.codeblock .dots i{{width:9px;height:9px;border-radius:50%;background:#dfe6ea;display:block}}
.codeblock .lang{{margin-left:auto;text-transform:uppercase;letter-spacing:.08em;font-size:10.5px}}
pre{{margin:0;font-family:var(--mono);font-size:13.5px;line-height:1.6;overflow:auto;padding:15px 17px}}
pre.code{{background:var(--code-bg);color:var(--ink)}}
pre.term{{background:var(--term);color:var(--term-fg)}}
pre.term .prompt{{color:#fff}}
pre.term .out{{color:#c0c0c0}}
.kw{{color:var(--kw)}} .str{{color:var(--str)}} .lit{{color:var(--lit)}} .com{{color:var(--com)}}

/* ---------- live demo ---------- */
.demo{{background:#fff;border:1px solid #e0e6ea;border-radius:12px;overflow:hidden;margin:26px 0 10px;
  box-shadow:0 10px 30px rgba(40,60,70,.07)}}
.demo__head{{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e9eef1;background:#f7f9fa;flex-wrap:wrap}}
.demo__head h3{{margin:0;font-size:17px;letter-spacing:0}}
.live{{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:#2f8f4e;font-weight:700}}
.live i{{width:8px;height:8px;border-radius:50%;background:#37c26b;box-shadow:0 0 0 0 rgba(55,194,107,.6);animation:pulse 1.8s infinite}}
@keyframes pulse{{70%{{box-shadow:0 0 0 8px rgba(55,194,107,0)}}100%{{box-shadow:0 0 0 0 rgba(55,194,107,0)}}}}
.demo__body{{padding:18px}}
.row{{display:flex;gap:10px;flex-wrap:wrap}}
button.btn,.btn{{display:inline-flex;align-items:center;gap:8px;border:1px solid #dfe6ea;background:#fff;color:var(--ink);
  font:inherit;font-size:14px;padding:9px 14px;border-radius:5px;cursor:pointer;transition:.12s;border-bottom:1px solid #dfe6ea}}
button.btn:hover,.btn:hover{{border-color:#c9d4da;transform:translateY(-1px)}}
button.btn:disabled{{opacity:.55;cursor:progress;transform:none}}
.btn--green{{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}}
.btn--green:hover{{background:var(--green-dark);border-color:var(--green-dark)}}
.btn--dark{{background:var(--ink);border-color:var(--ink);color:#fff}}
.btn small{{opacity:.8;font-weight:400}}
.method{{display:inline-block;font-family:var(--mono);font-size:11.5px;padding:2px 7px;border-radius:3px;border:1px solid;margin-right:8px;vertical-align:2px}}
.method.get{{color:#2b7a90;border-color:#bfdbe3;background:#f1f9fb}}
.method.post{{color:#7d5a00;border-color:#e8d9a8;background:#fdf8e6}}
code.path{{font-family:var(--mono);font-size:14px;background:#f2f5f7;padding:2px 6px;border-radius:3px}}
.resp{{margin-top:14px;border:1px solid #e7ecf0;border-radius:6px;overflow:hidden;background:#fff}}
.resp__bar{{display:flex;gap:10px;align-items:center;padding:8px 12px;background:#f7f9fa;border-bottom:1px solid #edf1f3;font-family:var(--mono);font-size:12px}}
.status{{font-weight:700}}
.status.ok{{color:#2f8f4e}} .status.warn{{color:#b37500}} .status.bad{{color:#b3382c}}
.resp pre{{background:var(--term);color:var(--term-fg);max-height:210px;font-size:12.5px}}
.resp .meta{{padding:9px 12px;font-family:var(--mono);font-size:11.5px;color:#6d7c84;border-top:1px dashed #e7ecf0;white-space:pre-wrap;background:#fcfdfd}}
.field{{margin:14px 0}}
.field label{{display:block;font-size:14px;margin-bottom:6px;color:var(--soft)}}
.field input[type=text],.field textarea{{width:100%;border:1px solid #dfe6ea;border-radius:4px;padding:10px 12px;font:inherit;font-size:14px;background:#fbfcfd}}
.field textarea{{min-height:110px;resize:vertical}}
.radios{{display:flex;gap:20px;flex-wrap:wrap;font-size:14px;margin:14px 0 18px;color:var(--soft)}}
.radios label{{display:flex;gap:7px;align-items:center}}
.demo__foot{{padding:12px 18px;border-top:1px solid #e9eef1;background:#fbfcfd;font-size:13px;color:var(--faint);display:flex;gap:14px;flex-wrap:wrap}}
.demo__foot a{{border:0;color:var(--faint);text-decoration:underline}}

/* ---------- misc ---------- */
table{{width:100%;border-collapse:collapse;font-size:15px;margin:18px 0 6px;background:#fff;border:1px solid #e4e9ed;border-radius:8px;overflow:hidden}}
th,td{{text-align:left;padding:10px 13px;border-bottom:1px solid #eef2f4;vertical-align:top}}
th{{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);background:#f9fbfc;font-weight:600}}
tr:last-child td{{border-bottom:0}}
td code{{font-family:var(--mono);font-size:13.5px}}
ol.steps{{padding-left:20px}}
ol.steps li{{margin:0 0 12px}}
ol.steps code,p code,li code{{font-family:var(--mono);font-size:.92em;background:#eef2f4;padding:1.5px 5px;border-radius:3px}}
.chips{{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 6px;padding:0;list-style:none}}
.chips li{{background:#fff;border:1px solid #e4e9ed;border-radius:999px;padding:5px 12px;font-size:13.5px;color:var(--soft)}}
footer{{border-top:1px solid #e0e6ea;padding:26px 0 60px;font-size:13px;color:var(--faint);line-height:1.7}}
footer a{{border:0;text-decoration:underline}}
.toast{{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);background:var(--ink);color:#fff;
  padding:10px 18px;border-radius:999px;font-size:14px;opacity:0;pointer-events:none;transition:.25s;z-index:9}}
.toast.on{{opacity:1;transform:translate(-50%,0)}}
@media (max-width:640px){{
  .hero h1{{font-size:34px}} body{{font-size:16px}} h3{{font-size:23px}}
}}
</style>
</head>
<body>

<div class="hero">
  <div class="wrap">
    <p class="kicker">Let’s Go · Alex Edwards · 2nd edition, v2.20.0</p>
    <h1>Chapter 1 — <span>Introduction</span><br>&amp; Prerequisites</h1>
    <p>Build Snippetbox: a web app for pasting and sharing snippets of text. Chapter one is short on code and long on
       purpose — it shows you the finished application, explains what you’ll learn, and gets Go 1.20 onto your machine.</p>
    <div class="meta">
      <span>4 pages of source (pp. 6–10)</span>
      <span>1 figure, embedded below</span>
      <span>Live demo on port {DEMO_PORT}</span>
      <span>Reading time ≈ 5 min</span>
    </div>
  </div>
</div>

<div class="layout">
  <nav class="toc">
    <h2>On this page</h2>
    <ol>
      <li><a href="#intro">Introduction</a></li>
      <li><a href="#figure">The screenshot</a></li>
      <li><a href="#path">What the app teaches</a></li>
      <li><a href="#demo">Live demo</a></li>
      <li><a href="#learned">Already-learned basics</a></li>
      <li><a href="#prereq">Prerequisites</a></li>
      <li><a href="#go120">Go 1.20</a></li>
      <li><a href="#software">Other software</a></li>
      <li><a href="#conventions">Conventions &amp; hints</a></li>
      <li><a href="#next">Where it goes next</a></li>
    </ol>
  </nav>

  <article>
    <div class="cover">
      <img src="data:image/png;base64,{COVER_IMG}" alt="Cover of Let’s Go by Alex Edwards, 2nd edition">
      <div>
        <strong>Let’s Go: Learn to build professional web applications with Go</strong>
        Alex Edwards · 2nd edition · version 2.20.0, last updated 2023-02-17 · 426 pages.
        Chapter one is the on-ramp: what we’re building, what you need installed, and how to read the code samples.
      </div>
    </div>

    <h2 class="sec" id="intro">The chapter</h2>
    <h3>“In this book we’ll be building a web application called Snippetbox.”</h3>
    <p class="lead">Snippetbox lets people paste and share snippets of text — a bit like
      <a href="https://pastebin.com/" target="_blank" rel="noopener">Pastebin</a> or
      <a href="https://gist.github.com/" target="_blank" rel="noopener">GitHub’s Gists</a>. By the end of the book it
      looks like the screenshot below: a “Create a New Snippet” page with a title field, a content box, a
      <em>Delete in</em> choice of one year / one week / one day, and a green <em>Publish snippet</em> button.</p>
    <p>The application starts off super simple, with just one web page. Then with each chapter it’s built up
      step-by-step until a user can save and view snippets through the app. That journey covers how to structure a
      project, routing requests, working with a database, processing forms and displaying dynamic data safely.</p>
    <p>Later in the book user accounts are added, and the application is restricted so that only registered users can
      create snippets — which brings in configuring a HTTPS server, session management, user authentication and
      middleware.</p>

    <h2 class="sec" id="figure">Figure 1.1 — the finished app</h2>
    <figure class="shot">
      <img src="data:image/png;base64,{APP_IMG}" alt="Screenshot of the finished Snippetbox application: a Create a New Snippet page with Title, Content, Delete in options and a Publish snippet button.">
      <figcaption><b>The only figure in chapter one.</b> Extracted from page 6 of the PDF and embedded in this file as
        base64, so the page works offline and has no external dependencies. The address bar reads
        <code>https://localhost:4000/snippet/create</code> — the route built in chapter 2.3, served over the TLS
        listener from chapter 10.</figcaption>
    </figure>
    <p class="note"><b>Why show the end first?</b> Everything in chapters 2–15 is a step towards this one form. Keeping
      the screenshot in mind makes the incremental refactors — a handler, then a servemux, then templates, then a
      database — feel like progress rather than churn.</p>

    <h2 class="sec" id="path">The route from one page to a real app</h2>
    <table>
      <thead><tr><th>Stage</th><th>What gets added</th><th>Where in the book</th></tr></thead>
      <tbody>
        <tr><td>One web page</td><td>Handlers, a servemux, <code>http.ListenAndServe</code></td><td>Ch. 2, Foundations</td></tr>
        <tr><td>Structure</td><td>Configuration, logging, dependency injection, error handling</td><td>Ch. 3</td></tr>
        <tr><td>Snippets persist</td><td>MySQL connection pool, models, SQL queries, transactions</td><td>Ch. 4</td></tr>
        <tr><td>Dynamic pages</td><td>HTML templates, cached templates, custom functions</td><td>Ch. 5</td></tr>
        <tr><td>Forms</td><td>Parsing, validating, repopulating, displaying errors</td><td>Ch. 8</td></tr>
        <tr><td>Users</td><td>Sessions, signup, login, authorization, CSRF</td><td>Ch. 9–12</td></tr>
        <tr><td>Production</td><td>HTTPS, timeouts, security headers, tests</td><td>Ch. 10, 14</td></tr>
      </tbody>
    </table>

    <h2 class="sec" id="demo">Live demo</h2>
    <p>Chapter one contains no Go code of its own, so the demo below is the first thing it promises: the Snippetbox
      server from chapters 2.2–2.5, running right now on this machine and serving genuine HTTP responses. Press the
      buttons — each one issues a real request and shows the status line, headers and body that the book's handlers
      produce.</p>

    <div class="demo">
      <div class="demo__head">
        <h3>Snippetbox request console</h3>
        <span class="live"><i></i><span id="demoState">connecting…</span></span>
        <a class="btn" id="openDemo" href="http://localhost:{DEMO_PORT}/console" target="_blank" rel="noopener" style="margin-left:auto">Open full console ↗</a>
      </div>

      <div class="demo__body">
        <p style="margin:0 0 10px"><span class="method get">GET</span><code class="path">/</code>
          <span style="color:#7b8b93;font-size:14px">— the home handler</span></p>
        <div class="row">
          <button class="btn btn--green" data-run="GET /">Send request</button>
        </div>
        <div class="resp" data-slot="home" hidden></div>

        <hr class="rule" style="margin:22px 0">

        <p style="margin:0 0 10px"><span class="method get">GET</span><code class="path">/snippet/view?id=7</code>
          <span style="color:#7b8b93;font-size:14px">— query strings</span></p>
        <div class="row">
          <button class="btn btn--green" data-run="GET /snippet/view?id=7">Valid id</button>
          <button class="btn" data-run="GET /snippet/view?id=abc">Invalid id</button>
          <button class="btn" data-run="GET /snippet/view">Missing id</button>
        </div>
        <div class="resp" data-slot="view" hidden></div>

        <hr class="rule" style="margin:22px 0">

        <p style="margin:0 0 10px"><span class="method post">POST</span><code class="path">/snippet/create</code>
          <span style="color:#7b8b93;font-size:14px">— method-based routing and 405s</span></p>
        <div class="row">
          <button class="btn btn--green" data-run="POST /snippet/create">POST request</button>
          <button class="btn" data-run="GET /snippet/create">GET</button>
          <button class="btn" data-run="PUT /snippet/create">PUT</button>
          <button class="btn" data-run="DELETE /snippet/create">DELETE</button>
        </div>
        <div class="resp" data-slot="create" hidden></div>

        <hr class="rule" style="margin:22px 0">

        <p style="margin:0 0 10px"><strong>The form from the screenshot</strong>
          <span style="color:#7b8b93;font-size:14px">— non-functional replica, kept here so you can compare with Figure 1.1</span></p>
        <div class="field"><label for="dTitle">Title:</label>
          <input id="dTitle" type="text" placeholder="An example snippet"></div>
        <div class="field"><label for="dContent">Content:</label>
          <textarea id="dContent" placeholder="Paste anything you like here…"></textarea></div>
        <div class="radios">
          <span>Delete in:</span>
          <label><input type="radio" name="demo-del" checked> One Year</label>
          <label><input type="radio" name="demo-del"> One Week</label>
          <label><input type="radio" name="demo-del"> One Day</label>
        </div>
        <button class="btn btn--green" id="publishBtn">Publish snippet</button>
      </div>

      <div class="demo__foot">
        <span>Server: <code>GET /</code> · <code>GET /snippet/view</code> · <code>POST /snippet/create</code> · <code>GET /api/log</code></span>
        <a href="http://localhost:{DEMO_PORT}/routes" target="_blank" rel="noopener">route table</a>
        <a href="http://localhost:{DEMO_PORT}/showcase" target="_blank" rel="noopener">showcase page</a>
        <a href="http://localhost:{DEMO_PORT}/" target="_blank" rel="noopener">raw “Hello from Snippetbox”</a>
      </div>
    </div>
    <p style="font-size:14px;color:#7b8b93">The demo server is plain Node.js with zero dependencies, started separately
      from this file. If a request fails, start it with <code>node web/server.js</code> in the repository root, then
      reload. Everything above degrades gracefully: the HTML summary, figure and code samples all work offline.</p>

    <h2 class="sec" id="learned">Prerequisites — background knowledge</h2>
    <p>The book is designed for people who are new to Go, but it’s more enjoyable if you have a general understanding
      of Go’s syntax first. If you find yourself struggling with the syntax, <em>The Little Go Book</em> by Karl Seguin
      is a fantastic tutorial, and for something more interactive the <em>Tour of Go</em> is the recommendation.</p>
    <p>You’re also expected to have a (very) basic understanding of HTML/CSS and SQL, and some familiarity with using a
      terminal. If you’ve built a web application in any other language before — Ruby, Python, PHP or C# — the book is
      a good fit.</p>
    <ul class="chips">
      <li>Go syntax basics</li>
      <li>Basic HTML &amp; CSS</li>
      <li>Basic SQL</li>
      <li>Comfortable in a terminal</li>
    </ul>
    <p style="margin-top:14px">Helpful links from the chapter:
      <a href="http://openmymind.net/The-Little-Go-Book/" target="_blank" rel="noopener">The Little Go Book</a> ·
      <a href="https://tour.golang.org/welcome/1" target="_blank" rel="noopener">A Tour of Go</a></p>

    <h2 class="sec" id="go120">Prerequisites — Go 1.20</h2>
    <p>The book is correct for the latest major release of Go (version 1.20), and that’s the version to install if you
      want to code along. If Go is already installed, check it from the terminal with <code>go version</code>:</p>

    <div class="codeblock">
      <div class="titlebar"><span class="dots"><i></i><i></i><i></i></span><span>Terminal</span><span class="lang">shell</span></div>
      <pre class="term"><span class="prompt">$ go version</span>
<span class="out">go version go1.20 linux/amd64</span></pre>
    </div>

    <p>If you need to upgrade — or install Go from scratch — do it now. The chapter points at these instructions:</p>
    <table>
      <thead><tr><th>Task</th><th>Link given in the book</th></tr></thead>
      <tbody>
        <tr><td>Remove an old version of Go</td><td><a href="https://golang.org/doc/manage-install#uninstalling" target="_blank" rel="noopener">golang.org/doc/manage-install</a></td></tr>
        <tr><td>Install on macOS</td><td><a href="https://golang.org/doc/install#tarball" target="_blank" rel="noopener">golang.org/doc/install</a></td></tr>
        <tr><td>Install on Windows</td><td><a href="https://golang.org/doc/install#windows" target="_blank" rel="noopener">golang.org/doc/install</a></td></tr>
        <tr><td>Install on Linux</td><td><a href="https://golang.org/doc/install#tarball" target="_blank" rel="noopener">golang.org/doc/install</a></td></tr>
        <tr><td>Release history</td><td><a href="https://golang.org/doc/devel/release.html" target="_blank" rel="noopener">golang.org/doc/devel/release.html</a></td></tr>
      </tbody>
    </table>

    <h2 class="sec" id="software">Prerequisites — other software</h2>
    <p>A few other bits of software should be available if you want to follow along fully:</p>
    <ol class="steps">
      <li><strong><code>curl</code></strong> — for working with HTTP requests and responses from your terminal. On macOS
        and Linux it’s usually pre-installed or in your software repositories; otherwise
        <a href="https://curl.haxx.se/download.html" target="_blank" rel="noopener">download the latest version</a>.</li>
      <li><strong>A web browser with good developer tools</strong> — the book uses Firefox, but Chromium, Chrome or
        Microsoft Edge work just as well.</li>
      <li><strong>Your favourite text editor</strong> — the chapter ends there, mid-sentence, because any editor will do.</li>
    </ol>

    <h2 class="sec" id="conventions">How to read the book</h2>
    <p>Chapter one also sets the conventions used throughout — worth knowing before you copy a single line.</p>
    <p>Code blocks have a silver background; long blocks may replace irrelevant parts with an ellipsis. Most blocks carry
      a title bar naming the file you’re working on:</p>

    <div class="codeblock">
      <div class="titlebar"><span class="dots"><i></i><i></i><i></i></span><span>File: hello.go</span><span class="lang">go</span></div>
      <pre class="code is-highlighted"><span class="kw">package</span> main

<span class="lit">...</span> <span class="com">// Indicates that some existing code has been omitted.</span>

<span class="kw">func</span> sayHello() {{
    fmt.Println(<span class="str">"Hello world!"</span>)
}}</pre>
    </div>

    <p>Terminal instructions have a black background and start with a dollar sign. They work on any Unix-based system,
      macOS and Linux alike; sample output appears in silver beneath the command:</p>

    <div class="codeblock">
      <div class="titlebar"><span class="dots"><i></i><i></i><i></i></span><span>Terminal</span><span class="lang">shell</span></div>
      <pre class="term"><span class="prompt">$ echo "Hello world!"</span>
<span class="out">Hello world!</span></pre>
    </div>

    <p>On Windows, substitute the DOS equivalent or use the normal Windows GUI. Some chapters finish with an
      <em>additional information</em> section that isn’t needed for the build but is still important — very new Gophers
      can skip those and circle back later.</p>

    <p class="note"><b>Hint from the book:</b> if you’re following along with the application build, use the HTML version
      of the book rather than the PDF or EPUB. It works in all browsers, and the formatting of code blocks is retained if
      you want to copy-and-paste code directly.</p>

    <h2 class="sec">The chapter’s one piece of code</h2>
    <p>Strictly, chapter one ships no Go. The very next chapter opens with the project skeleton and the traditional
      first program, included here because it’s what the live demo is built on:</p>

    <div class="codeblock">
      <div class="titlebar"><span class="dots"><i></i><i></i><i></i></span><span>File: main.go</span><span class="lang">go</span></div>
      <pre class="code"><span class="kw">package</span> main

<span class="kw">import</span> <span class="str">"fmt"</span>

<span class="kw">func</span> main() {{
    fmt.Println(<span class="str">"Hello world!"</span>)
}}</pre>
    </div>

    <div class="codeblock">
      <div class="titlebar"><span class="dots"><i></i><i></i><i></i></span><span>Terminal</span><span class="lang">shell</span></div>
      <pre class="term"><span class="prompt">$ touch main.go</span>
<span class="prompt">$ go run .</span>
<span class="out">Hello world!</span></pre>
    </div>

    <h2 class="sec" id="next">Where it goes next</h2>
    <p>Chapter one ends with the machine ready and the destination clear. Chapter 2, <em>Foundations</em>, immediately
      starts building:</p>
    <pre class="term" style="border-radius:8px"><span class="prompt">Chapter 2.1</span>  Project setup and creating a module
<span class="prompt">Chapter 2.2</span>  Web application basics        <span class="out">← the live demo's "/" route</span>
<span class="prompt">Chapter 2.3</span>  Routing requests                <span class="out">← /snippet/view and /snippet/create</span>
<span class="prompt">Chapter 2.4</span>  Customizing HTTP headers        <span class="out">← the 405 + Allow: POST behaviour</span>
<span class="prompt">Chapter 2.5</span>  URL query strings               <span class="out">← ?id= query parsing</span>
<span class="prompt">Chapter 2.6</span>  Project structure and organization
<span class="prompt">Chapter 2.7</span>  HTML templating and inheritance
<span class="prompt">Chapter 2.8</span>  Serving static files
<span class="prompt">Chapter 2.9</span>  The http.Handler interface</pre>

    <hr class="rule">

    <p style="font-size:15px;color:#54636c">A paragraph-by-paragraph summary of chapter one of
      <em>Let’s Go: Learn to build professional web applications with Go</em> by Alex Edwards (2nd edition, v2.20.0),
      with the chapter’s single figure and its code samples embedded. Demo server and this page are independent of the
      book; the book text is summarised, not reproduced.</p>
  </article>
</div>

<footer>
  <div class="wrap">
    Summary generated from <code>Let’s Go [Alex Edwards].pdf</code> in this repository (pages 6–10, plus the
    <code>main.go</code> from page 14 for the demo). Figure extracted at 200 dpi with PyMuPDF and embedded as base64.<br>
    Live demo: <code>web/server.js</code> — dependency-free Node.js reimplementation of the Snippetbox routes, listening
    on <code>0.0.0.0:{DEMO_PORT}</code>. Rebuild this page with <code>python3 build_chapter1.py</code>.
  </div>
</footer>

<div class="toast" id="toast"></div>

<script>
(function () {{
  var DEMO = 'http://localhost:{DEMO_PORT}';

  // If this page is served from the same origin as the demo, use relative URLs so
  // the browser is not asked to reach a different port.
  if (location.port === '{DEMO_PORT}' || location.protocol === 'file:') {{
    // keep absolute default for file:// (no server to be relative to)
    if (location.port === '{DEMO_PORT}') DEMO = location.origin;
  }}
  if (location.protocol === 'https:' && DEMO.indexOf('http://localhost') === 0) {{
    // Mixed content: fall back to the preview origin the page itself was loaded from.
    DEMO = location.origin;
  }}
  var openDemo = document.getElementById('openDemo');
  if (!/^http:\\/\\/localhost/.test(DEMO)) {{
    openDemo.href = DEMO + '/console';
    openDemo.textContent = 'Open full console ↗';
    var routes = document.querySelector('.demo__foot a[href*="/routes"]');
    var show = document.querySelector('.demo__foot a[href*="/showcase"]');
    var raw = document.querySelector('.demo__foot a[href$=":0/"], .demo__foot a[href$="/"]');
    if (routes) routes.href = DEMO + '/routes';
    if (show) show.href = DEMO + '/showcase';
    if (raw) raw.href = DEMO + '/';
  }}

  var esc = function (s) {{
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }};
  function slotFor(key) {{
    if (key === 'GET /') return document.querySelector('[data-slot="home"]');
    if (key.indexOf('/snippet/view') > -1) return document.querySelector('[data-slot="view"]');
    return document.querySelector('[data-slot="create"]');
  }}
  function statusClass(s) {{ return s < 300 ? 'ok' : s < 400 ? 'warn' : 'bad'; }}

  function run(spec, btn) {{
    var parts = spec.split(' ');
    var method = parts[0], path = parts[1];
    var slot = slotFor(spec);
    btn.disabled = true;
    slot.hidden = false;
    slot.innerHTML = '<div class="resp__bar"><span class="status">…</span><span style="color:#6d7c84">sending request</span></div>';
    fetch(DEMO + path, {{ method: method, cache: 'no-store' }})
      .then(function (res) {{
        return res.text().then(function (body) {{
          var head = [];
          ['content-type', 'content-length', 'allow', 'x-content-type-options']
            .forEach(function (h) {{ var v = res.headers.get(h); if (v) head.push(h + ': ' + v); }});
          var allowNote = res.headers.get('allow')
            ? '<div class="meta">Note the Allow header — the book adds it explicitly in chapter 2.4.</div>' : '';
          slot.innerHTML =
            '<div class="resp__bar"><span class="status ' + statusClass(res.status) + '">' +
              res.status + ' ' + esc(res.statusText) + '</span>' +
              '<span style="margin-left:auto;color:#6d7c84">' + esc(method + ' ' + path) + '</span></div>' +
            '<pre>' + esc(body) + '</pre>' +
            '<div class="meta">' + head.map(esc).join('\\n') + '</div>' + allowNote +
            '<div class="meta">$ curl -i -X ' + esc(method) + ' ' + esc(DEMO + path) + '</div>';
        }});
      }})
      .catch(function (err) {{
        slot.innerHTML = '<div class="resp__bar"><span class="status bad">demo server unreachable</span></div>' +
          '<pre>Start it with:  node web/server.js\\n\\n' + esc(err.message) + '</pre>' +
          '<div class="meta">The summary, figure and code samples still work without the server.</div>';
      }})
      .then(function () {{ btn.disabled = false; }});
  }}

  Array.prototype.forEach.call(document.querySelectorAll('[data-run]'), function (btn) {{
    btn.addEventListener('click', function () {{ run(btn.getAttribute('data-run'), btn); }});
  }});

  // Live status badge.
  function ping() {{
    var el = document.getElementById('demoState');
    fetch(DEMO + '/healthz', {{ cache: 'no-store' }})
      .then(function (r) {{ el.textContent = r.ok ? 'demo running' : 'demo error'; }})
      .catch(function () {{ el.textContent = 'demo offline'; }});
  }}
  try {{ ping(); setInterval(ping, 10000); }} catch (e) {{ document.getElementById('demoState').textContent = 'demo offline'; }}

  // The replica form.
  var pub = document.getElementById('publishBtn');
  var toast = document.getElementById('toast');
  pub.addEventListener('click', function () {{
    var title = document.getElementById('dTitle').value.trim();
    pub.textContent = title ? 'Publishing “' + title.slice(0, 22) + '”…' : 'Publishing…';
    setTimeout(function () {{
      pub.textContent = 'Publish snippet';
      toast.textContent = 'This replica form does not store anything — snippets arrive in chapter 8.';
      toast.classList.add('on');
      setTimeout(function () {{ toast.classList.remove('on'); }}, 2600);
    }}, 700);
  }});

  // Go syntax highlighting for the static samples.
  var KW = /\\b(package|import|func|return|if|else|for|range|var|const|type|struct|interface|map|string|int|bool|nil|true|false|go|defer|switch|case|break|continue|make|new|byte)\\b/g;
  Array.prototype.forEach.call(document.querySelectorAll('pre.code'), function (pre) {{
    if (pre.classList.contains('is-highlighted')) return;
    pre.classList.add('is-highlighted');
    var h = esc(pre.textContent);
    h = h.replace(/(\\/\\/[^\\n]*)/g, '<span class="com">$1</span>');
    h = h.replace(/("(?:[^"\\\\\\n]|\\\\.)*")/g, '<span class="str">$1</span>');
    h = h.replace(KW, '<span class="kw">$1</span>');
    pre.innerHTML = h;
  }});
}})();
</script>
</body>
</html>
"""


def main() -> None:
    verify_pages()
    out = ROOT / "chapter-one.html"
    out.write_text(HTML, encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
