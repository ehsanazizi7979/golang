'use strict';

/*
 * Snippetbox — chapter-one live demo
 * ----------------------------------
 * A dependency-free Node re-implementation of the routes introduced in
 * "Let's Go" (Alex Edwards, 2nd ed.) chapter 2.2 / 2.3 / 2.4 / 2.5.
 *
 *   GET  /                     -> 200 "Hello from Snippetbox"
 *   GET  /snippet/view?id=7    -> 200 "Display a specific snippet with ID 7..."
 *   GET  /snippet/view         -> 404 (missing/invalid id)
 *   POST /snippet/create       -> 303 -> /snippet/view?id=N (chapter 4)
 *   *    /snippet/create        -> 405 + "Allow: POST"
 *
 * Plus three HTML pages that present it: /console, /showcase, /routes
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const chapter2 = require('./snippetbox/routes');
const { parseConfig, Application } = require('./snippetbox/app');
const chapter3 = require('./snippetbox/chapter3');
const chapter4 = require('./snippetbox/chapter4');
const models = require('./snippetbox/models');

// Chapter 3.1: configuration comes from command-line flags, parsed before
// anything else happens.
const config = parseConfig(process.argv);
const app = new Application(config);

// Chapter 4.4: the pool is created once in main(), not per request. Here it is
// an in-memory table, but the shape is the same: one long-lived object, passed
// to the handlers as a dependency.
const db = {
  dsn: 'web:pass@/snippetbox?parseTime=true',
  table: new models.Table(models.seed()),
  pool: models.pool,
  app,
  model: null,
  runSQL: (...args) => models.runSQL(db.table, ...args),
  runTransaction: () => models.runTransaction(db.table),
};
db.model = new models.SnippetModel(db.table);
db.pool.opened += 1; // db.Ping()

const PORT = config.port;
const HOST = config.host;
const STARTED = new Date();

const LOG = [];
function record(entry) {
  LOG.unshift(entry);
  if (LOG.length > 60) LOG.pop();
}

/* ---------------------------------------------------------------- helpers */

function write(w, status, body, headers) {
  const buf = Buffer.from(body, 'utf8');
  w.writeHead(status, Object.assign({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
  }, headers || {}));
  w.end(buf);
}

// Mirrors Go's http.Error(w, msg, code): plain text, nosniff, one trailing \n.
function httpError(w, status, msg, headers) {
  write(w, status, msg + '\n', headers);
}

function html(w, body) {
  const buf = Buffer.from(body, 'utf8');
  w.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
  });
  w.end(buf);
}

function json(w, obj) {
  const buf = Buffer.from(JSON.stringify(obj), 'utf8');
  w.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
  });
  w.end(buf);
}

/* -------------------------------------------------------------- shared UI */

const LOGO = `<svg class="cube" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.2 27.4 9.6v12.8L16 28.8 4.6 22.4V9.6Z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/><path d="M4.9 9.8 16 16l11.1-6.2M16 16v12.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/></svg>`;

const CSS = `
:root{
  --ink:#283c46; --soft:#54636c; --rule:#e4e9ed; --paper:#fff;
  --page:#f1f3f6; --green:#64c52f; --green-dark:#4ea61f;
  --term:#283c46; --term-fg:#e8edf0; --code-bg:#f9f9f9;
  --kw:#a82255; --str:#008075; --lit:#5642a6; --com:#818181;
  --mono:"Ubuntu Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  --sans:"Source Sans Pro","Source Sans 3",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--sans);color:var(--ink);background:var(--page);-webkit-font-smoothing:antialiased}
a{color:inherit}
.masthead{background:var(--page);padding:26px 0 18px;text-align:center}
.brand{display:inline-flex;align-items:center;gap:12px;font-size:30px;font-weight:700;letter-spacing:-.3px}
.cube{width:1.05em;height:1.05em;color:#3d4f5f}
.nav{background:#f7f9fa;border-top:1px solid #edf1f3;border-bottom:1px solid #e6ebee}
.nav ul{display:flex;gap:26px;list-style:none;margin:0 auto;padding:12px 20px;max-width:1000px;align-items:center}
.nav a{color:#8a9aa1;text-decoration:none;font-size:15px}
.nav a:hover,.nav a.on{color:var(--green)}
.nav .right{margin-left:auto}
main{max-width:1000px;margin:0 auto;padding:30px 22px 70px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.2px}
.lede{color:var(--soft);margin:0 0 26px;font-size:15px}
.card{background:var(--paper);border:1px solid #e7ecf0;border-radius:8px;padding:22px 24px;margin:0 0 18px}
.card h2{font-size:15px;text-transform:uppercase;letter-spacing:.09em;color:#7b8b93;margin:0 0 14px;font-weight:600}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.btn{display:inline-flex;align-items:center;gap:8px;border:1px solid #dfe6ea;background:#fff;color:var(--ink);
  font:inherit;font-size:14px;padding:9px 14px;border-radius:5px;cursor:pointer;text-decoration:none;transition:.12s}
.btn:hover{border-color:#c9d4da;transform:translateY(-1px)}
.btn--green{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}
.btn--green:hover{background:var(--green-dark);border-color:var(--green-dark)}
.btn--dark{background:var(--ink);border-color:var(--ink);color:#fff}
.btn small{opacity:.75;font-weight:400}
.method{display:inline-block;font-family:var(--mono);font-size:11.5px;padding:2px 7px;border-radius:3px;border:1px solid;margin-right:8px;vertical-align:2px}
.method.get{color:#2b7a90;border-color:#bfdbe3;background:#f1f9fb}
.method.post{color:#7d5a00;border-color:#e8d9a8;background:#fdf8e6}
code.path{font-family:var(--mono);font-size:14.5px;background:#f2f5f7;padding:2px 6px;border-radius:3px}
pre{margin:0;font-family:var(--mono);font-size:13px;line-height:1.55;overflow:auto}
pre.code{background:var(--code-bg);border:1px solid #ededed;border-radius:4px;padding:14px 16px;color:var(--ink)}
pre.term{background:var(--term);color:var(--term-fg);border-radius:4px;padding:14px 16px}
pre.term .prompt{color:#fff}
pre.term .out{color:#c0c0c0}
.kw{color:var(--kw)} .str{color:var(--str)} .lit{color:var(--lit)} .com{color:var(--com)}
.resp{margin-top:12px;border:1px solid #e7ecf0;border-radius:6px;overflow:hidden;background:#fff}
.resp__bar{display:flex;gap:10px;align-items:center;padding:8px 12px;background:#f7f9fa;border-bottom:1px solid #edf1f3;font-family:var(--mono);font-size:12px}
.status{font-weight:700}
.status.ok{color:#2f8f4e}.status.warn{color:#b37500}.status.bad{color:#b3382c}
.resp pre{padding:12px;background:var(--term);color:var(--term-fg);max-height:230px}
.resp .meta{padding:9px 12px;font-family:var(--mono);font-size:11.5px;color:#6d7c84;border-top:1px dashed #e7ecf0;white-space:pre-wrap}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid #eef2f4;vertical-align:top}
th{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:#7b8b93;font-weight:600}
td code{font-family:var(--mono);font-size:13px}
.muted{color:#7b8b93}
footer{color:#8a9aa1;font-size:12.5px;text-align:center;padding:0 20px 40px}
.tabs{display:flex;gap:8px;margin-bottom:20px}
.tab{padding:8px 14px;border-radius:999px;font-size:14px;text-decoration:none;border:1px solid #dfe6ea;background:#fff;color:#5b6b73}
.tab.on{background:var(--ink);border-color:var(--ink);color:#fff}
/* showcase form */
.form{background:#fff;border:1px solid #e7ecf0;border-radius:8px;padding:26px 30px;max-width:720px}
.form label{display:block;margin:18px 0 7px;font-size:14px}
.form input[type=text],.form textarea{width:100%;border:1px solid #dfe6ea;border-radius:4px;padding:10px 12px;font:inherit;font-size:14px;background:#fbfcfd}
.form textarea{min-height:150px;resize:vertical}
.radios{display:flex;gap:22px;align-items:center;margin:16px 0 22px;font-size:14px;flex-wrap:wrap}
.radios label{margin:0;display:flex;gap:7px;align-items:center}
.pill{display:inline-block;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:#7b8b93;border:1px solid #e4e9ed;border-radius:999px;padding:2px 9px}
`;

function layout(opts) {
  const { title, active, body } = opts;
  const link = (href, label) =>
    `<li><a href="${href}" class="${active === href ? 'on' : ''}">${label}</a></li>`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='26'>&#128230;</text></svg>">
<style>${CSS}</style>
</head><body>
<header class="masthead"><a class="brand" href="/console" style="text-decoration:none">${LOGO}<span>Snippetbox</span></a></header>
<nav class="nav"><ul>
  ${link('/console', 'Console')}
  ${link('/showcase', 'Showcase')}
  ${link('/routes', 'Routes')}
  ${link('/summary', 'Summary')}
  <li><a href="/home" ${active === '/home' ? 'class=on' : ''}>Templated home</a></li>
  ${link('/db', 'Database')}
  ${link('/logs', 'Logs')}
  <li class="right"><a href="/" target="_blank" rel="noopener">GET / <span class="muted">raw</span></a></li>
</ul></nav>
<main>${body}</main>
<footer>Snippetbox demo &middot; chapter one of <em>Let's Go</em> by Alex Edwards &middot; running since ${STARTED.toISOString().slice(0, 19).replace('T', ' ')} UTC</footer>
</body></html>`;
}

/* ------------------------------------------------------------- page: /console */

const CONSOLE_BODY = `
<h1>Live routes</h1>
<p class="lede">Every endpoint below is a real HTTP request to this server. Press a button and watch the status line, headers and body that the book's Go handlers would have sent.</p>

<section class="card">
  <h2>1 &middot; The home route</h2>
  <p style="margin:0 0 14px"><span class="method get">GET</span><code class="path">/</code></p>
  <pre class="code" data-lang="go">func home(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("Hello from Snippetbox"))
}</pre>
  <div class="row" style="margin-top:14px">
    <button class="btn btn--green" data-run="GET /">Send request</button>
    <a class="btn" href="/" target="_blank" rel="noopener">Open raw response</a>
  </div>
  <div class="resp" data-slot="GET /" hidden></div>
</section>

<section class="card">
  <h2>2 &middot; A URL query string</h2>
  <p style="margin:0 0 14px"><span class="method get">GET</span><code class="path">/snippet/view?id=7</code></p>
  <div class="row">
    <button class="btn btn--green" data-run="GET /snippet/view?id=7">Valid id</button>
    <button class="btn" data-run="GET /snippet/view?id=abc">Invalid id (abc)</button>
    <button class="btn" data-run="GET /snippet/view">Missing id</button>
  </div>
  <div class="resp" data-slot="view" hidden></div>
</section>

<section class="card">
  <h2>3 &middot; Method-based routing</h2>
  <p style="margin:0 0 14px"><span class="method post">POST</span><code class="path">/snippet/create</code> <span class="muted">— and a 405 for anything else</span></p>
  <div class="row">
    <button class="btn btn--green" data-run="POST /snippet/create">POST request</button>
    <button class="btn" data-run="GET /snippet/create">GET request</button>
    <button class="btn" data-run="PUT /snippet/create">PUT request</button>
    <button class="btn" data-run="DELETE /snippet/create">DELETE request</button>
  </div>
  <div class="resp" data-slot="create" hidden></div>
</section>

<section class="card">
  <h2>4 &middot; Request log <span class="pill">live</span></h2>
  <div class="resp" id="log" style="margin:0"><pre id="logBody" style="background:#fff;color:#41525b;max-height:260px">Waiting for requests…</pre></div>
</section>`;

const CONSOLE_SCRIPT = `
(function(){
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function slotFor(key){
    if (key === 'GET /') return document.querySelector('[data-slot="GET /"]');
    if (key.includes('/snippet/view')) return document.querySelector('[data-slot="view"]');
    return document.querySelector('[data-slot="create"]');
  }
  function cls(status){ return status < 300 ? 'ok' : status < 400 ? 'warn' : 'bad'; }
  async function run(spec, btn){
    const [method, path] = spec.split(' ');
    const slot = slotFor(spec);
    btn.disabled = true;
    slot.hidden = false;
    slot.innerHTML = '<div class="resp__bar"><span class="muted">sending…</span></div>';
    try {
      const res = await fetch(path, { method, cache: 'no-store' });
      const body = await res.text();
      const head = [];
      ['content-type','content-length','allow','x-content-type-options','date']
        .forEach(h => { const v = res.headers.get(h); if (v) head.push(h + ': ' + v); });
      const curl = 'curl -i -X ' + method + ' ' + location.origin + path;
      slot.innerHTML =
        '<div class="resp__bar"><span class="status ' + cls(res.status) + '">' + res.status + ' ' + (res.statusText || '') + '</span>' +
        '<span class="muted" style="margin-left:auto">' + method + ' ' + esc(path) + '</span></div>' +
        '<pre>' + (esc(body) || '<span class="out">(empty body)</span>') + '</pre>' +
        '<div class="meta">' + head.map(esc).join('\\n') + '</div>' +
        '<div class="meta">$ ' + esc(curl) + '</div>';
    } catch (e) {
      slot.innerHTML = '<div class="resp__bar"><span class="status bad">request failed</span></div><pre>' + esc(String(e)) + '</pre>';
    }
    btn.disabled = false;
  }
  document.querySelectorAll('[data-run]').forEach(btn => {
    btn.addEventListener('click', () => run(btn.dataset.run, btn));
  });
  // highlight Go snippets
  const KW = /\\b(package|import|func|return|if|else|for|range|var|const|type|struct|interface|map|string|int|bool|nil|true|false|go|defer|switch|case|break|continue|make|new|byte)\\b/g;
  document.querySelectorAll('pre.code[data-lang=go]').forEach(pre => {
    let h = esc(pre.textContent);
    h = h.replace(/(\\/\\/[^\\n]*)/g, '<span class="com">$1</span>');
    h = h.replace(/("(?:[^"\\\\\\n]|\\\\.)*")/g, '<span class="str">$1</span>');
    h = h.replace(KW, '<span class="kw">$1</span>');
    pre.innerHTML = h;
  });
  async function pollLog(){
    try {
      const r = await fetch('/api/log', { cache: 'no-store' });
      const entries = await r.json();
      const el = document.getElementById('logBody');
      if (!entries.length) return;
      el.textContent = entries.map(e =>
        e.method.padEnd(7) + e.path + ' '.repeat(Math.max(1, 34 - Math.min(34, e.path.length))) + e.status + '  ' + e.ms.toFixed(1) + 'ms'
      ).join('\\n');
    } catch (_) {}
  }
  pollLog(); setInterval(pollLog, 1500);
})();`;

/* ------------------------------------------------------------ page: /showcase */

const SHOWCASE_BODY = `
<h1>Where the build ends up</h1>
<p class="lede">Chapter one's screenshot shows the finished “Create a new snippet” page. Here it is again, rebuilt in HTML from that figure — this is the destination of every chapter that follows.</p>
<div class="form">
  <label for="t">Title:</label>
  <input id="t" type="text" placeholder="A title for your snippet">
  <label for="c">Content:</label>
  <textarea id="c" placeholder="Paste anything you like here…"></textarea>
  <div class="radios">
    <span>Delete in:</span>
    <label><input type="radio" name="d" checked> One Year</label>
    <label><input type="radio" name="d"> One Week</label>
    <label><input type="radio" name="d"> One Day</label>
  </div>
  <button class="btn btn--green" onclick="this.textContent='Saved ✓';setTimeout(()=>this.textContent='Publish snippet',1600)">Publish snippet</button>
</div>
<p class="lede" style="margin-top:18px">Nothing is stored — the form is a visual replica of the book's figure. The routes behind it get built across chapters 2–11.</p>`;

/* -------------------------------------------------------------- page: /routes */

const ROUTES_BODY = `
<h1>Route table</h1>
<p class="lede">Section 2.3 of the book introduces this mapping of URL patterns to handlers. Every row is live on this server.</p>
<section class="card" style="padding:6px 10px">
<table>
<thead><tr><th>URL pattern</th><th>Handler</th><th>Action</th><th>Try it</th></tr></thead>
<tbody>
<tr><td><code>/</code></td><td><code>home</code></td><td>Display the home page</td><td><a href="/" target="_blank" rel="noopener">open</a></td></tr>
<tr><td><code>/snippet/view</code></td><td><code>snippetView</code></td><td>Display a specific snippet</td><td><a href="/snippet/view?id=7" target="_blank" rel="noopener">open</a></td></tr>
<tr><td><code>/snippet/create</code></td><td><code>snippetCreate</code></td><td>Create a new snippet <span class="muted">(POST only)</span></td><td><a href="/console">console</a></td></tr>
</tbody></table>
</section>
<section class="card">
  <h2>main.go</h2>
<pre class="code" data-lang="go">package main

import (
    "log"
    "net/http"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", home)
    mux.HandleFunc("/snippet/view", snippetView)
    mux.HandleFunc("/snippet/create", snippetCreate)

    log.Print("Starting server on :4000")
    err := http.ListenAndServe(":4000", mux)
    log.Fatal(err)
}</pre>
</section>
<section class="card">
  <h2>cURL a couple of responses</h2>
<pre class="term">$ curl -i -X POST <span class="prompt" id="base1">http://localhost:4000</span>/snippet/create
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Create a new snippet...

$ curl -i -X PUT <span class="prompt" id="base2">http://localhost:4000</span>/snippet/create
HTTP/1.1 405 Method Not Allowed
Allow: POST
Content-Type: text/plain; charset=utf-8
Method Not Allowed</pre>
  <p class="muted" style="font-size:13px;margin:12px 0 0">The origin above is this sandbox's URL — copy the commands and they work against the live demo.</p>
</section>
<script>
  document.querySelectorAll('.term [id^=base]').forEach(el => el.textContent = location.origin);
  const KW = /\\b(package|import|func|return|if|else|for|range|var|const|type|struct|interface|map|string|int|bool|nil|true|false|go|defer|switch|case|break|continue|make|new|byte|log|err)\\b/g;
  document.querySelectorAll('pre.code[data-lang=go]').forEach(pre => {
    let h = pre.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    h = h.replace(/(\\/\\/[^\\n]*)/g, '<span class="com">$1</span>');
    h = h.replace(/("(?:[^"\\\\\\n]|\\\\.)*")/g, '<span class="str">$1</span>');
    h = h.replace(KW, '<span class="kw">$1</span>');
    pre.innerHTML = h;
  });
</script>`;

/* ------------------------------------------------------------------ routing */

function handler(req, res) {
  const started = process.hrtime.bigint();
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const p = url.pathname;

  res.on('finish', () => {
    record({
      t: Date.now(),
      method: req.method,
      path: p + (url.search || ''),
      status: res.statusCode,
      ms: Number(process.hrtime.bigint() - started) / 1e6,
    });
  });

  // Chapter 2.7-2.8: templated home page and the static file server.
  if (chapter3.handle(req, res, url, app, config)) return;
  // Chapter 4.7/4.8 own /snippet/view and /snippets, so they dispatch first.
  if (chapter4.handle(req, res, url, db, app)) return;
  if (chapter2.handle(req, res, url, config, app)) return;

  // 1. The home route.
  if (p === '/') {
    return write(res, 200, 'Hello from Snippetbox');
  }

  // 2. A URL query string.
  //    Like the book's snippetView handler, this does not inspect r.Method:
  //    chapter 2.4 only adds the method check to /snippet/create.
  if (p === '/snippet/view') {
    const raw = url.searchParams.get('id');
    if (raw === null || !/^-?\d+$/.test(raw) || Number(raw) < 1) {
      return httpError(res, 404, '404 page not found');
    }
    return write(res, 200, `Display a specific snippet with ID ${Number(raw)}...`);
  }

  // 3. Method-based routing. Since chapter 4, a valid POST /snippet/create is
  // handled by the SnippetModel (it INSERTs and redirects with a 303), so only
  // the 405 fallback is left here.
  if (p === '/snippet/create') {
    return httpError(res, 405, 'Method Not Allowed', { Allow: 'POST' });
  }

  // Presentation pages.
  if (p === '/console' || p === '/console/') {
    return html(res, layout({ title: 'Snippetbox — live routes', active: '/console', body: CONSOLE_BODY }) +
      `<script>${CONSOLE_SCRIPT}</script>`);
  }
  if (p === '/showcase') {
    return html(res, layout({ title: 'Snippetbox — showcase', active: '/showcase', body: SHOWCASE_BODY }));
  }
  if (p === '/routes') {
    return html(res, layout({ title: 'Snippetbox — routes', active: '/routes', body: ROUTES_BODY }));
  }
  if (p === '/summary' || p === '/summary/') {
    try {
      const page = fs.readFileSync(path.join(__dirname, '..', 'chapter-one.html'), 'utf8');
      return html(res, page);
    } catch (e) {
      return httpError(res, 404, 'chapter-one.html not found — run python3 build_chapter1.py');
    }
  }
  if (p === '/api/log') {
    return json(res, LOG);
  }
  if (p === '/healthz') {
    return write(res, 200, 'ok');
  }

  return httpError(res, 404, '404 page not found');
}

const server = http.createServer(handler);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    app.errorLog.Print(`listen tcp ${config.addr}: bind: address already in use`);
  } else {
    app.errorLog.Print(err.message);
  }
  process.exit(1);
});

// Chapter 3.2: informational messages go through infoLog, with the INFO prefix.
server.listen(PORT, HOST, () => {
  app.infoLog.Printf('Starting server on %s', config.addr);
  app.infoLog.Printf('Database: in-memory snippets table seeded with %d rows (db.Ping() ok)', db.table.rows.length);
  app.infoLog.Printf('Request console: http://%s/console', config.addr.replace(/^:/, 'localhost:'));
});

// Shut down cleanly so a restart always frees the port.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
