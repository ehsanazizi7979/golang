'use strict';

/*
 * Chapter 7 of "Let's Go": advanced routing, wired for real.
 *
 *   /clean            the same application on httprouter rather than ServeMux
 *   /clean/snippet/view/:id     a clean URL, id read from the path
 *   /clean/snippet/create       GET shows the form, POST inserts and redirects
 *   /router           the route table, the Allow header, and the 404 difference
 *
 * Everything else in this demo server still runs on the chapter-2 ServeMux, so
 * the two behaviours can be compared side by side.
 */

const fs = require('fs');
const path = require('path');

const hr = require('./httprouter');
const chapter7ui = require('./chapter7ui');
const chapter5 = require('./chapter5');

const UI_ROOT = chapter5.UI_ROOT;

/* -------------------------------------------------------------- the handlers */

// home — the manual `r.URL.Path != "/"` check is gone, because httprouter
// matches "/" exactly.
function home(app, db) {
  return (req, res) => {
    const [rows, err] = db.model.Latest();
    if (err) { app.serverError(res, err); return; }
    chapter5.render(app, res, 200, 'home.tmpl',
      chapter5.templateData({ Snippets: rows.map(chapter5.decorate) }),
      chapter5.newTemplateCache(UI_ROOT));
  };
}

// snippetView — the id now comes from the path, not the query string.
function snippetView(app, db) {
  return (req, res) => {
    const params = hr.ParamsFromContext(req.context);
    const raw = params.byName('id');
    const id = Number(raw);
    if (!/^\d+$/.test(raw) || id < 1) {
      app.notFound(res);
      return;
    }
    const [row, err] = db.model.Get(id);
    if (err) {
      if (err === require('./models').ErrNoRecord) app.notFound(res);
      else app.serverError(res, err);
      return;
    }
    chapter5.render(app, res, 200, 'view.tmpl',
      chapter5.templateData({ Snippet: chapter5.decorate(row) }),
      chapter5.newTemplateCache(UI_ROOT));
  };
}

// snippetCreate — now a GET-only form page (chapter 8 fills it in).
function snippetCreate(app) {
  return (req, res) => {
    const body = Buffer.from('Display the form for creating a new snippet...\n', 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length });
    res.end(body);
  };
}

// snippetCreatePost — no method check any more: httprouter does it.
function snippetCreatePost(app, db) {
  return (req, res) => {
    const title = 'O snail';
    const content = 'O snail\nClimb Mount Fuji,\nBut slowly, slowly!\n\n– Kobayashi Issa';
    const [id, err] = db.model.Insert(title, content, 7);
    if (err) { app.serverError(res, err); return; }
    // The redirect uses the new clean URL format.
    res.writeHead(303, { Location: `/clean/snippet/view/${id}`, 'Content-Length': 0 });
    res.end();
  };
}

// The static file server, on the /static/*filepath catch-all. httprouter hands
// over the catch-all value, and StripPrefix removes "/static" before it.
function staticFile(app) {
  return (req, res) => {
    const params = hr.ParamsFromContext(req.context);
    const filepath = params.byName('filepath');
    const abs = path.join(UI_ROOT, '..', 'static', filepath);
    if (!abs.startsWith(path.join(UI_ROOT, '..', 'static'))) {
      app.notFound(res);
      return;
    }
    fs.readFile(abs, (err, buf) => {
      if (err) { app.notFound(res); return; }
      const ext = path.extname(abs);
      const mime = ext === '.css' ? 'text/css; charset=utf-8'
        : ext === '.js' ? 'text/javascript; charset=utf-8'
        : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': buf.length });
      res.end(buf);
    });
  };
}

/* ---------------------------------------------------------------- the router */

function buildRouter(app, db) {
  return hr.buildDemoRouter({
    home: home(app, db),
    snippetView: snippetView(app, db),
    snippetCreate: snippetCreate(app),
    snippetCreatePost: snippetCreatePost(app, db),
    staticFile: staticFile(app),
    notFound: (req, res) => app.notFound(res),
    methodNotAllowed: (req, res) => {
      // The book leaves 405 to httprouter; this mirrors its default body while
      // keeping the Allow header the router already set.
      const body = Buffer.from('Method Not Allowed\n', 'utf8');
      res.writeHead(405, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': body.length,
        Allow: res.getHeader('Allow') || 'GET, OPTIONS',
      });
      res.end(body);
    },
  });
}

/* --------------------------------------------------------------- dispatcher */

function handle(req, res, url, app, db) {
  const p = url.pathname;

  if (p === '/router' || p === '/router/') {
    const router = buildRouter(app, db);
    return send(res, 200, chapter7ui.indexPage(router.table()));
  }

  if (p === '/api/router/match') {
    const router = buildRouter(app, db);
    const probe = url.searchParams.get('path') || '/';
    const method = (url.searchParams.get('method') || 'GET').toUpperCase();
    const result = probeMatch(router, method, probe);
    return json(res, result);
  }

  // The httprouter-served application itself.
  if (p === '/clean' || p.startsWith('/clean/')) {
    const router = buildRouter(app, db);
    // Strip the /clean prefix (like StripPrefix) so the patterns stay the book's.
    const rest = p.slice('/clean'.length) || '/';
    const fake = Object.assign(Object.create(req), {
      url: rest + (url.search || ''),
      headers: req.headers,
      method: req.method,
      context: {},
    });
    router.serve(fake, res);
    return true;
  }

  return false;
}

/** Reports how the router would treat a method+path, without needing a socket. */
function probeMatch(router, method, p) {
  const routes = router.trees.get(method) || [];
  for (const route of routes) {
    const values = route.match(p);
    if (values) {
      return {
        matched: true, method, path: p, pattern: route.pattern,
        params: values, status: 200,
      };
    }
  }
  const allowed = router.allowedMethods(p);
  if (allowed.length) {
    return {
      matched: false, method, path: p, status: 405,
      allow: allowed.concat('OPTIONS').join(', '),
      note: `the path exists for ${allowed.join(', ')}, so httprouter answers 405 with an Allow header`,
    };
  }
  return {
    matched: false, method, path: p, status: 404,
    note: 'no pattern matches, so the custom router.NotFound handler runs',
  };
}

/* ------------------------------------------------------------------ helpers */

function send(res, status, body) {
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}

function json(res, obj) {
  const buf = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}

module.exports = { handle, buildRouter, probeMatch };
