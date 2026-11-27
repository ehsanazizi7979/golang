'use strict';

/*
 * Chapter 8 of "Let's Go": processing forms.
 *
 *   GET  /newsnippet/create    snippetCreate()     — the form, expires defaulting to 365
 *   POST /newsnippet/create    snippetCreatePost() — parse, decode, validate, insert, redirect
 *
 * The workflow is the book's Post-Redirect-Get cycle:
 *
 *   1. GET shows the blank form.
 *   2. POST carries the data.
 *   3. On a validation failure the form is re-displayed with 422 Unprocessable
 *      Entity, the errors shown, and the submitted values re-populated.
 *      On success the snippet is inserted and the user is redirected with a 303
 *      to /newsnippet/view/:id.
 */

const path = require('path');

const chapter5 = require('./chapter5');
const forms = require('./forms');
const chapter8ui = require('./chapter8ui');

const UI_ROOT = chapter5.UI_ROOT;
const CACHE = () => chapter5.newTemplateCache(UI_ROOT);

/* ------------------------------------------------------------ snippetCreate */

// Page 212: pass an initialised form so the template's {{with .Form...}} tags
// have something to evaluate — and set the default expiry to 365 days.
function snippetCreate(app, res) {
  const form = forms.newSnippetCreateForm();
  form.Expires = 365;
  const data = chapter5.templateData({ Form: form });
  chapter5.render(app, res, 200, 'create.tmpl', data, CACHE());
  return true;
}

/* -------------------------------------------------------- snippetCreatePost */

/*
 * Page 224's handler, with the chapter's progression intact: ParseForm, then
 * Decode (automatic form parsing), then the four CheckField calls, then either
 * a re-rendered form or an insert and redirect.
 */
function snippetCreatePost(app, db, res, body, contentType) {
  // r.ParseForm() — a malformed or oversized body is a client error.
  let values;
  try {
    values = forms.parseForm(body, contentType, forms.DEFAULT_MAX_MEMORY);
  } catch (err) {
    app.clientError(res, 400);
    return true;
  }
  app.infoLog.Printf('POST /newsnippet/create: r.PostForm = %s', JSON.stringify(values.toObject()));

  // app.decodePostForm(r, &form) — decodePostForm() panics on an invalid
  // target, which is a programming error, not a client one.
  const form = forms.newSnippetCreateForm();
  try {
    app.formDecoder.Decode(form, values);
  } catch (err) {
    if (err.isInvalidDecoder) {
      // recoverPanic() in the chain turns this into a 500, as in chapter 6.
      throw err;
    }
    // A value that will not convert ("expires=abc") is bad input.
    app.clientError(res, 400);
    return true;
  }

  // The four validation checks from page 217.
  forms.validate(form);

  if (!form.Valid()) {
    app.infoLog.Printf('validation failed: %s', JSON.stringify(form.FieldErrors));
    // 422 Unprocessable Entity, with the form and its errors re-displayed.
    const data = chapter5.templateData({ Form: form });
    chapter5.render(app, res, 422, 'create.tmpl', data, CACHE());
    return true;
  }

  const [id, err] = db.model.Insert(form.Title, form.Content, form.Expires);
  if (err) {
    app.serverError(res, err);
    return true;
  }

  app.infoLog.Printf('inserted snippet id=%d from the form: %s', id, JSON.stringify(form.Title));
  res.writeHead(303, { Location: `/newsnippet/view/${id}`, 'Content-Length': 0 });
  res.end();
  return true;
}

/* ---------------------------------------------- the snippet view for /newsnippet */

// The clean-URL view page, reading the id the way httprouter would.
function snippetView(app, db, id, res) {
  const [row, err] = db.model.Get(id);
  if (err) {
    app.notFound(res);
    return true;
  }
  const data = chapter5.templateData({ Snippet: chapter5.decorate(row) });
  chapter5.render(app, res, 200, 'view.tmpl', data, CACHE());
  return true;
}

function home(app, db, res) {
  const [rows, err] = db.model.Latest();
  if (err) { app.serverError(res, err); return true; }
  const data = chapter5.templateData({ Snippets: rows.map(chapter5.decorate) });
  chapter5.render(app, res, 200, 'home.tmpl', data, CACHE());
  return true;
}

/* --------------------------------------------------------------- dispatcher */

function handle(req, res, url, app, db) {
  const p = url.pathname;

  if (p === '/newsnippet/create' && req.method === 'GET') {
    return snippetCreate(app, res);
  }

  if (p === '/newsnippet/create' && req.method === 'POST') {
    let body = '';
    // net/http caps a form body at 10MB; the demo caps the raw read above that
    // so ParseForm() is the thing that rejects it.
    req.on('data', (c) => { body += c; if (body.length > 12e6) req.destroy(); });
    req.on('end', () => {
      try {
        snippetCreatePost(app, db, res, body, req.headers['content-type']);
      } catch (err) {
        // recoverPanic() would catch this in the real chain.
        app.serverError(res, err);
      }
    });
    return true;
  }

  if (p === '/newsnippet' || p === '/newsnippet/') return home(app, db, res);

  const m = /^\/newsnippet\/view\/(\d+)$/.exec(p);
  if (m) return snippetView(app, db, Number(m[1]), res);

  if (p === '/forms' || p === '/forms/') {
    return send(res, 200, chapter8ui.indexPage());
  }

  // The playground: post arbitrary form values and see each stage's verdict.
  if (p === '/api/forms/parse' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = chapter8ui.parseStages(payload);
        return jsonSend(res, result);
      } catch (err) {
        return jsonSend(res, { ok: false, error: String(err.message) });
      }
    });
    return true;
  }

  if (p === '/api/forms/demo' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        return jsonSend(res, chapter8ui.demo(JSON.parse(body || '{}')));
      } catch (err) {
        return jsonSend(res, { status: 500, label: 'error', text: String(err.message) });
      }
    });
    return true;
  }

  if (p === '/api/forms/raw' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        return jsonSend(res, chapter8ui.rawReport(JSON.parse(body || '{}')));
      } catch (err) {
        return jsonSend(res, { ok: false, text: String(err.message) });
      }
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

module.exports = { handle, snippetCreate, snippetCreatePost };
