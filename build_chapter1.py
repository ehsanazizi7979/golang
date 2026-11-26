#!/usr/bin/env python3
"""
Build chapter-one.html — a single self-contained page covering
chapter 1 and chapter 2 of "Let's Go" by Alex Edwards (2nd ed., v2.20.0).

Sources (all extracted from Let's Go [Alex Edwards].pdf in this directory)

  chapter 1   pp.  6-10   Introduction, Conventions, Prerequisites
  chapter 2   pp. 11-61   Foundations, sections 2.1 - 2.9
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
    <h1>Chapters 1 &amp; 2 — <span>Introduction</span><br>&amp; Foundations</h1>
    <p>Build Snippetbox: a web app for pasting and sharing snippets of text. Chapter one sets the destination and
       the toolchain; chapter two builds the whole foundations of the app — modules, routing, headers, query
       strings, project structure, templates and static files.</p>
    <div class="meta">
      <span>56 pages of source (pp. 6–61)</span>
      <span>15 figures, all embedded</span>
      <span>Live demo on port {DEMO_PORT}</span>
      <span>Reading time ≈ 25 min</span>
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
  </nav>
"""

SCRIPT = """
<script>
(function () {
  var DEMO = 'http://localhost:__PORT__';
  if (location.port === '__PORT__') DEMO = location.origin;
  if (location.protocol === 'https:' && DEMO.indexOf('http://localhost') === 0) DEMO = location.origin;

  // Point every absolute demo link at the right origin.
  document.querySelectorAll('a[href^="http://localhost:__PORT__"]').forEach(function (a) {
    a.href = DEMO + a.getAttribute('href').replace('http://localhost:__PORT__', '');
  });

  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  function statusClass(s) { return s < 300 ? 'ok' : s < 400 ? 'warn' : 'bad'; }

  function request(spec) {
    return fetch(DEMO + spec.path, { method: spec.method || 'GET', headers: spec.headers || {}, cache: 'no-store' })
      .then(function (res) {
        return res.text().then(function (body) {
          var head = [];
          ['content-type', 'content-length', 'allow', 'last-modified', 'content-range', 'accept-ranges', 'location', 'date']
            .forEach(function (h) { var v = res.headers.get(h); if (v) head.push(h + ': ' + v); });
          return { status: res.status, text: res.statusText, body: body, head: head, spec: spec };
        });
      });
  }

  function paint(slot, r, method, path) {
    var shown = r.body;
    if (shown.length > 1400) shown = shown.slice(0, 1400) + '\\n\\n… (' + r.body.length + ' bytes total)';
    slot.hidden = false;
    slot.innerHTML =
      '<div class="resp__bar"><span class="status ' + statusClass(r.status) + '">' + r.status + ' ' + esc(r.text) + '</span>' +
        '<span style="margin-left:auto;color:#6d7c84">' + esc(method + ' ' + path) + '</span></div>' +
      '<pre>' + (esc(shown) || '(empty body)') + '</pre>' +
      '<div class="meta">' + r.head.map(esc).join('\\n') + '</div>' +
      '<div class="meta">$ curl -i ' + (method !== 'GET' ? '-X ' + esc(method) + ' ' : '') + esc(DEMO + path) + '</div>';
  }

  // ---- chapter 2 buttons -------------------------------------------------
  var CH2 = {
    home:       { path: '/home', method: 'GET' },
    'static':   { path: '/static/', method: 'GET' },
    css:        { path: '/static/css/main.css', method: 'GET' },
    '304':      { path: '/static/css/main.css', method: 'GET', conditional: true },
    range:      { path: '/static/img/logo.svg', method: 'GET', range: 'bytes=0-49' },
    traversal:  { path: '/static/../server.js', method: 'GET' }
  };

  document.querySelectorAll('[data-ch2]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ch2');
      var spec = Object.assign({}, CH2[key]);
      var slot = document.querySelector(key === 'home' ? '[data-ch2-slot="home"]' : '[data-ch2-slot="static"]');
      btn.disabled = true;
      slot.hidden = false;
      slot.innerHTML = '<div class="resp__bar"><span class="status">…</span><span style="color:#6d7c84">sending request</span></div>';

      var go = function (headers) {
        spec.headers = headers || {};
        request(spec).then(function (r) {
          paint(slot, r, spec.method, spec.path);
          if (key === '304') {
            slot.querySelector('.meta').insertAdjacentHTML('afterend',
              '<div class="meta">Conditional request: the demo fetched Last-Modified first, then asked again with If-Modified-Since. Go\\'s http.FileServer answers 304 Not Modified.</div>');
          }
        }).catch(function (err) {
          slot.innerHTML = '<div class="resp__bar"><span class="status bad">demo server unreachable</span></div>' +
            '<pre>Start it with:  node web/server.js\\n\\n' + esc(err.message) + '</pre>';
        }).then(function () { btn.disabled = false; });
      };

      if (spec.conditional) {
        fetch(DEMO + spec.path, { cache: 'no-store' }).then(function (res) {
          go({ 'If-Modified-Since': res.headers.get('last-modified') || new Date().toUTCString() });
        }).catch(function () { go({}); });
      } else if (spec.range) {
        go({ Range: spec.range });
      } else {
        go({});
      }
    });
  });

  // ---- chapter 1 buttons -------------------------------------------------
  function slotFor(key) {
    if (key === 'GET /') return document.querySelector('[data-slot="home"]');
    if (key.indexOf('/snippet/view') > -1) return document.querySelector('[data-slot="view"]');
    return document.querySelector('[data-slot="create"]');
  }

  function run(spec, btn) {
    var parts = spec.split(' ');
    var method = parts[0], path = parts[1];
    var slot = slotFor(spec);
    btn.disabled = true;
    slot.hidden = false;
    slot.innerHTML = '<div class="resp__bar"><span class="status">…</span><span style="color:#6d7c84">sending request</span></div>';
    request({ path: path, method: method }).then(function (r) {
      paint(slot, r, method, path);
      if (r.status === 405) {
        slot.querySelector('.meta').insertAdjacentHTML('afterend',
          '<div class="meta">Note the Allow header — the book adds it explicitly in chapter 2.4.</div>');
      }
    }).catch(function (err) {
      slot.innerHTML = '<div class="resp__bar"><span class="status bad">demo server unreachable</span></div>' +
        '<pre>Start it with:  node web/server.js\\n\\n' + esc(err.message) + '</pre>' +
        '<div class="meta">The summary, figures and code samples still work without the server.</div>';
    }).then(function () { btn.disabled = false; });
  }

  document.querySelectorAll('[data-run]').forEach(function (btn) {
    btn.addEventListener('click', function () { run(btn.getAttribute('data-run'), btn); });
  });

  // ---- live badges -------------------------------------------------------
  function badge(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var ping = function () {
      fetch(DEMO + '/healthz', { cache: 'no-store' })
        .then(function (r) { el.textContent = r.ok ? 'demo running' : 'demo error'; })
        .catch(function () { el.textContent = 'demo offline'; });
    };
    ping();
    setInterval(ping, 10000);
  }
  badge('demoState');
  badge('ch2State');

  // ---- the replica form --------------------------------------------------
  var pub = document.getElementById('publishBtn');
  var toast = document.getElementById('toast');
  if (pub) {
    pub.addEventListener('click', function () {
      var title = document.getElementById('dTitle').value.trim();
      pub.textContent = title ? 'Publishing “' + title.slice(0, 22) + '”…' : 'Publishing…';
      setTimeout(function () {
        pub.textContent = 'Publish snippet';
        toast.textContent = 'This replica form does not store anything — snippets arrive in chapter 8.';
        toast.classList.add('on');
        setTimeout(function () { toast.classList.remove('on'); }, 2600);
      }, 700);
    });
  }

  // ---- Go syntax highlighting for the static samples ---------------------
  var KW = /\\b(package|import|func|return|if|else|for|range|var|const|type|struct|interface|map|string|int|bool|nil|true|false|go|defer|switch|case|break|continue|make|new|byte|error|any)\\b/g;
  document.querySelectorAll('pre.code').forEach(function (pre) {
    if (pre.classList.contains('is-highlighted')) return;
    pre.classList.add('is-highlighted');
    var h = esc(pre.textContent);
    h = h.replace(/(\\/\\/[^\\n]*)/g, '<span class="com">$1</span>');
    h = h.replace(/(&#39;[^&\\n]*&#39;)/g, '<span class="str">$1</span>');
    h = h.replace(/("(?:[^"\\\\\\n]|\\\\.)*")/g, '<span class="str">$1</span>');
    h = h.replace(KW, '<span class="kw">$1</span>');
    pre.innerHTML = h;
  });
})();
</script>
"""


def build() -> str:
    verify_pages()

    ch1 = (ROOT / "content" / "chapter1.html").read_text(encoding="utf-8")
    ch2 = (ROOT / "content" / "chapter2.html").read_text(encoding="utf-8")

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
        + "\n</article></div>"
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Let&#39;s Go — chapters 1 &amp; 2 summary</title>
<style>{CSS}</style>
</head>
<body>
{HERO}
{body}
<footer>
  <div class="wrap">
    Summary of chapters 1 and 2 of <em>Let’s Go: Learn to build professional web applications with Go</em> by
    Alex Edwards (2nd edition, v2.20.0), generated from <code>Let’s Go [Alex Edwards].pdf</code> in this repository:
    pages 6–10 for chapter 1 and pages 11–61 for chapter 2. All 15 figures were extracted with PyMuPDF and inlined as
    base64, so this file needs no network access.<br>
    Chapter-2 live demo: <code>web/snippetbox/</code> — the book’s own templates and static directory, served by
    <code>web/server.js</code> on port {DEMO_PORT}. Rebuild this page with
    <code>python3 build_chapter1.py</code>.
  </div>
</footer>
<div class="toast" id="toast"></div>
{SCRIPT.replace('__PORT__', str(DEMO_PORT))}
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
