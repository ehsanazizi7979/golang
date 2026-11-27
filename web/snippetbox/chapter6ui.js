'use strict';

/*
 * HTML for the chapter-6 demo pages. Kept in its own module so the Go-style
 * snippets and the trace markup stay readable in a real .js file.
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
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eef2f4;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#7b8b93}
.tag{display:inline-block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:1px 8px;border-radius:999px;border:1px solid}
.tag.ok{color:#2f8f4e;border-color:#bfe3cb;background:#f2faf4}
.tag.bad{color:#b3382c;border-color:#eec5bf;background:#fdf3f2}
.tag.down{color:#2f6f9f;border-color:#bcd8ea;background:#f2f8fc}
.muted{color:#7b8b93;font-size:13px}
.chain{font-family:var(--mono);font-size:13px;background:#fff;border:1px solid #e4e9ed;border-radius:8px;
padding:14px 16px;margin-bottom:12px;overflow:auto;white-space:nowrap}
.chain b{color:#2f8f4e}
`;

function layout(active, title, body, script) {
  const link = (href, label) =>
    `<a href="${href}"${active === href ? ' class="on"' : ''}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Snippetbox</title><style>${CSS}</style></head><body>
<header><div class="wrap">
  <h1>Middleware <small>Let's Go, chapter 6 — the chain, executed link by link</small></h1>
  <nav>
    ${link('/middleware', 'The chain')}
    ${link('/middleware/panic', 'Panic recovery')}
    ${link('/middleware/alice', 'alice')}
    ${link('/newsnippets', 'Templates')}
    ${link('/logs', 'Logs')}
    ${link('/summary', 'Summary')}
  </nav>
</div></header>
<main><div class="wrap">${body}</div></main>
${script ? `<script>${script}</script>` : ''}
</body></html>`;
}

/* ---------------------------------------------------------------- the index */

function indexPage(recent) {
  const body = `
<h2>How middleware works <span class="muted">— sections 6.1–6.5</span></h2>
<div class="card">
  <p>A middleware is a function that takes the next handler and returns a new one. Position decides reach:
     before the servemux it runs on every request; after it, only on the route it wraps.</p>
  <div class="chain"><b>recoverPanic</b> → <b>logRequest</b> → <b>secureHeaders</b> → servemux → application handler</div>
  <p>That is <code>alice.New(app.recoverPanic, app.logRequest, secureHeaders).Then(mux)</code> — the first
     argument is the outermost layer, so <code>recoverPanic</code> covers everything inside it.</p>
</div>

<div class="card">
  <p><b>Run the chain</b> and watch every link report itself on the way down and back up. The headers below are
     set by <code>secureHeaders()</code> against a real response object.</p>
  <div class="row">
    <button class="btn btn--green" id="runChain">Execute the chain</button>
    <a class="btn" href="/newsnippets" target="_blank" rel="noopener">A real page through it ↗</a>
  </div>
  <p class="muted" style="margin:12px 0 6px">execution order</p>
  <pre id="chainOut">press Execute</pre>
  <p class="muted" style="margin:12px 0 6px">response headers</p>
  <pre class="light" id="headerOut">—</pre>
</div>

<div class="card">
  <p><b>Flow of control runs both ways.</b> Code before <code>next.ServeHTTP()</code> executes on the way down;
     code after it — or in a deferred function — executes on the way back up, in reverse order.</p>
  <pre class="light">recoverPanic → logRequest → secureHeaders → servemux → application handler
              ←            ←               ←          ← (returning)</pre>
</div>

<div class="card">
  <p><b>Check the headers on any page.</b> Every response from this server now carries the five OWASP
     headers, including the template pages from chapter 5:</p>
  <pre class="light">$ curl -I http://localhost:3000/newsnippets
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; style-src 'self' fonts.googleapis.com; font-src fonts.gstatic.com
Referrer-Policy: origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: deny
X-Xss-Protection: 0</pre>
</div>

<div class="card">
  <p><b>And the log line from 6.3</b>, written by <code>logRequest()</code> through
     <code>app.infoLog</code> — see the <a href="/logs">live log</a>:</p>
  <pre class="light">INFO  2022/02/06 09:08:31 127.0.0.1:45988 - HTTP/1.1 GET /
INFO  2022/02/06 09:08:31 127.0.0.1:45988 - HTTP/1.1 GET /static/css/main.css</pre>
</div>`;

  const script = `
(function(){
  function show(el, txt){ document.getElementById(el).textContent = txt; }
  document.getElementById('runChain').addEventListener('click', function(){
    var btn = this; btn.disabled = true;
    fetch('/api/mw/trace', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var depth = { recoverPanic: 0, logRequest: 1, servemux: 2, 'application handler': 3 };
        var lines = d.events.map(function(e){
          var pad = new Array((depth[e.mw] || 0) + 1).join('  ');
          var arrow = e.phase === 'down' || e.phase === 'in' ? '↓' : '↑';
          return pad + arrow + ' ' + e.mw + ' (' + e.phase + ')';
        });
        lines.push('');
        lines.push('architecture: ' + d.architecture);
        show('chainOut', lines.join('\\n'));
        show('headerOut', Object.keys(d.headers).map(function(k){ return k + ': ' + d.headers[k]; }).join('\\n'));
      })
      .catch(function(e){ show('chainOut', 'unreachable: ' + e); })
      .finally(function(){ btn.disabled = false; });
  });
})();`;

  return layout('/middleware', 'The chain', body, script);
}

/* --------------------------------------------------------------- panic page */

function panicPage() {
  const body = `
<h2>Panic recovery <span class="muted">— section 6.4</span></h2>
<div class="card">
  <p>Go's HTTP server isolates a panic to the goroutine serving that request: it logs a stack trace, unwinds
     the goroutine and closes the connection — the server survives, but the user gets
     <code>curl: (52) Empty reply from server</code>. <code>recoverPanic()</code> turns that into a proper 500.</p>
  <div class="row">
    <button class="btn btn--red" id="runPanic">panic("oops! something went wrong")</button>
  </div>
  <pre id="panicOut">press the button</pre>
</div>
<div class="card">
  <p><b>Why it works.</b> A deferred function always runs while the stack unwinds, so
     <code>defer func(){ if err := recover(); err != nil { … } }()</code> catches the panic. Two details from
     page 175: <code>Connection: close</code> makes Go close the connection after the response, and the value
     from <code>recover()</code> has type <code>any</code> — a string, an error, or anything else — so the book
     normalises it with <code>fmt.Errorf("%s", err)</code> before passing it to <code>serverError()</code>.</p>
</div>
<div class="card">
  <p><b>Panics in other goroutines are not covered.</b> The middleware only recovers in its own goroutine. Spin
     up a background goroutine and a panic there brings down the whole process — you must recover inside it too.
     Try both:</p>
  <div class="row">
    <button class="btn" id="goroutineBare">goroutine, no recover</button>
    <button class="btn btn--green" id="goroutineRecover">goroutine with defer recover</button>
  </div>
  <pre class="light" id="goroutineOut">—</pre>
</div>`;

  const script = `
(function(){
  function show(el, t){ document.getElementById(el).textContent = t; }
  document.getElementById('runPanic').addEventListener('click', function(){
    var btn = this; btn.disabled = true;
    fetch('/api/mw/panic', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(d){
      var a = d.recovered, b = d.bare;
      var lines = [];
      lines.push('--- without recoverPanic() ---');
      lines.push('status: ' + (b.status === 0 ? 'none — ' + b.body : b.status));
      lines.push('events: ' + (b.events.length ? b.events.map(function(e){return e.mw;}).join(' -> ') : '(none: the panic unwound the goroutine)'));
      lines.push('');
      lines.push('--- with recoverPanic() ---');
      lines.push('status: ' + a.status + ' ' + a.body);
      if (a.connection) lines.push('Connection: ' + a.connection);
      lines.push('events: ' + a.events.map(function(e){ return e.mw + '(' + e.phase + ')'; }).join(' -> '));
      lines.push('');
      lines.push('headers on the 500:');
      Object.keys(a.headers).forEach(function(k){ lines.push('  ' + k + ': ' + a.headers[k]); });
      show('panicOut', lines.join('\\n'));
    }).catch(function(e){ show('panicOut', 'unreachable: ' + e); })
      .finally(function(){ btn.disabled = false; });
  });
  document.getElementById('goroutineBare').addEventListener('click', function(){
    show('goroutineOut',
      'go func() { panic("oops") }()   // no defer/recover\\n\\n' +
      'A panic in a second goroutine is not recovered by recoverPanic()\\n' +
      'and not by the server either: the whole process exits and the\\n' +
      'server goes down. This is why the book warns you to recover\\n' +
      'inside any goroutine you start yourself.');
  });
  document.getElementById('goroutineRecover').addEventListener('click', function(){
    show('goroutineOut',
      'go func() {\\n' +
      '    defer func() {\\n' +
      '        if err := recover(); err != nil {\\n' +
      '            log.Print(fmt.Errorf("%s\\\\n%s", err, debug.Stack()))\\n' +
      '        }\\n' +
      '    }()\\n' +
      '    doSomeBackgroundProcessing()\\n' +
      '}()\\n\\n' +
      'Now the panic is logged with a stack trace and the server\\n' +
      'keeps running — the goroutine alone is unwound.');
  });
})();`;

  return layout('/middleware/panic', 'Panic recovery', body, script);
}

/* --------------------------------------------------------------- alice page */

function alicePage() {
  const body = `
<h2>Composable middleware chains <span class="muted">— section 6.5</span></h2>
<div class="card">
  <p><code>justinas/alice</code> turns nesting into a list. It also lets you name a chain, append to it, and
     reuse it across routes.</p>
  <pre class="light">return myMiddleware1(myMiddleware2(myMiddleware3(myHandler)))

    becomes

return alice.New(myMiddleware1, myMiddleware2, myMiddleware3).Then(myHandler)</pre>
</div>
<div class="card">
  <p><b>Chains are values.</b> <code>Append</code> returns a new chain, so the original is untouched — which is
     what makes a "standard" chain plus per-route extras workable:</p>
  <pre class="light">standard := alice.New(app.recoverPanic, app.logRequest, secureHeaders)

// extra middleware for one group of routes only
protected := standard.Append(app.requireAuthentication)

mux.Handle("/", standard.Then(mux))</pre>
</div>
<div class="card">
  <p><b>Order is not symmetric.</b> <code>alice.New(a, b, c).Then(h)</code> is
     <code>a(b(c(h)))</code>: <code>a</code> is outermost, so it sees the request first and the response last.</p>
  <pre class="light">alice.New(recoverPanic, logRequest, secureHeaders).Then(mux)
  ==  recoverPanic(logRequest(secureHeaders(mux)))</pre>
  <p class="muted">Go module: <code>go get github.com/justinas/alice@v1</code> → <code>v1.2.0</code>, added to
     <code>go.mod</code> as <code>github.com/justinas/alice v1.2.0</code>.</p>
</div>`;
  return layout('/middleware/alice', 'alice', body);
}

module.exports = { indexPage, panicPage, alicePage };
