'use strict';

/*
 * HTML for the chapter-5 demo pages. Kept apart from chapter5.js so the
 * template snippets (which are full of {{ }}) are plain strings in a real .js
 * file rather than something a shell or a heredoc has to escape.
 */

const tpl = require('./template');

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
nav a:hover{color:#4ea61f;border-bottom-color:#4ea61f}
main{padding:26px 0 70px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#7b8b93;margin:28px 0 10px;font-weight:700}
h2:first-child{margin-top:0}
.card{background:#fff;border:1px solid #e4e9ed;border-radius:10px;padding:18px 20px;margin-bottom:16px}
.card p{margin:0 0 10px;color:var(--soft);font-size:14px}
pre{background:#283c46;color:#e8edf0;border-radius:8px;padding:14px 16px;font-family:var(--mono);
font-size:12.5px;line-height:1.6;overflow:auto;max-height:380px;margin:0;white-space:pre-wrap;word-break:break-word}
pre.light{background:#fbfcfd;color:var(--ink);border:1px solid #e4e9ed;max-height:520px}
code{font-family:var(--mono);font-size:13px;background:#eef2f4;padding:1px 5px;border-radius:3px}
.btn{display:inline-block;border:1px solid #dfe6ea;background:#fff;color:var(--ink);font:inherit;font-size:14px;
padding:8px 13px;border-radius:5px;cursor:pointer;text-decoration:none}
.btn:hover{border-color:#c9d4da}
.btn--green{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}
.btn--red{background:#b3382c;border-color:#b3382c;color:#fff;font-weight:600}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
textarea{font-family:var(--mono);font-size:12.5px;line-height:1.6;width:100%;min-height:190px;
padding:12px;border:1px solid #dfe6ea;border-radius:6px;background:#fbfcfd;resize:vertical}
input[type=text]{width:100%;font-family:var(--mono);font-size:12.5px;padding:10px 12px;
border:1px solid #dfe6ea;border-radius:6px;background:#fbfcfd}
.tag{display:inline-block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:1px 8px;border-radius:999px;border:1px solid}
.tag.ok{color:#2f8f4e;border-color:#bfe3cb;background:#f2faf4}
.tag.bad{color:#b3382c;border-color:#eec5bf;background:#fdf3f2}
.muted{color:#7b8b93;font-size:13px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:820px){.split{grid-template-columns:1fr}}
`;

function layout(active, title, body, script) {
  const link = (href, label) =>
    `<a href="${href}"${active === href ? ' class="on" style="color:#4ea61f;border-bottom-color:#4ea61f"' : ''}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Snippetbox</title><style>${CSS}</style></head><body>
<header><div class="wrap">
  <h1>Dynamic HTML templates <small>Let's Go, chapter 5 — the real .tmpl files, rendered live</small></h1>
  <nav>
    ${link('/newsnippets', 'Snippetbox home')}
    ${link('/newsnippets/view?id=1', 'Snippet view')}
    ${link('/tplx', 'Playground')}
    ${link('/tplx/escape', 'Escaping')}
    ${link('/tplx/error', 'Runtime error')}
    ${link('/db', 'Chapter 4')}
    ${link('/summary', 'Summary')}
  </nav>
</div></header>
<main><div class="wrap">${body}</div></main>
${script ? `<script>${script}</script>` : ''}
</body></html>`;
}

/* ------------------------------------------------------- the playground page */

function defaultTemplate() {
  return [
    '<h2>Latest snippets</h2>',
    '{{if .Snippets}}',
    '  <table>',
    '    <tr><th>Title</th><th>Created</th><th>ID</th></tr>',
    '    {{range .Snippets}}',
    '    <tr>',
    "      <td><a href='/snippet/view?id={{.ID}}'>{{.Title}}</a></td>",
    '      <td>{{humanDate .Created}}</td>',
    '      <td>#{{.ID}}</td>',
    '    </tr>',
    '    {{end}}',
    '  </table>',
    '{{else}}',
    '  <p>There is nothing to see here... yet!</p>',
    '{{end}}',
  ].join('\n');
}

function defaultData() {
  return JSON.stringify({
    Snippets: [
      { ID: 4, Title: 'O snail', Created: '2022-04-05T07:32:45Z' },
      { ID: 1, Title: 'An old silent pond', Created: '2022-04-05T07:20:05Z' },
    ],
    Snippet: { ID: 1, Title: 'An old silent pond', Content: 'An old silent pond...', Created: '2022-04-05T07:20:05Z' },
    Title: 'A <b>bold</b> title',
    Empty: [],
    Foo: 1,
    Bar: 20,
  }, null, 2);
}

function playground(source, result) {
  const presets = [
    ['with', '{{with .Snippet}}\n  <strong>{{.Title}}</strong> (#{{.ID}})\n{{else}}\n  no snippet\n{{end}}'],
    ['if / else', '{{if .Snippets}}\n  {{len .Snippets}} snippets\n{{else}}\n  nothing yet\n{{end}}'],
    ['range', '{{range .Snippets}}<li>{{.Title}} — {{humanDate .Created}}</li>\n{{end}}'],
    ['variables + printf', '{{$n := len .Snippets}}\n{{printf "%s: %d rows" "Latest" $n}}'],
    ['functions', '{{if (and (eq .Foo 1) (le .Bar 20))}}both conditions hold{{end}}\n{{or .Missing .Title}}'],
    ['escaping', '<span>{{.Title}}</span>\n<a href="/snippet/view?id={{.Title}}">link</a>'],
    ['break / continue', '{{range .Snippets}}\n  {{if eq .ID 4}}{{continue}}{{end}}\n  <li>{{.ID}}</div>\n{{end}}'],
    ['deliberate error', '{{len nil}}'],
  ];
  const presetButtons = presets.map(([label, src], i) =>
    `<button class="btn" data-preset="${i}">${label}</button>`).join('');

  const body = `
<h2>Template actions and functions <span class="muted">— sections 5.2 and 5.6</span></h2>
<div class="card">
  <p>Edit the template on the left and the data on the right, then run it. The engine is the
     same one the Snippetbox pages use: <code>{{if}}</code>, <code>{{with}}</code>,
     <code>{{range}}</code>, <code>{{break}}</code>/<code>{{continue}}</code>, pipes,
     template variables, the built-in functions, and <code>humanDate</code> from section 5.6.</p>
  <div class="row">${presetButtons}</div>
  <div class="split">
    <div>
      <p style="margin:0 0 6px"><b>template</b></p>
      <textarea id="tplSrc" spellcheck="false">${escapeAttr(source)}</textarea>
    </div>
    <div>
      <p style="margin:0 0 6px"><b>data</b> <span class="muted">(the dot, as JSON)</span></p>
      <textarea id="tplData" spellcheck="false">${escapeAttr(defaultData())}</textarea>
    </div>
  </div>
  <div class="row" style="margin-top:12px">
    <button class="btn btn--green" id="runTpl">Execute</button>
    <span class="muted" id="tplStatus"></span>
  </div>
  <p style="margin:12px 0 6px"><b>output</b> <span class="muted">— escaped HTML, exactly as the browser receives it</span></p>
  <pre class="light" id="tplOut">press Execute</pre>
</div>
<div class="card">
  <p><b>Two things to notice.</b> <code>{{if}}</code>, <code>{{with}}</code> and
     <code>{{range}}</code> all change what dot means inside their block — <code>{{with .Snippet}}</code>
     makes dot the snippet, so you write <code>{{.Title}}</code> rather than
     <code>{{.Snippet.Title}}</code>. And <code>{{range}}</code> has an <code>{{else}}</code> branch
     for the empty case, which is what renders “There's nothing to see here... yet!”.</p>
</div>`;

  const script = `
(function(){
  var presets = ${JSON.stringify(presets.map(([l, s]) => ({ label: l, source: s })))};
  var src = document.getElementById('tplSrc');
  var data = document.getElementById('tplData');
  var out = document.getElementById('tplOut');
  var status = document.getElementById('tplStatus');

  function run(){
    status.textContent = 'executing…';
    fetch('/api/tplx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src.value, data: data.value })
    }).then(function(r){ return r.json(); }).then(function(r){
      out.textContent = r.ok ? r.html : 'ERROR\\n\\n' + r.error;
      status.textContent = r.ok ? 'ok' : 'template error';
      status.style.color = r.ok ? '#2f8f4e' : '#b3382c';
    }).catch(function(e){ out.textContent = String(e); status.textContent = 'unreachable'; });
  }
  document.getElementById('runTpl').addEventListener('click', run);
  document.querySelectorAll('[data-preset]').forEach(function(b){
    b.addEventListener('click', function(){
      var p = presets[Number(b.getAttribute('data-preset'))];
      src.value = p.source;
      run();
    });
  });
})();`;

  return layout('/tplx', 'Template playground', body, script);
}

/* --------------------------------------------------------- the escaping page */

function escapingPage(payload) {
  const safe = escapeAttr(payload);
  const src = `<span>{{\`${payload}\`}}</span>`;
  let engineOut;
  try {
    const ts = tpl.New('escape').Funcs({});
    ts.templates.set('main', {
      nodes: [{ kind: 'action', text: '`' + payload + '`', line: 1, column: 1 }],
    });
    engineOut = ts.ExecuteTemplate('main', {});
  } catch (e) {
    engineOut = String(e.message);
  }
  // text/template equivalent: raw interpolation, no escaping.
  const raw = `<span>${payload}</span>`;

  const body = `
<h2>Dynamic content escaping <span class="muted">— section 5.1, “Additional information”</span></h2>
<div class="card">
  <p>The <code>html/template</code> package escapes anything yielded between
     <code>{{ }}</code> tags. That is the single biggest reason to use it instead of
     <code>text/template</code> — and why this page can safely show you the attack.</p>
  <form method="get" action="/tplx/escape">
    <p style="margin:0 0 8px"><b>the value yielded by <code>{{ }}</code></b></p>
    <div class="row"><input type="text" name="payload" value="${safe}">
      <button class="btn btn--green" type="submit">Render it</button></div>
  </form>
</div>
<div class="split">
  <div class="card">
    <p><b>text/template</b> — no escaping. The script runs.</p>
    <div id="unsafeBox" style="border:1px dashed #eec5bf;border-radius:6px;padding:12px">${raw}</div>
    <p class="muted" style="margin-top:10px">Raw markup: <code>${safe}</code></p>
  </div>
  <div class="card">
    <p><b>html/template</b> — escaped. It renders as text.</p>
    <div style="border:1px dashed #bfe3cb;border-radius:6px;padding:12px">${engineOut}</div>
    <p class="muted" style="margin-top:10px">What the source contains: <code>${escapeAttr(engineOut)}</code></p>
  </div>
</div>
<div class="card">
  <p><b>Escaping is context-dependent.</b> Go analyses the template at parse time and picks the
     escaper for where the value lands — HTML text, an HTML attribute, JavaScript,
     CSS, or a URI. The same value is escaped five different ways:</p>
  <pre class="light">${escapeAttr(contextTable(payload))}</pre>
</div>
<div class="card">
  <p><b>Two more rules worth remembering.</b> <code>html/template</code> strips
     <em>all</em> HTML comments, including conditional comments, because it cannot model how a
     browser would interpret them. And when you invoke a template you must pipeline dot
     explicitly: <code>{{template "main" .}}</code>, not <code>{{template "main"}}</code>.</p>
</div>`;
  return layout('/tplx/escape', 'Escaping', body);
}

function contextTable(payload) {
  const rows = [
    ['HTML text', '{{ . }}', tpl.escapeHTMLText(payload)],
    ['attribute', '<a title="{{ . }}">', escapeAttr(payload)],
    ['URI', '<a href="/s?q={{ . }}">', encodeURI(payload).replace(/'/g, '%27')],
    ['JavaScript', '<script>var x = "{{ . }}"</script>',
      JSON.stringify(payload).slice(1, -1).replace(/</g, '\\u003c')],
  ];
  const width = Math.max(...rows.map((r) => r[0].length));
  return rows.map(([ctx, where, out]) =>
    `${ctx.padEnd(width)}  ${where.padEnd(34)} =>  ${out}`).join('\n');
}

/* ------------------------------------------------- the runtime-error page */

function errorPage(failure, halfWritten, chunkCount) {
  const body = `
<h2>Catching runtime errors <span class="muted">— section 5.4</span></h2>
<div class="card">
  <p>Add <code>{{len nil}}</code> to a template and nothing fails at parse time — the error only
     appears when that line executes. A single-stage <code>render()</code> would already have written
     <code>200 OK</code> and half a page before it noticed. The fix is to render into a buffer first.</p>
</div>
<div class="split">
  <div class="card">
    <p><b>One-stage render</b> — status already sent, body truncated:</p>
    <pre class="light">${escapeAttr(halfWritten.slice(0, 700) || '(nothing written)')}</pre>
    <p class="muted">The browser receives <code>200 OK</code> plus a half-complete page — the bug the
       book shows on page 150. ${chunkCount || 0} chunks were written before the error.</p>
  </div>
  <div class="card">
    <p><b>Two-stage render</b> — the error is caught, the user gets a clean 500:</p>
    <pre class="light">${failure
      ? `HTTP/1.1 500 Internal Server Error\nContent-Type: text/plain; charset=utf-8\nX-Content-Type-Options: nosniff\n\nInternal Server Error`
      : 'no error raised'}

${failure ? 'terminal:\nERROR  handlers.go:…: ' + escapeAttr(failure.message) : ''}</pre>
    <p class="muted">Nothing of the buffer is written to the response — <code>buf.WriteTo(w)</code>
       never runs.</p>
  </div>
</div>
<div class="card">
  <p><b>The error, as Go reports it:</b> the template name, the line and column inside it, the
     action being executed, and the reason.</p>
  <pre>${failure ? escapeAttr(failure.message) : 'no error raised'}</pre>
</div>
<div class="card">
  <p><b>Why <code>{{len nil}}</code> is a runtime error.</b> In Go, <code>nil</code> has no length,
     but the template still parses — function arguments are only typed when the command executes.
     A missing template, by contrast, fails at parse time, which is why the book's
     <code>newTemplateCache()</code> returns an error and <code>main()</code> calls
     <code>errorLog.Fatal()</code>.</p>
</div>`;
  return layout('/tplx/error', 'Runtime errors', body);
}

/* ------------------------------------------------------------- the sandbox */

function runSandbox(source, data) {
  try {
    const ts = tpl.New('sandbox').Funcs(humanDateFunc());
    ts.parseInline(source, '__src__');
    const html = ts.ExecuteTemplate('__src__', data);
    return { ok: true, html };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function humanDateFunc() {
  return {
    humanDate: (t) => {
      if (!t) return '';
      const d = t instanceof Date ? t : new Date(t);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} at ` +
             `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    },
  };
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  playground,
  escapingPage,
  errorPage,
  defaultTemplate,
  defaultData,
  runSandbox,
  layout,
};
