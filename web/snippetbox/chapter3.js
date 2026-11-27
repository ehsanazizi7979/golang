'use strict';

/*
 * The chapter-3 demo pages: what the book does in the terminal, made visible.
 *
 *   /logs      the live stream from infoLog and errorLog (3.2)
 *   /config    the parsed command-line flags (3.1)
 *   /break     toggle the deliberate missing template from page 77 (3.3/3.4)
 */

const path = require('path');
const fs = require('fs');

const CSS = `
:root{
  --ink:#283c46; --soft:#54636c; --faint:#7b8b93; --page:#f1f3f6; --green:#64c52f;
  --mono:"Ubuntu Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --sans:"Source Sans Pro","Source Sans 3",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6}
header{background:#fff;border-bottom:1px solid #e4e9ed;padding:18px 0}
.wrap{max-width:900px;margin:0 auto;padding:0 22px}
h1{font-size:22px;margin:0}
h1 small{font-weight:400;color:var(--faint);font-size:14px;display:block;margin-top:2px}
nav{display:flex;gap:16px;margin-top:12px;font-size:14px;flex-wrap:wrap}
nav a{color:#6a7c85;text-decoration:none;border-bottom:1px solid transparent}
nav a:hover,nav a.on{color:#4ea61f;border-bottom-color:#4ea61f}
main{padding:26px 0 70px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#7b8b93;margin:30px 0 10px;font-weight:700}
h2:first-child{margin-top:0}
.term{background:#283c46;color:#e8edf0;border-radius:8px;padding:16px 18px;font-family:var(--mono);font-size:13px;line-height:1.65;overflow:auto;max-height:460px;margin:0;white-space:pre-wrap;word-break:break-word}
.term .INFO{color:#9fe08a}
.term .ERROR{color:#ff9b8a}
.term .site{color:#8fa3ad}
.term .trace{color:#7d929c}
.card{background:#fff;border:1px solid #e4e9ed;border-radius:10px;padding:18px 20px;margin-bottom:16px}
.card p{margin:0 0 10px;color:var(--soft);font-size:14px}
.card p:last-child{margin-bottom:0}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{text-align:left;padding:8px 10px;border-bottom:1px solid #eef2f4;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#7b8b93}
code{font-family:var(--mono);font-size:13px;background:#eef2f4;padding:1px 5px;border-radius:3px}
.btn{display:inline-block;border:1px solid #dfe6ea;background:#fff;color:var(--ink);font:inherit;font-size:14px;
  padding:8px 13px;border-radius:5px;cursor:pointer;text-decoration:none}
.btn:hover{border-color:#c9d4da}
.btn--green{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}
.btn--red{background:#c0392b;border-color:#c0392b;color:#fff;font-weight:600}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.tag{display:inline-block;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;padding:1px 8px;border-radius:999px;border:1px solid}
.tag.on{color:#2f8f4e;border-color:#bfe3cb;background:#f2faf4}
.tag.off{color:#b3382c;border-color:#eec5bf;background:#fdf3f2}
.muted{color:#7b8b93;font-size:13px}
`;

function layout(active, title, body) {
  const link = (href, label) => `<a href="${href}" class="${active === href ? 'on' : ''}">${label}</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Snippetbox</title><style>${CSS}</style></head>
<body>
<header><div class="wrap">
  <h1>Configuration and error handling <small>Let's Go, chapter 3 — the book's refactor, running live</small></h1>
  <nav>
    ${link('/logs', 'Live logs')}
    ${link('/config', 'Configuration')}
    ${link('/break', 'Deliberate error')}
    ${link('/home', 'Templated home')}
    ${link('/summary', 'Summary')}
  </nav>
</div></header>
<main><div class="wrap">${body}</div></main>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------------ /logs */

function logsPage(app) {
  const body = `
<h2>Leveled logging <span class="muted">— section 3.2</span></h2>
<div class="card">
  <p><code>INFO</code> messages are written to <b>stdout</b>; <code>ERROR</code> messages go to
     <b>stderr</b> with the calling <code>file:line</code> (the <code>log.Lshortfile</code> flag).
     This is the same stream your terminal shows when the server runs.</p>
  <div class="row">
    <button class="btn btn--green" id="ping">Generate traffic</button>
    <button class="btn" id="boom">Trigger a 500</button>
    <button class="btn" id="pause">Pause</button>
    <span class="muted" id="count" style="align-self:center"></span>
  </div>
  <pre class="term" id="stream">connecting…</pre>
</div>
<p class="muted">Every request to this demo server is logged. <code>Trigger a 500</code> requests the
broken template (see the Deliberate error page) so you can watch <code>serverError</code> log a stack trace
and return a generic 500.</p>
<script>
(function(){
  var paused = false, seen = 0;
  var el = document.getElementById('stream');
  var count = document.getElementById('count');
  var labels = ['INFO','ERROR'];
  document.getElementById('pause').addEventListener('click', function(e){
    paused = !paused; e.target.textContent = paused ? 'Resume' : 'Pause';
  });
  document.getElementById('ping').addEventListener('click', function(){
    fetch('/home').catch(function(){}); fetch('/static/css/main.css').catch(function(){});
  });
  document.getElementById('boom').addEventListener('click', function(){
    fetch('/break?toggle=on').then(function(){ return fetch('/home'); }).catch(function(){});
  });
  function paint(entries){
    if (!entries.length) return;
    el.innerHTML = entries.slice().reverse().map(function(e){
      var msg = e.msg.split('\\n');
      var head = '<span class="site">' + (e.site ? e.site + ': ' : '') + '</span>' + escapeHtml(msg[0]);
      var rest = msg.slice(1).map(function(l){ return '<span class="trace">' + escapeHtml(l) + '</span>'; }).join('\\n');
      return '<span class="' + e.level + '">' + e.prefix + '</span> ' + e.ts + ' ' + head + (rest ? '\\n' + rest : '');
    }).join('\\n');
    count.textContent = entries.length + ' entries';
  }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function tick(){
    if (paused) return;
    fetch('/api/logs', {cache:'no-store'}).then(function(r){ return r.json(); }).then(paint).catch(function(){});
  }
  tick(); setInterval(tick, 1000);
})();
</script>`;
  return layout('/logs', 'Live logs', body);
}

/* ---------------------------------------------------------------- /config */

function configPage(app, config) {
  const rows = [
    ['-addr', config.addr, 'HTTP network address'],
    ['-static-dir', config.staticDir, 'Path to static assets'],
    ['-template-dir', config.templateDir, 'Path to HTML templates'],
  ].map(([flag, value, help]) => `
    <tr><td><code>${flag}</code></td><td><code>${escapeHtml(value)}</code></td><td class="muted">${help}</td></tr>`).join('');

  const body = `
<h2>Managing configuration settings <span class="muted">— section 3.1</span></h2>
<div class="card">
  <p>The book replaces the hard-coded <code>":4000"</code> and <code>"./ui/static"</code> with command-line
     flags. These are the values this server actually parsed at start-up:</p>
  <table><thead><tr><th>Flag</th><th>Value</th><th>Help text</th></tr></thead><tbody>${rows}</tbody></table>
</div>
<div class="card">
  <p><b>Try it.</b> The server accepts the same flags the book defines, and prints the same
     <code>-help</code> output. Restart it with a different address or a different static directory:</p>
  <pre class="term">$ node web/server.js -addr=:4000 -static-dir=./web/snippetbox/ui/static
$ node web/server.js -help
${escapeHtml(config.usage())}</pre>
</div>
<div class="card">
  <p><b>Why flags and not environment variables?</b> <code>os.Getenv()</code> gives you no default, no
     <code>-help</code>, and always a string. The book's recommendation is to pass an environment variable
     <em>as</em> a flag: <code>-addr=$SNIPPETBOX_ADDR</code>.</p>
</div>
<div class="card">
  <p><b>The http.Server struct.</b> Using <code>&amp;http.Server{Addr, ErrorLog, Handler}</code> instead of
     <code>http.ListenAndServe()</code> is what lets the server's own errors go through
     <code>errorLog</code> — visible on the <a href="/logs">Live logs</a> page.</p>
</div>`;
  return layout('/config', 'Configuration', body);
}

/* ----------------------------------------------------------------- /break */

function breakPage(app) {
  const on = app.brokenTemplate;
  const body = `
<h2>Dependency injection and centralized errors <span class="muted">— sections 3.3 and 3.4</span></h2>
<div class="card">
  <p>Page 77 of the book introduces a deliberate error: rename
     <code>ui/html/pages/home.tmpl</code> and request the home page. The handler is now a method on
     <code>*application</code>, so it can reach the injected <code>errorLog</code>, and
     <code>app.serverError()</code> logs the error plus a stack trace before sending a generic 500.</p>
  <p>Status: <span class="tag ${on ? 'off' : 'on'}">${on ? 'template missing — errors are live' : 'template present — normal'}</span></p>
  <div class="row" style="margin-top:14px">
    <a class="btn ${on ? '' : 'btn--red'}" href="/break?toggle=${on ? 'off' : 'on'}">${on ? 'Restore home.tmpl' : 'Simulate the missing template'}</a>
    <a class="btn" href="/home">Request /home</a>
    <a class="btn" href="/logs">Watch the log</a>
  </div>
</div>
<div class="card">
  <p>With the error switched on, <code>/home</code> returns <code>500 Internal Server Error</code> with no
     detail (the user never sees the trace), while the terminal and the log page show:</p>
  <pre class="term">ERROR   ${'2022/01/29 16:24:02'} handlers.go:24: open ./ui/html/pages/home.tmpl: no such file or directory
goroutine 6 [running]:
runtime/debug.Stack()
        /usr/local/go/src/runtime/debug/stack.go:24 +0x65
main.(*application).serverError(...)
        ./cmd/web/helpers.go:10 +0x58
main.(*application).home(...)
        ./cmd/web/handlers.go:24 +0x194</pre>
  <p style="margin-top:10px">That <code>handlers.go:24</code> is the point of <code>errorLog.Output(2, trace)</code>:
     without the frame skip the log reports <code>helpers.go:10</code>, where the message is written, instead of
     where the error actually came from.</p>
</div>
<div class="card">
  <p><b>The three helpers.</b> <code>serverError</code> logs and sends a 500;
     <code>clientError(w, status)</code> sends the status with its <code>http.StatusText()</code> description;
     <code>notFound</code> is the 404 convenience wrapper. They are what the handlers now call instead of
     repeating <code>http.Error</code> everywhere.</p>
</div>`;
  return layout('/break', 'Deliberate error', body);
}

/* ------------------------------------------------------------- dispatcher */

function handle(req, res, url, app, config) {
  const p = url.pathname;

  if (p === '/logs' || p === '/logs/') {
    return send(res, logsPage(app));
  }
  if (p === '/config' || p === '/config/') {
    return send(res, configPage(app, config));
  }
  if (p === '/break' || p === '/break/') {
    const toggle = url.searchParams.get('toggle');
    if (toggle === 'on') {
      setBroken(app, true);
      app.errorLog.Print('deliberate error enabled: ui/html/pages/home.tmpl is now "missing"');
      res.writeHead(302, { Location: '/break' });
      return res.end();
    }
    if (toggle === 'off') {
      setBroken(app, false);
      app.infoLog.Print('deliberate error cleared: home.tmpl restored');
      res.writeHead(302, { Location: '/break' });
      return res.end();
    }
    return send(res, breakPage(app));
  }
  if (p === '/api/logs') {
    const buf = Buffer.from(JSON.stringify(app.logs.map((e) => ({
      level: e.level,
      prefix: e.prefix,
      site: e.site,
      msg: e.msg,
      ts: e.first.slice(e.prefix.length + 1, e.prefix.length + 20),
    }))), 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length });
    return res.end(buf);
  }
  return false;
}

// The flag has to live on the shared config object: that is what the template
// loader consults (see routes.js), and it is the same object the handlers see.
function setBroken(app, value) {
  app.brokenTemplate = value;
  if (app.config) app.config.brokenTemplate = value;
}

function send(res, body) {
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}

module.exports = { handle };
