'use strict';

/*
 * Chapter 5 of "Let's Go": dynamic HTML templates — the application layer.
 *
 *   cmd/web/templates.go   templateData, newTemplateCache(), humanDate()
 *   cmd/web/helpers.go     render() written to a buffer, newTemplateData()
 *   ui/html/pages/*.tmpl   the real page templates on disk
 *
 * The demo pages added here are:
 *
 *   /newsnippets  the home page and view page rendered from the .tmpl files
 *                 with the in-memory snippets from chapter 4
 *   /tplx         the action/function playground: edit a template, run it
 *   /tplx/error   the two-stage render, with the deliberate {{len nil}} error
 *
 * The HTML for those pages is in chapter5ui.js so that no Go-template braces
 * pass through a heredoc.
 */

const fs = require('fs');
const path = require('path');

const tpl = require('./template');
const models = require('./models');
const chapter5ui = require('./chapter5ui');

const UI_ROOT = path.join(__dirname, 'ui', 'html');

/* --------------------------------------------------------------- templateData
 *
 * 5.1/5.2/5.5: one holding structure for everything a page needs. Go allows
 * exactly one piece of dynamic data, so it is always this struct.
 */

function templateData(extra) {
  return Object.assign({
    CurrentYear: new Date().getFullYear(),
    Snippet: null,
    Snippets: null,
  }, extra || {});
}

/* ------------------------------------------------- 5.6 custom template funcs */

// humanDate: t.Format("02 Jan 2006 at 15:04")
function humanDate(t) {
  if (!t) return '';
  // The templates hold Go-like time.Time values; unwrap to the Date inside.
  const d = t instanceof Date ? t
    : (t && t.__goType === 'time' ? t.date : new Date(t));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} at ` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const functions = {
  humanDate,
};

/* ------------------------------------------------------ 5.3 template cache */

/*
 * newTemplateCache() in Go:
 *
 *   pages, _ := filepath.Glob("./ui/html/pages/*.tmpl")
 *   for _, page := range pages {
 *       ts := template.New(name).Funcs(functions).ParseFiles("./ui/html/base.tmpl")
 *       ts, _ = ts.ParseGlob("./ui/html/partials/*.tmpl")
 *       ts, _ = ts.ParseFiles(page)
 *       cache[name] = ts
 *   }
 */
function newTemplateCache(root, broken) {
  const cache = new Map();
  const pages = tpl.glob('pages/*.tmpl', root);
  for (const page of pages) {
    const name = path.basename(page);
    if (broken && name === 'home.tmpl' && broken.kind === 'parse') {
      // A parse-time error aborts start-up in Go (errorLog.Fatal). Here it is
      // reported by the page that asked for it.
      const err = new Error(`${name}: unclosed action`);
      err.templateName = name;
      throw err;
    }
    const ts = tpl.New(name).Funcs(functions);
    ts.ParseFiles(path.join(root, 'base.tmpl'));
    for (const partial of tpl.glob('partials/*.tmpl', root)) {
      ts.ParseFiles(path.join(root, partial));
    }
    ts.ParseFiles(path.join(root, page));
    cache.set(name, ts);
  }
  return cache;
}

/* ------------------------------------------------------- 5.4/5.5 the render */

/*
 * render() writes the template to a bytes.Buffer first. If execution fails the
 * user gets a clean 500 and never sees a half-written 200 OK page — the bug the
 * book demonstrates on page 150.
 */
function render(app, res, status, page, data, cache) {
  const ts = cache.get(page);
  if (!ts) {
    app.serverError(res, new Error(`the template ${page} does not exist`));
    return;
  }
  const chunks = [];
  const sink = { write: (s) => { chunks.push(s); return s.length; } };
  try {
    ts.ExecuteTemplate(sink, 'base', data);
  } catch (err) {
    // The two-stage render pays off exactly here.
    app.serverError(res, err);
    return;
  }
  const body = Buffer.from(chunks.join(''), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
  });
  res.end(body);
}

/* ----------------------------------------------------- snippet formatting */

// Go's time.Time String(): 2022-04-05 07:20:05 +0000 UTC
function goTimeString(d) {
  const iso = new Date(d).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} +0000 UTC`;
}

function decorate(snippet) {
  if (!snippet) return null;
  return {
    ID: snippet.id,
    Title: snippet.title,
    Content: snippet.content,
    Created: { __goType: 'time', date: snippet.created, String: () => goTimeString(snippet.created) },
    Expires: { __goType: 'time', date: snippet.expires, String: () => goTimeString(snippet.expires) },
  };
}

/* ------------------------------------------------------------- the pages */

function homePage(app, res, db) {
  const [rows, err] = db.model.Latest();
  if (err) {
    app.serverError(res, err);
    return true;
  }
  const data = templateData({ Snippets: rows.map(decorate) });
  render(app, res, 200, 'home.tmpl', data, currentCache(app));
  return true;
}

function viewPage(app, res, db, id) {
  const [row, err] = db.model.Get(id);
  if (err) {
    if (err === models.ErrNoRecord) app.notFound(res);
    else app.serverError(res, err);
    return true;
  }
  const data = templateData({ Snippet: decorate(row) });
  render(app, res, 200, 'view.tmpl', data, currentCache(app));
  return true;
}

function currentCache(app) {
  if (!app.templateCache) app.templateCache = newTemplateCache(UI_ROOT, app.tplBroken);
  return app.templateCache;
}

/* The template from page 149: home.tmpl with {{len nil}} added, which is a
 * runtime error because nil has no length in Go. */
const BROKEN_HOME = [
  '{{define "title"}}Home{{end}}',
  '',
  '{{define "main"}}',
  '    <h2>Latest Snippets</h2>',
  '    {{len nil}} <!-- Deliberate error -->',
  '    <p>There are no snippets to show.</p>',
  '{{end}}',
].join('\n');

/* --------------------------------------------------------------- dispatcher */

function handle(req, res, url, app, db) {
  const p = url.pathname;

  // 5.1-5.6: the real templates, rendered through the cache.
  if (p === '/newsnippets') return homePage(app, res, db);
  if (p === '/newsnippets/view') {
    const raw = url.searchParams.get('id');
    if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1) {
      app.notFound(res);
      return true;
    }
    return viewPage(app, res, db, Number(raw));
  }

  // 5.2: actions and functions playground.
  if (p === '/tplx') {
    const body = chapter5ui.playground(chapter5ui.defaultTemplate(), null);
    send(res, 200, body);
    return true;
  }
  // 5.4: the deliberate runtime error, page 149's {{len nil}} in home.tmpl.
  if (p === '/tplx/error') {
    const ts = tpl.New('home.tmpl').Funcs(functions);
    ts.ParseFiles(path.join(UI_ROOT, 'base.tmpl'));
    for (const partial of tpl.glob('partials/*.tmpl', UI_ROOT)) {
      ts.ParseFiles(path.join(UI_ROOT, partial));
    }
    // home.tmpl with the deliberate error added, exactly as on page 149.
    ts.parseInline(BROKEN_HOME, 'home.tmpl');

    // One-stage render: everything the template managed to write is already
    // on its way to the user when the error happens.
    ts.Streaming(true);
    const chunks = [];
    const sink = { write: (s2) => { chunks.push(s2); } };
    let failure = null;
    try {
      ts.ExecuteTemplate(sink, 'base', templateData({ Snippets: [] }));
    } catch (err) {
      failure = err;
    }
    send(res, 200, chapter5ui.errorPage(failure, chunks.join(''), chunks.length));
    return true;
  }

  if (p === '/tplx/escape') {
    const payload = url.searchParams.get('payload') || "<script>alert('xss attack')</script>";
    const body = chapter5ui.escapingPage(payload);
    send(res, 200, body);
    return true;
  }

  if (p === '/api/tplx' && req.method === 'POST') {
    readJson(req, (payload) => {
      const source = String(payload.source || '');
      const json = String(payload.data || '{}');
      let data;
      try {
        data = JSON.parse(json);
      } catch (e) {
        return jsonSend(res, { ok: false, error: 'invalid JSON in the data box: ' + e.message });
      }
      const result = chapter5ui.runSandbox(source, data);
      jsonSend(res, result);
    });
    return true;
  }

  return false;
}

/* ------------------------------------------------------------------ helpers */

function send(res, status, body) {
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}

function jsonSend(res, obj) {
  const buf = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}

function readJson(req, cb) {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 2e5) req.destroy(); });
  req.on('end', () => {
    try { cb(JSON.parse(raw || '{}')); } catch (e) { cb({}); }
  });
}

module.exports = {
  handle,
  newTemplateCache,
  templateData,
  humanDate,
  render,
  decorate,
  functions,
  UI_ROOT,
};
