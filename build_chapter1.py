#!/usr/bin/env python3
"""
Build chapter-one.html — a single self-contained page covering
chapters 1-8 of "Let's Go" by Alex Edwards (2nd ed., v2.20.0).

Sources (all extracted from Let's Go [Alex Edwards].pdf in this directory)

  chapter 1   pp.  6-10   Introduction, Conventions, Prerequisites
  chapter 2   pp. 11-61   Foundations, sections 2.1 - 2.9
  chapter 3   pp.  62-85  Configuration and error handling, sections 3.1 - 3.5
                          (no figures in this chapter)
  chapter 4   pp.  86-126 Database-driven responses, sections 4.1 - 4.9
                          (5 figures: go.sum, models dir, %+v dumps, 404)
  chapter 5   pp. 127-161 Dynamic HTML templates, sections 5.1 - 5.6
                          (9 figures: wireframes, rendered pages, humanDate)
  chapter 6   pp. 162-179 Middleware, sections 6.1 - 6.5
                          (1 figure: the Firefox CSP console)
  chapter 7   pp. 180-192 Advanced routing, sections 7.1 - 7.2
                          (1 figure: the snippet page at a clean URL)
  main.go     p.  14      used by the live demo

Figures
  chapter 1   page  6  the finished "Create a new snippet" screen  (only figure)
  chapter 2   pages 13-56   14 screenshots (assets/ch2/*.jpg)

Content lives in content/chapter1.html and content/chapter2.html as HTML
fragments; images are referenced as {{IMG:name}} and inlined as base64 here,
so the output page has no external dependencies.
"""

import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
PDF = ROOT / "Let's Go [Alex Edwards].pdf"
DEMO_PORT = 3000

# name -> (path, max width hint for the caption/alt handling)
IMAGES = {
    "book-cover": ROOT / "assets" / "book-cover.png",
    "snippetbox-app": ROOT / "assets" / "snippetbox-app.png",
    "ch2-01": ROOT / "assets" / "ch2" / "01-project-directory.jpg",
    "ch2-02": ROOT / "assets" / "ch2" / "02-hello-from-snippetbox.jpg",
    "ch2-03": ROOT / "assets" / "ch2" / "03-snippet-view-route.jpg",
    "ch2-04": ROOT / "assets" / "ch2" / "04-snippet-create-route.jpg",
    "ch2-05": ROOT / "assets" / "ch2" / "05-not-found-404.jpg",
    "ch2-06": ROOT / "assets" / "ch2" / "06-view-id-query.jpg",
    "ch2-07": ROOT / "assets" / "ch2" / "07-project-structure.jpg",
    "ch2-08": ROOT / "assets" / "ch2" / "08-home-page-sketch.jpg",
    "ch2-09": ROOT / "assets" / "ch2" / "09-first-template.jpg",
    "ch2-10": ROOT / "assets" / "ch2" / "10-nav-partial.jpg",
    "ch2-11": ROOT / "assets" / "ch2" / "11-static-directory.jpg",
    "ch2-12": ROOT / "assets" / "ch2" / "12-static-listing.jpg",
    "ch2-13": ROOT / "assets" / "ch2" / "13-main-css.jpg",
    "ch2-14": ROOT / "assets" / "ch2" / "14-styled-home-page.jpg",
    "ch4-01": ROOT / "assets" / "ch4" / "01-gosum.jpg",
    "ch4-02": ROOT / "assets" / "ch4" / "02-models-package.jpg",
    "ch4-03": ROOT / "assets" / "ch4" / "03-snippet-view.jpg",
    "ch4-04": ROOT / "assets" / "ch4" / "04-expired-snippet-404.jpg",
    "ch4-05": ROOT / "assets" / "ch4" / "05-latest-snippets.jpg",
    "ch5-01": ROOT / "assets" / "ch5" / "01-view-wireframe.jpg",
    "ch5-02": ROOT / "assets" / "ch5" / "02-view-page.jpg",
    "ch5-03": ROOT / "assets" / "ch5" / "03-home-wireframe.jpg",
    "ch5-04": ROOT / "assets" / "ch5" / "04-home-page.jpg",
    "ch5-05": ROOT / "assets" / "ch5" / "05-view-after-cache.jpg",
    "ch5-06": ROOT / "assets" / "ch5" / "06-home-after-cache.jpg",
    "ch5-07": ROOT / "assets" / "ch5" / "07-home-current-year.jpg",
    "ch5-08": ROOT / "assets" / "ch5" / "08-home-humandate.jpg",
    "ch5-09": ROOT / "assets" / "ch5" / "09-view-humandate.jpg",
    "ch6-01": ROOT / "assets" / "ch6" / "01-csp-console.jpg",
    "ch7-01": ROOT / "assets" / "ch7" / "01-snippet-view-clean-url.jpg",
    "ch8-01": ROOT / "assets" / "ch8" / "01-form-wireframe.jpg",
    "ch8-02": ROOT / "assets" / "ch8" / "02-blank-form.jpg",
    "ch8-03": ROOT / "assets" / "ch8" / "03-form-filled.jpg",
    "ch8-04": ROOT / "assets" / "ch8" / "04-created-snippet.jpg",
    "ch8-05": ROOT / "assets" / "ch8" / "05-too-long-title.jpg",
    "ch8-06": ROOT / "assets" / "ch8" / "06-errors-dump.jpg",
    "ch8-07": ROOT / "assets" / "ch8" / "07-blank-title.jpg",
    "ch8-08": ROOT / "assets" / "ch8" / "08-validation-error.jpg",
}

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def data_uri(path: pathlib.Path) -> str:
    mime = MIME.get(path.suffix.lower(), "application/octet-stream")
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def verify_pages() -> None:
    """Fail loudly if the PDF no longer matches the pages we summarised."""
    try:
        import pymupdf
    except ImportError:  # pragma: no cover
        print("pymupdf not installed; skipping page verification")
        return
    doc = pymupdf.open(PDF)
    checks = {
        6: "Chapter 1.",
        9: "Chapter 1.1.",
        10: "A web browser with good developer tools",
        11: "Foundations",
        12: "go mod init",
        18: "Routing requests",
        25: "Customizing HTTP headers",
        32: "URL query strings",
        36: "Project structure and organization",
        41: "HTML templating and inheritance",
        51: "Serving static files",
        59: "http.Handler interface",
        62: "Configuration and error handling",
        63: "Managing configuration settings",
        68: "Leveled logging",
        73: "Dependency injection",
        79: "Centralized error handling",
        84: "Isolating the application routes",
        86: "Database-driven responses",
        87: "Setting up MySQL",
        90: "Installing a database driver",
        95: "Creating a database connection pool",
        99: "Designing a database model",
        104: "Executing SQL statements",
        109: "Single-record SQL queries",
        116: "Multiple-record SQL queries",
        121: "Transactions and other details",
        127: "Dynamic HTML templates",
        128: "Displaying dynamic data",
        136: "Template actions and functions",
        142: "Caching templates",
        149: "Catching runtime errors",
        153: "Common dynamic data",
        157: "Custom template functions",
        162: "Middleware",
        163: "How middleware works",
        166: "Setting security headers",
        171: "Request logging",
        173: "Panic recovery",
        178: "Composable middleware chains",
        180: "Advanced routing",
        182: "Choosing a router",
        184: "Clean URLs and method-based routing",
        193: "Processing forms",
        195: "Setting up a HTML form",
        198: "Parsing form data",
        204: "Validating form data",
        208: "Displaying errors and repopulating",
        214: "Creating validation helpers",
        219: "Automatic form parsing",
        224: "app.decodePostForm(r, &form)",
    }
    for pno, needle in checks.items():
        text = doc[pno - 1].get_text()
        assert needle in text, f"page {pno} no longer contains {needle!r}"
    print(f"verified {len(checks)} source pages")


def crop_script() -> str:
    """The chapter-2 figures are cropped from the PDF by assets/extract_chapter2.py."""
    return ""


CSS = """
:root{
  --ink:#283c46; --soft:#54636c; --faint:#7b8b93; --paper:#fff; --page:#f1f3f6;
  --green:#64c52f; --green-dark:#4ea61f;
  --code-bg:#f9f9f9; --term:#283c46; --term-fg:#e8edf0;
  --kw:#a82255; --str:#008075; --lit:#5642a6; --com:#818181;
  --mono:"Ubuntu Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  --sans:"Source Sans Pro","Source Sans 3",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --maxw:820px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--page);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:#0f7ea3;text-decoration:none;border-bottom:1px solid rgba(15,126,163,.28)}
a:hover{border-bottom-color:#0f7ea3}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 22px}
.hero{background:var(--page);padding:54px 0 34px}
.hero .kicker{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:0 0 10px}
.hero h1{font-size:46px;line-height:1.1;letter-spacing:-1px;margin:0 0 16px}
.hero h1 span{color:var(--green)}
.hero p{font-size:18px;color:var(--soft);margin:0 0 24px;max-width:660px}
.meta{display:flex;flex-wrap:wrap;gap:10px;font-size:13px;color:var(--faint)}
.meta span{background:#fff;border:1px solid #e4e9ed;border-radius:999px;padding:4px 12px}
.layout{display:grid;grid-template-columns:1fr;gap:28px;align-items:start;padding-bottom:80px}
@media (min-width:1080px){
  .layout{grid-template-columns:250px minmax(0,1fr);max-width:1150px;margin:0 auto;padding:0 22px 90px}
  .toc{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow:auto}
}
.toc{background:#fff;border:1px solid #e4e9ed;border-radius:10px;padding:18px 20px;font-size:13.5px}
.toc h2{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);margin:0 0 10px;font-weight:600}
.toc ol{margin:0;padding-left:16px;color:var(--soft)}
.toc li{margin:4px 0}
.toc a{border:0;color:var(--soft)}
.toc a:hover{color:var(--green-dark)}
.toc .part{margin-top:14px;font-weight:700;color:var(--ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.06em}
article{min-width:0}
h2.sec{font-size:14px;letter-spacing:.13em;text-transform:uppercase;color:var(--green-dark);margin:52px 0 6px;font-weight:700}
h2.sec:first-child{margin-top:0}
h3{font-size:27px;line-height:1.25;letter-spacing:-.4px;margin:0 0 14px}
p{margin:0 0 16px}
.lead{font-size:19px;color:var(--soft)}
hr.rule{border:0;border-top:1px solid #e0e6ea;margin:40px 0}
.note{border-left:3px solid var(--green);background:#f4faf0;border-radius:0 6px 6px 0;padding:14px 18px;margin:22px 0;font-size:16px}
.note b{color:#40761c}
kbd{font-family:var(--mono);font-size:.9em;background:#eef2f4;border:1px solid #dde4e8;border-bottom-width:2px;border-radius:4px;padding:0 5px}
figure{margin:26px 0 30px}
figure.shot{background:#fff;border:1px solid #e0e6ea;border-radius:10px;padding:10px}
figure.shot img{display:block;width:100%;height:auto;border-radius:5px}
figcaption{font-size:13.5px;color:var(--faint);padding:10px 4px 2px;line-height:1.5}
figcaption b{color:var(--soft);font-weight:600}
.figrow{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:720px){.figrow{grid-template-columns:1fr 1fr}}
.cover{display:flex;gap:22px;align-items:flex-start;background:#fff;border:1px solid #e4e9ed;border-radius:10px;padding:18px;margin:0 0 30px;flex-wrap:wrap}
.cover img{width:150px;border-radius:5px;display:block;box-shadow:0 8px 20px rgba(40,60,70,.18)}
.cover div{flex:1;min-width:240px;font-size:15px;color:var(--soft)}
.cover strong{display:block;color:var(--ink);font-size:17px;margin-bottom:2px}
.codeblock{margin:22px 0 26px;border:1px solid #e6ebee;border-radius:8px;overflow:hidden;background:#fff}
.codeblock .titlebar{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#f7f9fa;border-bottom:1px solid #e9eef1;font-family:var(--mono);font-size:12.5px;color:var(--faint)}
.codeblock .dots{display:flex;gap:5px}
.codeblock .dots i{width:9px;height:9px;border-radius:50%;background:#dfe6ea;display:block}
.codeblock .lang{margin-left:auto;text-transform:uppercase;letter-spacing:.08em;font-size:10.5px}
pre{margin:0;font-family:var(--mono);font-size:13.5px;line-height:1.6;overflow:auto;padding:15px 17px}
pre.code{background:var(--code-bg);color:var(--ink)}
pre.term{background:var(--term);color:var(--term-fg)}
pre.term .prompt{color:#fff}
pre.term .out{color:#c0c0c0}
.kw{color:var(--kw)} .str{color:var(--str)} .lit{color:var(--lit)} .com{color:var(--com)}
.demo{background:#fff;border:1px solid #e0e6ea;border-radius:12px;overflow:hidden;margin:26px 0 10px;box-shadow:0 10px 30px rgba(40,60,70,.07)}
.demo__head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e9eef1;background:#f7f9fa;flex-wrap:wrap}
.demo__head h3{margin:0;font-size:17px;letter-spacing:0}
.live{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:#2f8f4e;font-weight:700}
.live i{width:8px;height:8px;border-radius:50%;background:#37c26b;box-shadow:0 0 0 0 rgba(55,194,107,.6);animation:pulse 1.8s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 8px rgba(55,194,107,0)}100%{box-shadow:0 0 0 0 rgba(55,194,107,0)}}
.demo__body{padding:18px}
.row{display:flex;gap:10px;flex-wrap:wrap}
button.btn,.btn{display:inline-flex;align-items:center;gap:8px;border:1px solid #dfe6ea;background:#fff;color:var(--ink);font:inherit;font-size:14px;padding:9px 14px;border-radius:5px;cursor:pointer;transition:.12s;border-bottom:1px solid #dfe6ea}
button.btn:hover,.btn:hover{border-color:#c9d4da;transform:translateY(-1px)}
button.btn:disabled{opacity:.55;cursor:progress;transform:none}
.btn--green{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}
.btn--green:hover{background:var(--green-dark);border-color:var(--green-dark)}
.btn--red{background:#b3382c;border-color:#b3382c;color:#fff;font-weight:600}
.btn--red:hover{background:#982e24;border-color:#982e24}
.method{display:inline-block;font-family:var(--mono);font-size:11.5px;padding:2px 7px;border-radius:3px;border:1px solid;margin-right:8px;vertical-align:2px}
.method.get{color:#2b7a90;border-color:#bfdbe3;background:#f1f9fb}
.method.post{color:#7d5a00;border-color:#e8d9a8;background:#fdf8e6}
code.path{font-family:var(--mono);font-size:14px;background:#f2f5f7;padding:2px 6px;border-radius:3px}
.resp{margin-top:14px;border:1px solid #e7ecf0;border-radius:6px;overflow:hidden;background:#fff}
.resp__bar{display:flex;gap:10px;align-items:center;padding:8px 12px;background:#f7f9fa;border-bottom:1px solid #edf1f3;font-family:var(--mono);font-size:12px}
.status{font-weight:700}
.status.ok{color:#2f8f4e} .status.warn{color:#b37500} .status.bad{color:#b3382c}
.resp pre{background:var(--term);color:var(--term-fg);max-height:210px;font-size:12.5px}
.resp .meta{padding:9px 12px;font-family:var(--mono);font-size:11.5px;color:#6d7c84;border-top:1px dashed #e7ecf0;white-space:pre-wrap;background:#fcfdfd}
.field{margin:14px 0}
.field label{display:block;font-size:14px;margin-bottom:6px;color:var(--soft)}
.field input[type=text],.field textarea{width:100%;border:1px solid #dfe6ea;border-radius:4px;padding:10px 12px;font:inherit;font-size:14px;background:#fbfcfd}
.field textarea{min-height:110px;resize:vertical}
.radios{display:flex;gap:20px;flex-wrap:wrap;font-size:14px;margin:14px 0 18px;color:var(--soft)}
.radios label{display:flex;gap:7px;align-items:center}
.demo__foot{padding:12px 18px;border-top:1px solid #e9eef1;background:#fbfcfd;font-size:13px;color:var(--faint);display:flex;gap:14px;flex-wrap:wrap}
.demo__foot a{border:0;color:var(--faint);text-decoration:underline}
table{width:100%;border-collapse:collapse;font-size:15px;margin:18px 0 6px;background:#fff;border:1px solid #e4e9ed;border-radius:8px;overflow:hidden}
th,td{text-align:left;padding:10px 13px;border-bottom:1px solid #eef2f4;vertical-align:top}
th{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);background:#f9fbfc;font-weight:600}
tr:last-child td{border-bottom:0}
td code{font-family:var(--mono);font-size:13.5px}
ol.steps{padding-left:20px}
ol.steps li{margin:0 0 12px}
ol.steps code,p code,li code,td code.k{font-family:var(--mono);font-size:.92em;background:#eef2f4;padding:1.5px 5px;border-radius:3px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 6px;padding:0;list-style:none}
.chips li{background:#fff;border:1px solid #e4e9ed;border-radius:999px;padding:5px 12px;font-size:13.5px;color:var(--soft)}
footer{border-top:1px solid #e0e6ea;padding:26px 0 60px;font-size:13px;color:var(--faint);line-height:1.7}
footer a{border:0;text-decoration:underline}
.toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);background:var(--ink);color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;opacity:0;pointer-events:none;transition:.25s;z-index:9}
.toast.on{opacity:1;transform:translate(-50%,0)}
@media (max-width:640px){.hero h1{font-size:34px}body{font-size:16px}h3{font-size:23px}}
"""

HERO = f"""
<div class="hero">
  <div class="wrap">
    <p class="kicker">Let’s Go · Alex Edwards · 2nd edition, v2.20.0</p>
    <h1>Chapters 1–8 — <span>Introduction</span><br>&amp; Foundations to Forms</h1>
    <p>Build Snippetbox: a web app for pasting and sharing snippets of text. Chapter one sets the destination and
       the toolchain; chapter two builds the whole foundations of the app — modules, routing, headers, query
       strings, project structure, templates and static files. Chapter three adds nothing visible and makes
       everything maintainable: flags, leveled logs, injected dependencies and centralised errors. Chapter four
       gives it a memory — a MySQL connection pool, a models package, and every shape of SQL call — and chapter
       five gives it a face — templates, actions, a cache, and a render that fails safely — and chapter six wraps
       the whole thing in middleware: security headers, request logging and panic recovery. Chapter seven swaps the
       router out for method-based routing and clean URLs, and chapter eight finally lets a user type something: an
       HTML form, parsed and validated and re-displayed when it is wrong, then a redirect so a refresh cannot submit
       it twice.</p>
    <div class="meta">
      <span>219 pages of source (pp. 6–224)</span>
      <span>all 40 images embedded</span>
      <span>Live demo on port {DEMO_PORT}</span>
      <span>Reading time ≈ 100 min</span>
    </div>
  </div>
</div>
"""

TOC = """
  <nav class="toc">
    <h2>On this page</h2>
    <p class="part">Chapter 1 · Introduction</p>
    <ol>
      <li><a href="#intro">Introduction</a></li>
      <li><a href="#figure">The screenshot</a></li>
      <li><a href="#path">What the app teaches</a></li>
      <li><a href="#demo">Live demo</a></li>
      <li><a href="#learned">Background knowledge</a></li>
      <li><a href="#go120">Go 1.20</a></li>
      <li><a href="#software">Other software</a></li>
      <li><a href="#conventions">Conventions &amp; hints</a></li>
    </ol>
    <p class="part">Chapter 2 · Foundations</p>
    <ol>
      <li><a href="#s21">2.1 Project setup</a></li>
      <li><a href="#s22">2.2 Web app basics</a></li>
      <li><a href="#s23">2.3 Routing requests</a></li>
      <li><a href="#s24">2.4 HTTP headers</a></li>
      <li><a href="#s25">2.5 URL query strings</a></li>
      <li><a href="#s26">2.6 Project structure</a></li>
      <li><a href="#s27">2.7 HTML templating</a></li>
      <li><a href="#s28">2.8 Static files</a></li>
      <li><a href="#s29">2.9 http.Handler</a></li>
      <li><a href="#ch2-demo">Chapter 2 live</a></li>
      <li><a href="#ch2-takeaways">Takeaways</a></li>
    </ol>
    <p class="part">Chapter 3 · Configuration</p>
    <ol>
      <li><a href="#s31">3.1 Configuration</a></li>
      <li><a href="#s32">3.2 Leveled logging</a></li>
      <li><a href="#s33">3.3 Dependency injection</a></li>
      <li><a href="#s34">3.4 Centralised errors</a></li>
      <li><a href="#s35">3.5 Routes</a></li>
      <li><a href="#ch3-demo">Chapter 3 live</a></li>
      <li><a href="#ch3-takeaways">Takeaways</a></li>
    </ol>
    <p class="part">Chapter 4 · Database</p>
    <ol>
      <li><a href="#s41">4.1 MySQL setup</a></li>
      <li><a href="#s42">4.2 Driver</a></li>
      <li><a href="#s43">4.3 go.mod / go.sum</a></li>
      <li><a href="#s44">4.4 Connection pool</a></li>
      <li><a href="#s45">4.5 The models package</a></li>
      <li><a href="#s46">4.6 Exec()</a></li>
      <li><a href="#s47">4.7 QueryRow()</a></li>
      <li><a href="#s48">4.8 Query()</a></li>
      <li><a href="#s49">4.9 Transactions</a></li>
      <li><a href="#ch4-demo">Chapter 4 live</a></li>
      <li><a href="#ch4-takeaways">Takeaways</a></li>
    </ol>
    <p class="part">Chapter 5 · Templates</p>
    <ol>
      <li><a href="#s51">5.1 Dynamic data</a></li>
      <li><a href="#s52">5.2 Actions &amp; functions</a></li>
      <li><a href="#s53">5.3 Caching templates</a></li>
      <li><a href="#s54">5.4 Runtime errors</a></li>
      <li><a href="#s55">5.5 Common data</a></li>
      <li><a href="#s56">5.6 Custom functions</a></li>
      <li><a href="#ch5-demo">Chapter 5 live</a></li>
      <li><a href="#ch5-takeaways">Takeaways</a></li>
    </ol>
    <p class="part">Chapter 6 · Middleware</p>
    <ol>
      <li><a href="#s61">6.1 How it works</a></li>
      <li><a href="#s62">6.2 Security headers</a></li>
      <li><a href="#s63">6.3 Request logging</a></li>
      <li><a href="#s64">6.4 Panic recovery</a></li>
      <li><a href="#s65">6.5 Composable chains</a></li>
      <li><a href="#ch6-demo">Chapter 6 live</a></li>
      <li><a href="#ch6-takeaways">Takeaways</a></li>
    </ol>
    <p class="part">Chapter 7 · Routing</p>
    <ol>
      <li><a href="#s71">7.1 Choosing a router</a></li>
      <li><a href="#s72">7.2 Clean URLs</a></li>
      <li><a href="#ch7-demo">Chapter 7 live</a></li>
      <li><a href="#ch7-takeaways">Takeaways</a></li>
    </ol>
    <p class="part">Chapter 8 · Forms</p>
    <ol>
      <li><a href="#s81">8.1 The HTML form</a></li>
      <li><a href="#s82">8.2 Parsing form data</a></li>
      <li><a href="#s83">8.3 Validation</a></li>
      <li><a href="#s84">8.4 Errors &amp; repopulation</a></li>
      <li><a href="#s85">8.5 Validator package</a></li>
      <li><a href="#s86">8.6 Automatic decoding</a></li>
      <li><a href="#ch8-demo">Chapter 8 live</a></li>
      <li><a href="#ch8-takeaways">Takeaways</a></li>
    </ol>
  </nav>
"""

SCRIPT = (ROOT / "content" / "page.js").read_text(encoding="utf-8").replace("__PORT__", str(DEMO_PORT))


def build() -> str:
    verify_pages()

    ch1 = (ROOT / "content" / "chapter1.html").read_text(encoding="utf-8")
    ch2 = (ROOT / "content" / "chapter2.html").read_text(encoding="utf-8")
    ch3 = (ROOT / "content" / "chapter3.html").read_text(encoding="utf-8")
    ch4 = (ROOT / "content" / "chapter4.html").read_text(encoding="utf-8")
    ch5 = (ROOT / "content" / "chapter5.html").read_text(encoding="utf-8")
    ch6 = (ROOT / "content" / "chapter6.html").read_text(encoding="utf-8")
    ch7 = (ROOT / "content" / "chapter7.html").read_text(encoding="utf-8")
    ch8 = (ROOT / "content" / "chapter8.html").read_text(encoding="utf-8")

    # chapter 1's hero/toc listed a "Where it goes next" section; keep its content
    # but retitle it so it reads as a bridge into chapter 2.
    ch1 = ch1.replace(
        '<h2 class="sec" id="next">Where it goes next</h2>',
        '<h2 class="sec" id="next">Where chapter 2 begins</h2>',
    )
    ch1 = ch1.replace(
        '<pre class="term" style="border-radius:8px"><span class="prompt">Chapter 2.1</span>',
        '<pre class="term" style="border-radius:8px;margin-bottom:8px"><span class="prompt">Chapter 2.1</span>',
    )

    body = (
        '<div class="layout">'
        + TOC
        + "<article>"
        + ch1.strip()
        + '\n<hr class="rule" id="chapter2">\n'
        + ch2.strip()
        + '\n<hr class="rule" id="chapter3">\n'
        + ch3.strip()
        + '\n<hr class="rule" id="chapter4">\n'
        + ch4.strip()
        + '\n<hr class="rule" id="chapter5">\n'
        + ch5.strip()
        + '\n<hr class="rule" id="chapter6">\n'
        + ch6.strip()
        + '\n<hr class="rule" id="chapter7">\n'
        + ch7.strip()
        + '\n<hr class="rule" id="chapter8">\n'
        + ch8.strip()
        + "\n</article></div>"
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Let&#39;s Go — chapters 1–8 summary</title>
<style>{CSS}</style>
</head>
<body>
{HERO}
{body}
<footer>
  <div class="wrap">
    Summary of chapters 1–8 of <em>Let’s Go: Learn to build professional web applications with Go</em> by
    Alex Edwards (2nd edition, v2.20.0), generated from <code>Let’s Go [Alex Edwards].pdf</code> in this repository:
    pages 6–10 for chapter 1, 11–61 for chapter 2, 62–85 for chapter 3, 86–126 for chapter 4, 127–161 for
    chapter 5, 162–179 for chapter 6, 180–192 for chapter 7 and 193–224 for chapter 8. All 40 images — the book cover,
    the app mock-up, and 38 figures (chapter 3 has none) — were extracted with PyMuPDF and inlined as base64, so this file needs no network access.<br>
    Live demo: <code>web/snippetbox/</code> — the book’s own templates, static directory, flags and loggers, served by
    <code>web/server.js</code> on port {DEMO_PORT}. Rebuild this page with
    <code>python3 build_chapter1.py</code>.
  </div>
</footer>
<div class="toast" id="toast"></div>
<script>
{SCRIPT}
</script>
</body>
</html>
"""

    # inline every {{IMG:name}} placeholder
    used = set()

    def repl(match):
        name = match.group(1)
        if name not in IMAGES:
            raise KeyError(f"unknown image placeholder {name!r}")
        used.add(name)
        return data_uri(IMAGES[name])

    html = re.sub(r"\{\{IMG:([a-z0-9-]+)\}\}", repl, html)
    missing = set(IMAGES) - used
    assert not missing, f"unused images: {sorted(missing)}"
    assert "{{IMG:" not in html, "unresolved image placeholder"
    return html


def main() -> None:
    out = ROOT / "chapter-one.html"
    html = build()
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB, {len(IMAGES)} images embedded)")


if __name__ == "__main__":
    main()
