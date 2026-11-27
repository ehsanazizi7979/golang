'use strict';

/*
 * HTML and the staged form-processing pipeline for chapter 8.
 *
 * parseStages() runs one submission through every stage the chapter builds, and
 * reports what each stage contributed — ParseForm → Decode → CheckField ×4 →
 * Valid() → Insert/redirect. That is the whole chapter in one response.
 */

const forms = require('./forms');

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
font-size:12.5px;line-height:1.6;overflow:auto;max-height:460px;margin:0;white-space:pre-wrap;word-break:break-word}
pre.light{background:#fbfcfd;color:var(--ink);border:1px solid #e4e9ed}
code{font-family:var(--mono);font-size:13px;background:#eef2f4;padding:1px 5px;border-radius:3px}
.btn{display:inline-block;border:1px solid #dfe6ea;background:#fff;color:var(--ink);font:inherit;font-size:14px;
padding:8px 13px;border-radius:5px;cursor:pointer;text-decoration:none}
.btn:hover{border-color:#c9d4da}
.btn--green{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
textarea,input[type=text]{font-family:var(--mono);font-size:13px;padding:9px 11px;border:1px solid #dfe6ea;
border-radius:5px;background:#fbfcfd;width:100%}
textarea{min-height:70px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eef2f4;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#7b8b93}
.muted{color:#7b8b93;font-size:13px}
.tag{display:inline-block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:1px 8px;
border-radius:999px;border:1px solid}
.tag.ok{color:#2f8f4e;border-color:#bfe3cb;background:#f2faf4}
.tag.bad{color:#b3382c;border-color:#eec5bf;background:#fdf3f2}
`;

function layout(active, title, body, script) {
  const link = (href, label) => `<a href="${href}"${active === href ? ' class="on"' : ''}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Snippetbox</title><style>${CSS}</style></head><body>
<header><div class="wrap">
  <h1>Processing forms <small>Let's Go, chapter 8 — parse, decode, validate, redirect</small></h1>
  <nav>
    ${link('/forms', 'The pipeline')}
    ${link('/newsnippet/create', 'The real form')}
    ${link('/newsnippet', 'Snippets')}
    ${link('/router', 'Router')}
    ${link('/summary', 'Summary')}
  </nav>
</div></header>
<main><div class="wrap">${body}</div></main>
${script ? `<script>${script}</script>` : ''}
</body></html>`;
}

/* ---------------------------------------------------------- the stage report */

function parseStages(payload) {
  const title = String(payload.title === undefined ? '' : payload.title);
  const content = String(payload.content === undefined ? '' : payload.content);
  const expiresRaw = String(payload.expires === undefined ? '365' : payload.expires);

  const stages = [];
  const values = new forms.Values([
    { key: 'title', value: title },
    { key: 'content', value: content },
    { key: 'expires', value: expiresRaw },
  ]);
  stages.push({
    stage: '1. r.ParseForm()',
    ok: true,
    detail: `r.PostForm = ${JSON.stringify(values.toObject())}\n` +
            `url.Values, underlying type map[string][]string — note the slices.`,
  });

  const form = forms.newSnippetCreateForm();
  const decoder = forms.NewDecoder();
  let decodeOk = true;
  let decodeError = null;
  try {
    decoder.Decode(form, values);
  } catch (err) {
    decodeOk = false;
    decodeError = err.message;
  }
  stages.push({
    stage: '2. app.formDecoder.Decode(&form, r.PostForm)',
    ok: decodeOk,
    detail: decodeOk
      ? `form.Title   = ${JSON.stringify(form.Title)}\n` +
        `form.Content = ${JSON.stringify(form.Content)}\n` +
        `form.Expires = ${form.Expires}   (int — converted from ${JSON.stringify(expiresRaw)})`
      : `${decodeError}\n\n→ 400 Bad Request: the value will not convert to the field's type.`,
  });
  if (!decodeOk) return { ok: false, stages, outcome: '400 Bad Request (clientError)' };

  const checks = [
    ['validator.NotBlank(form.Title)', 'title', 'This field cannot be blank',
      forms.NotBlank(form.Title)],
    ['validator.MaxChars(form.Title, 100)', 'title', 'This field cannot be more than 100 characters long',
      forms.MaxChars(form.Title, 100)],
    ['validator.NotBlank(form.Content)', 'content', 'This field cannot be blank',
      forms.NotBlank(form.Content)],
    ['validator.PermittedInt(form.Expires, 1, 7, 365)', 'expires', 'This field must equal 1, 7 or 365',
      forms.PermittedInt(form.Expires, 1, 7, 365)],
  ];
  stages.push({
    stage: '3. CheckField() × 4',
    ok: checks.every((c) => c[3]),
    detail: checks.map(([call, key, msg, ok]) =>
      `${ok ? 'pass' : 'FAIL'}  ${call}${ok ? '' : `\n        → FieldErrors["${key}"] = "${msg}"`}`
    ).join('\n'),
  });
  forms.validate(form);

  stages.push({
    stage: '4. form.Valid()',
    ok: form.Valid(),
    detail: form.Valid()
      ? 'true — the FieldErrors map is empty, so continue.'
      : `false — FieldErrors = ${JSON.stringify(form.FieldErrors)}\n\n` +
        `→ app.render(w, http.StatusUnprocessableEntity, "create.tmpl", data)\n` +
        `  422 with the errors shown and the values re-populated.`,
  });

  if (!form.Valid()) {
    return {
      ok: true,
      stages,
      outcome: '422 Unprocessable Entity — form re-displayed',
      form: { Title: form.Title, Content: form.Content, Expires: form.Expires },
      fieldErrors: form.FieldErrors || {},
    };
  }

  stages.push({
    stage: '5. app.snippets.Insert(...)',
    ok: true,
    detail: `INSERT INTO snippets (title, content, created, expires)\n` +
            `  VALUES (?, ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${form.Expires} DAY))`,
  });
  stages.push({
    stage: '6. http.Redirect(..., http.StatusSeeOther)',
    ok: true,
    detail: '303 See Other → /newsnippet/view/:id\n\n' +
            'Post-Redirect-Get: the browser re-requests with a GET, so\n' +
            'refreshing cannot re-submit the form.',
  });
  return {
    ok: true,
    stages,
    outcome: '303 See Other — snippet created',
    form: { Title: form.Title, Content: form.Content, Expires: form.Expires },
  };
}


/* ------------------------------------------------------ r.Form vs r.PostForm */

/*
 * Section 8.2's "Additional information": the difference between the three ways
 * of reading a form, demonstrated on a real request.
 *
 *   r.PostForm   the body only, and only for POST/PATCH/PUT
 *   r.Form       the body *and* the query string, body winning on a conflict
 *   Get()        the first value of a multi-value key
 */
function rawReport(payload) {
  const query = String(payload.query || '');
  const body = String(payload.body || '');
  const limit = payload.limit ? Number(payload.limit) : 0;

  const lines = [];
  lines.push(`POST /dump?${query}`);
  lines.push(`Content-Type: application/x-www-form-urlencoded`);
  lines.push('');
  const shown = body.length > 120
    ? JSON.stringify(body.slice(0, 60)) + ` … ${body.length} bytes … ` + JSON.stringify(body.slice(-20))
    : JSON.stringify(body);
  lines.push('body: ' + shown);
  lines.push('');

  let post;
  try {
    post = limit
      ? forms.parseForm(body, 'application/x-www-form-urlencoded', limit)
      : forms.parseForm(body, 'application/x-www-form-urlencoded');
  } catch (err) {
    lines.push('r.ParseForm() -> ' + err.message);
    if (err instanceof forms.MaxBytesError) {
      lines.push('');
      lines.push('The body is larger than the limit, so ParseForm() returns an');
      lines.push('error and the handler answers 400. With http.MaxBytesReader the');
      lines.push('response also carries `Connection: close`, and the request body');
      lines.push('is drained as it is read, so a huge upload cannot tie up a worker.');
    }
    return { ok: false, text: lines.join('\n') };
  }

  // r.Form: the query string first, then the body over the top of it.
  const merged = new forms.Values([]);
  for (const pair of parseQueryPairs(query)) merged.map.set(pair.key, [pair.value]);
  for (const key of post.keys()) merged.map.set(key, post.getAll(key));

  const dump = (v) => {
    const keys = v.keys().sort();
    if (!keys.length) return '  (empty)';
    return keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(v.getAll(k))}`).join('\n');
  };

  lines.push('r.ParseForm() -> nil');
  lines.push('');
  lines.push('r.PostForm   (body only)');
  lines.push(dump(post));
  lines.push('');
  lines.push('r.Form       (query + body, body wins)');
  lines.push(dump(merged));
  lines.push('');

  const multi = post.keys().filter((k) => post.getAll(k).length > 1);
  if (multi.length) {
    for (const key of multi) {
      const all = post.getAll(key);
      lines.push(`r.PostForm[${JSON.stringify(key)}] holds ${all.length} values:`);
      all.forEach((v, i) => lines.push(`  [${i}] ${JSON.stringify(v)}`));
      lines.push(`r.PostForm.Get(${JSON.stringify(key)}) -> ${JSON.stringify(post.Get(key))}   (the first only)`);
      lines.push('');
    }
  }

  const onlyQuery = merged.keys().filter((k) => !post.has(k));
  if (onlyQuery.length) {
    lines.push(`${onlyQuery.join(', ')} came from the query string — visible in r.Form, absent from r.PostForm.`);
    lines.push('');
  }
  const both = post.keys().filter((k) => parseQueryPairs(query).some((p) => p.key === k));
  if (both.length) {
    lines.push(`For ${both.join(', ')} the body value replaced the query value in r.Form.`);
  }
  return { ok: true, text: lines.join('\n').replace(/\n+$/, '') };
}

function parseQueryPairs(query) {
  return String(query).split('&').filter(Boolean).map((chunk) => {
    const eq = chunk.indexOf('=');
    const key = eq === -1 ? chunk : chunk.slice(0, eq);
    const value = eq === -1 ? '' : chunk.slice(eq + 1);
    const dec = (s) => { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return s; } };
    return { key: dec(key), value: dec(value) };
  });
}

/* ---------------------------------------------------------------- the page */

function indexPage() {
  const body = `
<h2>Parse, decode, validate, redirect <span class="muted">— sections 8.2–8.6</span></h2>
<div class="card">
  <p>One submission, every stage the chapter builds. Change the values and watch which stage returns what — the
     answers come from the same functions the real form uses.</p>
  <div class="row">
    <button class="btn" data-fill="valid">valid</button>
    <button class="btn" data-fill="blank">blank title</button>
    <button class="btn" data-fill="long">title over 100 chars</button>
    <button class="btn" data-fill="expires">expires=abc</button>
    <button class="btn" data-fill="badint">expires=999</button>
    <button class="btn" data-fill="umlaut">Zoë (runes vs bytes)</button>
  </div>
  <div style="margin-bottom:10px"><span class="muted">title</span>
    <input type="text" id="fTitle" value="From time to time"></div>
  <div style="margin-bottom:10px"><span class="muted">content</span>
    <textarea id="fContent">From time to time
The clouds give rest
To the moon-beholders.</textarea></div>
  <div class="row"><span class="muted">expires</span>
    <input type="text" id="fExpires" value="7" style="max-width:120px">
    <button class="btn btn--green" id="runStages">Run the handler</button>
    <span class="muted" id="verdict"></span>
  </div>
  <pre id="stages">press Run the handler</pre>
</div>

<h2>What the parsing actually produces <span class="muted">— section 8.2</span></h2>
<div class="card">
  <p>A raw request, dumped the way <code>fmt.Printf("%+v", r.PostForm)</code> would. The query string and the body
     disagree on purpose, and <code>tags</code> appears twice so you can see a multi-value field.</p>
  <div style="margin-bottom:10px"><span class="muted">query string</span>
    <input type="text" id="rQuery" value="tags=go&amp;page=2&amp;title=from-the-query"></div>
  <div style="margin-bottom:10px"><span class="muted">request body</span>
    <textarea id="rBody" style="min-height:56px">title=From+the+body&amp;tags=web&amp;tags=http&amp;tags=forms</textarea></div>
  <div class="row"><span class="muted">MaxBytesReader limit (0 = off)</span>
    <input type="text" id="rLimit" value="0" style="max-width:100px">
    <button class="btn btn--green" id="runRaw">Send it</button></div>
  <pre id="rawOut">press Send it</pre>
</div>

<div class="card">
  <p><b>Why 422 and not 400?</b> The request was well-formed — it parsed and decoded fine. It is the <em>values</em>
     that are not acceptable, and 422 Unprocessable Entity says exactly that. A 400 is reserved for a body that will
     not parse, or a value that will not convert.</p>
</div>

<div class="card">
  <p><b>The other two maps.</b> <code>r.PostForm</code> holds only the request body, and only for POST, PATCH and
     PUT. <code>r.Form</code> holds the body <em>and</em> the query string, for any method, with the body winning on
     a conflict. The book uses <code>r.PostForm</code> because this form's data belongs in the body. And
     <code>FormValue()</code>/<code>PostFormValue()</code> are shortcuts that silently swallow
     <code>ParseForm()</code> errors — avoid them.</p>
  <p><b>Multiple-value fields.</b> <code>Get()</code> returns only the first value, so checkboxes need the map
     directly:</p>
  <pre class="light">for i, item := range r.PostForm["items"] {
    fmt.Fprintf(w, "%d: Item %s\\n", i, item)
}</pre>
  <p><b>Size limits.</b> Non-multipart bodies are capped at 10MB by default, and
     <code>http.MaxBytesReader(w, r.Body, 4096)</code> lowers it — exceeding the limit makes
     <code>ParseForm()</code> return an error, and sets a flag that closes the TCP connection.</p>
</div>`;

  const script = `
(function(){
  function fillKind(kind){
    var t = document.getElementById('fTitle');
    var c = document.getElementById('fContent');
    var e = document.getElementById('fExpires');
    if (kind === 'valid') { t.value = 'From time to time'; e.value = '7';
      c.value = 'From time to time\\nThe clouds give rest\\nTo the moon-beholders.'; }
    if (kind === 'blank') { t.value = ''; e.value = '365'; }
    if (kind === 'long') { t.value = new Array(102).join('a'); e.value = '365'; }
    if (kind === 'expires') { t.value = 'From time to time'; e.value = 'abc'; }
    if (kind === 'badint') { t.value = 'From time to time'; e.value = '999'; }
    if (kind === 'umlaut') { t.value = 'Zoë and the moon'; e.value = '1'; }
  }
  document.querySelectorAll('[data-fill]').forEach(function(b){
    b.addEventListener('click', function(){ fillKind(b.getAttribute('data-fill')); });
  });
  document.getElementById('runStages').addEventListener('click', function(){
    var btn = this; btn.disabled = true;
    fetch('/api/forms/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: document.getElementById('fTitle').value,
        content: document.getElementById('fContent').value,
        expires: document.getElementById('fExpires').value
      })
    }).then(function(r){ return r.json(); }).then(function(d){
      var lines = [];
      (d.stages || []).forEach(function(s){
        lines.push('[' + (s.ok ? 'ok  ' : 'FAIL') + '] ' + s.stage);
        String(s.detail).split('\\n').forEach(function(l){ lines.push('        ' + l); });
        lines.push('');
      });
      lines.push('-> ' + d.outcome);
      document.getElementById('stages').textContent = lines.join('\\n');
      var v = document.getElementById('verdict');
      v.textContent = d.outcome;
      v.style.color = /303/.test(d.outcome) ? '#2f8f4e' : '#b3382c';
    }).catch(function(e){
      document.getElementById('stages').textContent = 'unreachable: ' + e;
    }).finally(function(){ btn.disabled = false; });
  });
  document.getElementById('runRaw').addEventListener('click', function(){
    var btn = this; btn.disabled = true;
    fetch('/api/forms/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: document.getElementById('rQuery').value,
        body: document.getElementById('rBody').value,
        limit: document.getElementById('rLimit').value
      })
    }).then(function(r){ return r.json(); }).then(function(d){
      document.getElementById('rawOut').textContent = d.text;
    }).catch(function(e){
      document.getElementById('rawOut').textContent = 'unreachable: ' + e;
    }).finally(function(){ btn.disabled = false; });
  });
})();`;

  return layout('/forms', 'The pipeline', body, script);
}


/* --------------------------------------------------- the chapter-8 demo API */

/*
 * One endpoint for the button pad in the summary page. Each kind exercises a
 * different section, and the text it returns is what the page shows verbatim.
 */
function demo(payload) {
  const kind = String(payload.kind || '');

  if (kind === 'runes') {
    const text = String(payload.text === undefined ? '' : payload.text);
    const rule = payload.rule === 'bytes' ? 'bytes' : 'runes';
    const chars = [...text].length;
    const bytes = Buffer.byteLength(text, 'utf8');
    const byChars = chars <= 100;
    const byBytes = bytes <= 100;
    const passes = rule === 'bytes' ? byBytes : byChars;
    const lines = [
      'title = ' + JSON.stringify(text.length > 40 ? text.slice(0, 12) + '…' : text),
      '',
      'len(title)                    = ' + bytes + '   (bytes)',
      'utf8.RuneCountInString(title) = ' + chars + '   (characters)',
      '',
      'if utf8.RuneCountInString(title) > 100   -> ' + (byChars ? 'false — no error' : 'true  — error'),
      'if len(title) > 100                      -> ' + (byBytes ? 'false — no error' : 'true  — error'),
      '',
      'Checked with the rule the book uses:',
      '  validator.MaxChars(form.Title, 100)      ' +
        (rule === 'bytes' ? '  (rewritten as bytes <= 100)' : '  (runes <= 100)'),
    ];
    if (rule === 'bytes') {
      lines.push('  -> ' + (passes ? 'true' : 'false') + '  so the handler ' +
        (passes ? 'accepts' : 'answers 422 Unprocessable Entity'));
      lines.push('');
      lines.push('A bytes-based rule rejects this title. A runes-based rule');
      lines.push('accepts it, because it is exactly 100 characters — which is');
      lines.push('what the user sees and counts, and what the rule says.');
    } else {
      lines.push('  -> ' + (passes ? 'true' : 'false') + '  so the handler ' +
        (passes ? 'accepts and redirects 303' : 'answers 422 Unprocessable Entity'));
      lines.push('');
      lines.push('100 characters, but ' + bytes + ' bytes. Had the check been');
      lines.push('if len(title) > 100 this perfectly reasonable title would');
      lines.push('have been rejected for being too long when it is not.');
    }
    return {
      status: passes ? 303 : 422,
      label: passes ? 'accepted — 303 See Other' : 'rejected — 422 Unprocessable Entity',
      text: lines.join('\n'),
    };
  }

  if (kind === 'decode') {
    const values = new forms.Values([
      { key: 'title', value: String(payload.title || '') },
      { key: 'content', value: String(payload.content || '') },
      { key: 'expires', value: String(payload.expires || '') },
      { key: 'ignored', value: 'this key has no struct tag' },
    ]);
    const form = forms.newSnippetCreateForm();
    const lines = [
      'var form snippetCreateForm',
      'err := app.decodePostForm(r, &form)',
      '',
      'r.PostForm = ' + JSON.stringify(values.toObject()),
      '',
    ];
    try {
      forms.NewDecoder().Decode(form, values);
    } catch (err) {
      return { status: 400, label: '400 Bad Request', text: lines.concat(err.message).join('\n') };
    }
    lines.push('after Decode:');
    lines.push('  form.Title   = ' + JSON.stringify(form.Title) + '   (string)');
    lines.push('  form.Content = ' + JSON.stringify(form.Content) + '   (string)');
    lines.push('  form.Expires = ' + form.Expires + '   (int — converted from a string)');
    lines.push('  form.FieldErrors = ' + JSON.stringify(form.FieldErrors) + '   (form:\"-\" — skipped)');
    lines.push('');
    lines.push('Note "ignored": it has no form tag, so the decoder leaves the');
    lines.push('struct alone. Nothing errors on unexpected keys by default.');
    return { status: 200, label: 'decoded', text: lines.join('\n') };
  }

  if (kind === 'invalid') {
    const lines = [
      'var form snippetCreateForm',
      'err := app.formDecoder.Decode(42, r.PostForm)   // not a pointer',
      '',
    ];
    try {
      forms.NewDecoder().Decode(42, new forms.Values([]));
      lines.push('(no error — which would be the bug)');
      return { status: 200, label: 'no error', text: lines.join('\n') };
    } catch (err) {
      lines.push('err = ' + err.name + ': ' + err.message);
      lines.push('');
      lines.push('decodePostForm() checks the type with errors.As():');
      lines.push('    var invalidDecoderError *form.InvalidDecoderError');
      lines.push('    if errors.As(err, &invalidDecoderError) {');
      lines.push('        panic(err)');
      lines.push('    }');
      lines.push('');
      lines.push('panic: ' + err.message);
      lines.push('');
      lines.push('recoverPanic() (chapter 6) catches it, logs the stack, sets');
      lines.push('Connection: close and answers 500 Internal Server Error.');
      lines.push('The user sees nothing but a 500 — which is right, because');
      lines.push('they did nothing wrong: the application did.');
      return {
        status: 500,
        label: '500 Internal Server Error (recovered panic)',
        text: lines.join('\n'),
      };
    }
  }

  if (kind === 'multipart') {
    const boundary = '--------------------------' + '8a1f2c';
    const body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="title"',
      '',
      'Multipart titles work too',
      '--' + boundary,
      'Content-Disposition: form-data; name="content"',
      '',
      'The body is not urlencoded; each field is its own part.',
      '--' + boundary,
      'Content-Disposition: form-data; name="expires"',
      '',
      '1',
      '--' + boundary + '--',
      '',
    ].join('\r\n');
    const ctype = 'multipart/form-data; boundary=' + boundary;
    const lines = [
      'Content-Type: ' + ctype,
      '',
      'body:',
      body.split('\r\n').map((l) => '  ' + l).join('\n'),
      '',
    ];
    try {
      const values = forms.parseForm(body, ctype);
      const form = forms.newSnippetCreateForm();
      forms.NewDecoder().Decode(form, values);
      lines.push('r.ParseForm() -> nil');
      lines.push('r.PostForm = ' + JSON.stringify(values.toObject()));
      lines.push('');
      lines.push('form.Title   = ' + JSON.stringify(form.Title));
      lines.push('form.Content = ' + JSON.stringify(form.Content));
      lines.push('form.Expires = ' + form.Expires);
      lines.push('');
      lines.push('Same handler, same decoder. Only the parsing differs — and');
      lines.push('note that multipart bodies are NOT subject to the 10MB limit.');
      return { status: 200, label: 'multipart parsed', text: lines.join('\n') };
    } catch (err) {
      return { status: 400, label: '400 Bad Request', text: lines.concat(err.message).join('\n') };
    }
  }

  return { status: 400, label: 'unknown demo', text: 'unknown demo kind: ' + kind };
}

module.exports = { indexPage, parseStages, rawReport, demo };
