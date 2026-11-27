'use strict';

/*
 * HTML for the chapter-7 demo pages: the router comparison, the live route
 * table, and a probe that asks the real matcher what a request would do.
 */

const CSS = `
:root{--ink:#283c46;--soft:#54636c;--faint:#7b8b93;--page:#f1f3f6;--green:#64c52f;
--mono:"Ubuntu Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
--sans:"Source Sans Pro","Source Sans 3",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6}
header{background:#fff;border-bottom:1px solid #e4e9ed;padding:18px 0}
.wrap{max-width:1000px;margin:0 auto;padding:0 22px}
h1{font-size:22px;margin:0}
h1 small{font-weight:400;color:var(--faint);font-size:14px;display:block;margin-top:2px}
nav{display:flex;gap:16px;margin-top:12px;font-size:14px;flex-wrap:wrap}
nav a{color:#6a7c85;text-decoration:none;border-bottom:1px solid transparent}
nav a:hover,nav a.on{color:#4ea61f;border-bottom-color:#4ea61f}
main{padding:26px 0 70px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#7b8b93;margin:28px 0 10px;font-weight:700}
h2:first-child{margin-top:0}
.card{background:#fff;border:1px solid #e4e9ed;border-radius:10px;padding:18px 20px;margin-bottom:16px}
.card p{margin:0 0 10px;color:var(--soft);font-size:14px}
pre{background:#283c46;color:#e8edf0;border-radius:8px;padding:14px 16px;font-family:var(--mono);
font-size:12.5px;line-height:1.6;overflow:auto;max-height:420px;margin:0;white-space:pre-wrap;word-break:break-word}
pre.light{background:#fbfcfd;color:var(--ink);border:1px solid #e4e9ed}
code{font-family:var(--mono);font-size:13px;background:#eef2f4;padding:1px 5px;border-radius:3px}
.btn{display:inline-block;border:1px solid #dfe6ea;background:#fff;color:var(--ink);font:inherit;font-size:14px;
padding:8px 13px;border-radius:5px;cursor:pointer;text-decoration:none}
.btn:hover{border-color:#c9d4da}
.btn--green{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}
.btn--red{background:#b3382c;border-color:#b3382c;color:#fff;font-weight:600}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
input[type=text]{font-family:var(--mono);font-size:13px;padding:9px 11px;border:1px solid #dfe6ea;
border-radius:5px;background:#fbfcfd;min-width:260px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eef2f4;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#7b8b93}
td code{background:#f4f7f8}
.mono{font-family:var(--mono);font-size:13px}
.muted{color:#7b8b93;font-size:13px}
.tag{display:inline-block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:1px 8px;
border-radius:999px;border:1px solid}
.tag.get{color:#2f6f9f;border-color:#bcd8ea;background:#f2f8fc}
.tag.post{color:#8a5a12;border-color:#ecd9b8;background:#fdf8ef}
`;

function layout(active, title, body, script) {
  const link = (href, label) => `<a href="${href}"${active === href ? ' class="on"' : ''}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Snippetbox</title><style>${CSS}</style></head><body>
<header><div class="wrap">
  <h1>Advanced routing <small>Let's Go, chapter 7 — httprouter, clean URLs, method-based routing</small></h1>
  <nav>
    ${link('/router', 'Router')}
    ${link('/clean', 'The app on httprouter')}
    ${link('/middleware', 'Middleware')}
    ${link('/newsnippets', 'Templates')}
    ${link('/summary', 'Summary')}
  </nav>
</div></header>
<main><div class="wrap">${body}</div></main>
${script ? `<script>${script}</script>` : ''}
</body></html>`;
}

function indexPage(routes) {
  const rows = routes.map((r) => `
    <tr>
      <td><span class="tag ${r.method === 'POST' ? 'post' : 'get'}">${r.method}</span></td>
      <td><code>${r.pattern}</code></td>
      <td class="mono muted">${r.params.length ? r.params.join(', ') : '—'}</td>
    </tr>`).join('');

  const body = `
<h2>Clean URLs and method-based routing <span class="muted">— sections 7.1–7.2</span></h2>
<div class="card">
  <p>Go's <code>ServeMux</code> cannot dispatch on method, and it cannot put a variable in the path. So chapter 7
     swaps it for <code>julienschmidt/httprouter</code> — and this page is served by a working implementation of
     it: named parameters, catch-alls, automatic <code>OPTIONS</code>, <code>Allow</code> headers on 405s, and
     custom 404/405 handlers.</p>
  <p class="muted" style="margin:0">Registered routes (read from the router itself):</p>
  <table style="margin-top:8px"><thead><tr><th>Method</th><th>Pattern</th><th>Params</th></tr></thead>
    <tbody>${rows}</tbody></table>
</div>

<div class="card">
  <p><b>Probe the matcher.</b> Type a path and pick a method; the answer comes from the real router, not a
     description of one.</p>
  <div class="row">
    <input type="text" id="probePath" value="/snippet/view/1">
    <select id="probeMethod" class="btn" style="font-family:inherit">
      <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>OPTIONS</option>
    </select>
    <button class="btn btn--green" id="probe">Match it</button>
  </div>
  <div class="row" style="font-size:13px">
    <button class="btn" data-probe="/snippet/view/1|GET">/snippet/view/1</button>
    <button class="btn" data-probe="/snippet/view/1|POST">POST /snippet/view/1</button>
    <button class="btn" data-probe="/snippet/view/abc|GET">/snippet/view/abc</button>
    <button class="btn" data-probe="/snippet/bar|GET">/snippet/bar</button>
    <button class="btn" data-probe="/snippet/view/1/extra|GET">/snippet/view/1/extra</button>
  </div>
  <pre id="probeOut">pick a path</pre>
</div>

<div class="card">
  <p><b>Live routes.</b> These really are served by httprouter:</p>
  <pre class="light">GET  /clean/snippet/view/1       200  the clean URL, id from the path
POST /clean/snippet/view/1       405  Allow: GET, OPTIONS
GET  /clean/snippet/view/abc     404  our custom router.NotFound handler
GET  /clean/snippet/view/99      404  app.notFound(), from the handler
GET  /clean/missing              404  router.NotFound — the same body now
GET  /clean/static/css/main.css  200  the /static/*filepath catch-all</pre>
</div>

<div class="card">
  <p><b>The 404 discrepancy the chapter fixes.</b> Before the custom handler,
     <code>/snippet/view/99</code> (no such record) returned <code>Not Found</code> from
     <code>app.notFound()</code>, while <code>/missing</code> (no such route) returned httprouter's own
     <code>404 page not found</code>. Assigning <code>router.NotFound</code> makes both identical.</p>
</div>`;

  const script = `
(function(){
  function show(t){ document.getElementById('probeOut').textContent = t; }
  function probe(){
    var p = document.getElementById('probePath').value;
    var m = document.getElementById('probeMethod').value;
    fetch('/api/router/match?path=' + encodeURIComponent(p) + '&method=' + m, { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var lines = [d.method + ' ' + d.path, ''];
        lines.push('status:  ' + d.status);
        if (d.pattern) lines.push('pattern: ' + d.pattern);
        if (d.params && d.params.length) {
          lines.push('params:  ' + d.params.map(function(x){ return x.key + '=' + JSON.stringify(x.value); }).join(', '));
        }
        if (d.allow) lines.push('Allow:   ' + d.allow);
        if (d.note) lines.push('', d.note);
        show(lines.join('\\n'));
      }).catch(function(e){ show('unreachable: ' + e); });
  }
  document.getElementById('probe').addEventListener('click', probe);
  document.querySelectorAll('[data-probe]').forEach(function(b){
    b.addEventListener('click', function(){
      var parts = b.getAttribute('data-probe').split('|');
      document.getElementById('probePath').value = parts[0];
      document.getElementById('probeMethod').value = parts[1];
      probe();
    });
  });
})();`;

  return layout('/router', 'Router', body, script);
}

module.exports = { indexPage, layout };
