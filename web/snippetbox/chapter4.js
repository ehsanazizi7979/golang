'use strict';

/*
 * Chapter-4 demo pages.
 *
 *   /db               the playground: placeholder parameters vs. interpolation
 *   /db/transaction   Begin/Rollback/Commit, with the all-or-nothing guarantee
 *   /api/db           JSON state (rows, pool, statement count)
 *   /snippet/view?id= the `%+v` dump of a Snippet struct, exactly as page 113
 *   /snippets         the `%+v` dump from Latest(), as page 120
 */

const path = require('path');
const fs = require('fs');

const CSS = `
:root{--ink:#283c46;--soft:#54636c;--faint:#7b8b93;--page:#f1f3f6;--green:#64c52f;
--mono:"Ubuntu Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
--sans:"Source Sans Pro","Source Sans 3",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6}
header{background:#fff;border-bottom:1px solid #e4e9ed;padding:18px 0}
.wrap{max-width:960px;margin:0 auto;padding:0 22px}
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
font-size:12.5px;line-height:1.6;overflow:auto;max-height:340px;margin:0;white-space:pre-wrap;word-break:break-word}
pre.light{background:#f9f9f9;color:var(--ink);border:1px solid #ededed}
code{font-family:var(--mono);font-size:13px;background:#eef2f4;padding:1px 5px;border-radius:3px}
.btn{display:inline-block;border:1px solid #dfe6ea;background:#fff;color:var(--ink);font:inherit;font-size:14px;
padding:8px 13px;border-radius:5px;cursor:pointer;text-decoration:none}
.btn:hover{border-color:#c9d4da}
.btn--green{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}
.btn--red{background:#c0392b;border-color:#c0392b;color:#fff;font-weight:600}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
input[type=text],select,textarea{font:inherit;font-size:14px;padding:8px 10px;border:1px solid #dfe6ea;border-radius:4px;background:#fbfcfd}
input[type=text]{min-width:260px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eef2f4;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#7b8b93}
.tag{display:inline-block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:1px 8px;border-radius:999px;border:1px solid}
.tag.ok{color:#2f8f4e;border-color:#bfe3cb;background:#f2faf4}
.tag.bad{color:#b3382c;border-color:#eec5bf;background:#fdf3f2}
.muted{color:#7b8b93;font-size:13px}
`;

function layout(active, title, body) {
  const link = (href, label) => `<a href="${href}" class="${active === href ? 'on' : ''}">${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Snippetbox</title><style>${CSS}</style></head><body>
<header><div class="wrap">
  <h1>Database-driven responses <small>Let's Go, chapter 4 — the SQL patterns, running live</small></h1>
  <nav>
    ${link('/db', 'SQL playground')}
    ${link('/db/transaction', 'Transactions')}
    ${link('/snippets', 'Latest() output')}
    ${link('/logs', 'Logs')}
    ${link('/summary', 'Summary')}
  </nav>
</div></header>
<main><div class="wrap">${body}</div></main></body></html>`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------ /db (the playground) */

function dbPage(db) {
  const rows = db.model.Latest()[0].map((r) => `
    <tr><td>${r.id}</td><td>${esc(r.title)}</td>
        <td class="muted">${r.expires.toISOString().slice(0, 19).replace('T', ' ')}</td></tr>`).join('');

  return layout('/db', 'SQL playground', `
<h2>Executing SQL statements <span class="muted">— sections 4.6–4.8</span></h2>
<div class="card">
  <p>This demo has no MySQL, so the <code>snippets</code> table below is in memory — but the
     statements, the parameters and the behaviour are the chapter's. Statement count:
     <code id="stmtCount">${db.table.statements}</code>.</p>
  <table><thead><tr><th>id</th><th>title</th><th>expires</th></tr></thead><tbody id="rows">${rows}</tbody></table>
  <p class="muted" style="margin-top:10px">Three haiku are seeded, exactly as in section 4.1. Expired rows
     disappear from every query because each SELECT carries
     <code>WHERE expires &gt; UTC_TIMESTAMP()</code>. <a href="/db/expire">Expire row 3 now</a> to see that.</p>
</div>

<h2>Placeholder parameters vs. interpolation <span class="muted">— section 4.6, page 107</span></h2>
<div class="card">
  <p>The query is <code>SELECT … FROM snippets WHERE expires &gt; UTC_TIMESTAMP() AND id = ?</code>.
     Try a normal id, then try <code>1 OR 1=1</code> in both modes:</p>
  <div class="row">
    <input type="text" id="idInput" value="1" aria-label="id value">
    <button class="btn btn--green" id="safe">Run with ? parameter</button>
    <button class="btn btn--red" id="unsafe">Interpolate into the SQL</button>
  </div>
  <pre id="sqlOut">// the statement database/sql would send, and the rows it returns</pre>
</div>

<h2>Insert a snippet <span class="muted">— section 4.6</span></h2>
<div class="card">
  <p><code>INSERT INTO snippets (title, content, created, expires) VALUES(?, ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))</code></p>
  <div class="row">
    <input type="text" id="newTitle" value="O snail" aria-label="title">
    <input type="text" id="newContent" value="O snail Climb Mount Fuji, But slowly, slowly!" aria-label="content" style="min-width:320px">
    <select id="newDays"><option>7</option><option>1</option><option>365</option></select>
    <button class="btn btn--green" id="insert">Exec()</button>
  </div>
  <pre id="insertOut">// Exec() returns a sql.Result: LastInsertId() and RowsAffected()</pre>
  <p class="muted">The book's <code>snippetCreate</code> handler then redirects with
     <code>http.Redirect(w, r, fmt.Sprintf("/snippet/view?id=%d", id), http.StatusSeeOther)</code> — a 303,
     which is why <code>curl -iL</code> follows it in one step.</p>
</div>

<h2>Connection pool <span class="muted">— section 4.4</span></h2>
<div class="card">
  <p><code>sql.Open()</code> does not connect; it prepares a pool. <code>db.Ping()</code> is what forces a real
     connection, which is why the book calls it before starting the server.</p>
  <table><thead><tr><th>Setting</th><th>Value</th></tr></thead><tbody>
    <tr><td>DSN</td><td><code id="dsn">${esc(db.dsn)}</code></td></tr>
    <tr><td>parseTime=true</td><td>DATETIME columns become <code>time.Time</code>, not <code>[]byte</code></td></tr>
    <tr><td>Pool</td><td>open: <span id="poolOpen">${db.pool.opened}</span> · in use: <span id="poolInUse">${db.pool.inUse}</span> · max: ${db.pool.maxOpen}</td></tr>
    <tr><td>db.Ping()</td><td><span class="tag ok">ok</span> (the demo pings once at start-up)</td></tr>
  </tbody></table>
</div>

<script>
(function(){
  function out(el, text){ document.getElementById(el).textContent = text; }
  function render(r){
    if (!r.ok) return 'error: ' + r.error + '\\n\\nSQL sent:\\n' + (r.sql || '');
    var lines = ['SQL:  ' + r.sql];
    if (r.params && r.params.length) lines.push('args: ' + JSON.stringify(r.params));
    lines.push('');
    lines.push(r.rows.length ? r.rows.length + ' row(s):' : '0 rows');
    r.rows.forEach(function(row){
      lines.push('  {ID:' + row.id + ' Title:' + row.title + ' Content:' + row.content +
                 ' Created:' + row.created + ' Expires:' + row.expires + '}');
    });
    if (r.note) lines.push('', r.note);
    return lines.join('\\n');
  }
  function post(path, body){
    return fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      .then(function(r){ return r.json(); });
  }
  document.getElementById('safe').addEventListener('click', function(){
    var id = document.getElementById('idInput').value;
    post('/api/db/query', { mode:'params', id: id }).then(function(r){ out('sqlOut', render(r)); });
  });
  document.getElementById('unsafe').addEventListener('click', function(){
    var id = document.getElementById('idInput').value;
    post('/api/db/query', { mode:'interpolated', id: id }).then(function(r){ out('sqlOut', render(r)); });
  });
  document.getElementById('insert').addEventListener('click', function(){
    post('/api/db/insert', {
      title: document.getElementById('newTitle').value,
      content: document.getElementById('newContent').value,
      days: document.getElementById('newDays').value
    }).then(function(r){
      out('insertOut', render(r));
      if (r.ok) setTimeout(function(){ location.reload(); }, 900);
    });
  });
})();
</script>`);
}

/* ------------------------------------------------------- /db/transaction */

function transactionPage(db) {
  return layout('/db/transaction', 'Transactions', `
<h2>Transactions <span class="muted">— section 4.9</span></h2>
<div class="card">
  <p>A transaction guarantees that either every statement is applied, or none is. This demo runs the
     book's pattern — <code>Begin()</code>, two statements, then <code>defer tx.Rollback()</code> — with the
     second statement failing on purpose, which is the situation the guarantee exists for.</p>
  <div class="row"><button class="btn btn--red" id="run">Run the transaction</button></div>
  <pre id="txOut">// tx, err := db.Begin()</pre>
</div>
<div class="card">
  <p><b>Why <code>defer tx.Rollback()</code> matters.</b> You must always call either
     <code>Rollback()</code> or <code>Commit()</code> before the function returns, or the connection stays open
     and is never returned to the pool — which is how applications run out of connections.</p>
  <p>Because the rollback ran, the row inserted by the first statement is gone:
     <code>SELECT * FROM snippets WHERE title = 'Transaction: step one'</code> returns nothing.</p>
</div>
<script>
document.getElementById('run').addEventListener('click', function(){
  var btn = this; btn.disabled = true;
  fetch('/api/db/transaction', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(r){
      var lines = r.log.map(function(s){
        return s.stmt + '   -- ' + s.status + (s.note ? '\\n   ' + s.note : '');
      });
      lines.push('');
      lines.push('committed: ' + r.committed);
      lines.push('live rows after: ' + r.rowsAfter);
      document.getElementById('txOut').textContent = lines.join('\\n');
    })
    .finally(function(){ btn.disabled = false; });
});
</script>`);
}

/* ------------------------------------------------- %+v dumps, pages 113 & 120 */

function snippetView(db, id) {
  const [snippet, err] = db.model.Get(id);
  if (err) return null; // caller sends the 404
  return formatPlusV(snippet);
}

// Go's %+v for a struct: {ID:1 Title:... Content:... Created:... Expires:...}
function formatPlusV(s) {
  const t = (d) => `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)} +0000 UTC`;
  return `{ID:${s.id} Title:${s.title} Content:${s.content} Created:${t(s.created)} Expires:${t(s.expires)}}`;
}

function snippetsDump(db) {
  const [rows] = db.model.Latest();
  return rows.map(formatPlusV).join('\n') + '\n';
}

/* ------------------------------------------------------------- dispatcher */

function handle(req, res, url, db, app) {
  const p = url.pathname;

  if (p === '/api/db') {
    const [rows] = db.model.Latest();
    return json(res, {
      rows: rows.map((r) => ({
        id: r.id, title: r.title,
        expires: r.expires.toISOString().slice(0, 19).replace('T', ' '),
      })),
      statements: db.table.statements,
      pool: db.pool,
    });
  }

  if (p === '/db' || p === '/db/') {
    return send(res, dbPage(db));
  }

  if (p === '/db/transaction') {
    return send(res, transactionPage(db));
  }

  if (p === '/db/expire') {
    // Make row 3 expired so the WHERE clause visibly filters it out.
    const row = db.table.rows.find((r) => r.id === 3);
    if (row) {
      row.expires = new Date(Date.now() - 86400000);
      db.app.infoLog.Printf('expired snippet id=3 (expires set to yesterday)');
    }
    res.writeHead(302, { Location: '/db' });
    return res.end();
  }

  if (p === '/api/db/query' && req.method === 'POST') {
    readJson(req, (body) => {
      const mode = body.mode === 'interpolated' ? 'interpolated' : 'params';
      const stmt = 'SELECT id, title, content, created, expires FROM snippets ' +
                   'WHERE expires > UTC_TIMESTAMP() AND id = ?';
      const result = db.runSQL(stmt, [body.id], mode);
      db.app.infoLog.Printf('query (mode=%s): %s', mode, stmt);
      json(res, result);
    });
    return true;
  }

  if (p === '/api/db/insert' && req.method === 'POST') {
    readJson(req, (body) => {
      const stmt = 'INSERT INTO snippets (title, content, created, expires) ' +
                   'VALUES(?, ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))';
      const result = db.runSQL(stmt, [body.title, body.content, Number(body.days)], 'params');
      if (result.ok) db.app.infoLog.Printf('inserted snippet: %s', body.title);
      else db.app.errorLog.Printf('insert failed: %s', result.error);
      json(res, result);
    });
    return true;
  }

  if (p === '/api/db/transaction' && req.method === 'POST') {
    const result = db.runTransaction();
    if (!result.committed) db.app.errorLog.Printf('transaction rolled back: %s', result.error);
    return json(res, result);
  }

  // Section 4.6: snippetCreate() inserts a hard-coded snippet and redirects
  // to it with 303 See Other, so curl -iL follows straight to the view.
  if (p === '/snippet/create' && req.method === 'POST') {
    req.resume();
    const title = 'O snail';
    const content = 'O snail\nClimb Mount Fuji,\nBut slowly, slowly!\n\n– Kobayashi Issa';
    const [id, err] = db.model.Insert(title, content, 7);
    if (err) {
      app.serverError(res, err);
      return true;
    }
    db.app.infoLog.Printf('inserted snippet: %s (id=%d, expires in 7 days)', title, id);
    res.writeHead(303, { 'Location': `/snippet/view?id=${id}`, 'Content-Length': 0 });
    res.end();
    return true;
  }

  // The %+v dumps from pages 113 and 120.
  if (p === '/snippet/view') {
    const raw = url.searchParams.get('id');
    const id = Number(raw);
    if (!raw || !/^\d+$/.test(raw) || id < 1) {
      if (db.app) db.app.notFound(res);
      return true;
    }
    const body = snippetView(db, id);
    if (body === null) {
      if (db.app) db.app.notFound(res);
      return true;
    }
    return text(res, body);
  }

  if (p === '/snippets') {
    return text(res, snippetsDump(db));
  }

  return false;
}

/* ------------------------------------------------------------------ helpers */

function readJson(req, cb) {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1e5) req.destroy(); });
  req.on('end', () => {
    try { cb(JSON.parse(raw || '{}')); } catch (e) { cb({}); }
  });
}

function json(res, obj) {
  const buf = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}

function text(res, body) {
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}

function send(res, body) {
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}

module.exports = { handle, formatPlusV };
