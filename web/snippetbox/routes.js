'use strict';

/*
 * Chapter 2 of "Let's Go": the application after sections 2.7 and 2.8.
 *
 * This module is the live counterpart of the book's Snippetbox project:
 *
 *   web/snippetbox/ui/html/base.tmpl            <- section 2.7
 *   web/snippetbox/ui/html/partials/nav.tmpl    <- section 2.7 (partials)
 *   web/snippetbox/ui/html/pages/home.tmpl      <- section 2.7
 *   web/snippetbox/ui/static/{css,img,js}       <- section 2.8
 *
 * It reproduces two behaviours that are worth seeing for real:
 *
 *   1. template inheritance — {{template "title" .}} / {{template "main" .}}
 *      composition, rendered from the actual .tmpl files on disk;
 *   2. http.FileServer behind http.StripPrefix — including Go's directory
 *      listing, path sanitisation, Range requests and Last-Modified/304.
 *
 * The plain-text routes from sections 2.2-2.5 live in ../server.js and are
 * left untouched, so the request console keeps demonstrating those chapters.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_ROOT = __dirname;

// Chapter 3.1: these were hard-coded ("", "./ui/static") before the book made
// them configurable. They now come from the parsed flags, with the project's own
// directories as defaults.
const DEFAULTS = {
  templateDir: path.join(APP_ROOT, 'ui', 'html'),
  staticDir: path.join(APP_ROOT, 'ui', 'static'),
};
let HTML_ROOT = DEFAULTS.templateDir;
let STATIC_ROOT = DEFAULTS.staticDir;
let currentConfig = null;

/* ------------------------------------------------------- tiny template engine
 * Supports exactly what chapter 2.7 uses: {{define "name"}}...{{end}} blocks,
 * {{template "name" .}} invocations and plain text. Nested {{end}} are counted
 * so multi-line definitions work. Dynamic data (the dot) is always nil here,
 * just like the book's handlers at this stage.
 */

const DEFINE_RE = /\{\{\s*define\s+"([^"]+)"\s*\}\}/g;

function parseDefs(source, into) {
  let match;
  DEFINE_RE.lastIndex = 0;
  while ((match = DEFINE_RE.exec(source)) !== null) {
    const name = match[1];
    let depth = 1;
    let i = DEFINE_RE.lastIndex;
    let body = '';
    while (i < source.length) {
      if (source.startsWith('{{end}}', i)) {
        depth -= 1;
        if (depth === 0) break;
        body += '{{end}}';
        i += 7;
      } else if (source.startsWith('{{define', i)) {
        depth += 1;
        body += '{{define';
        i += 8;
      } else {
        body += source[i];
        i += 1;
      }
    }
    into.set(name, body);
    DEFINE_RE.lastIndex = i;
  }
}

function loadTemplates(files) {
  const defs = new Map();
  for (const rel of files) {
    if (currentConfig && currentConfig.brokenTemplate) {
      // The chapter-3 exercise: "open ./ui/html/pages/home.tmpl: no such file
      // or directory". Raised like Go's os error so the 500 path is exercised.
      if (rel.includes('pages/home.tmpl')) {
        const err = new Error('open ' + path.join(HTML_ROOT, rel) + ': no such file or directory');
        err.code = 'ENOENT';
        throw err;
      }
    }
    const full = path.join(HTML_ROOT, rel);
    parseDefs(fs.readFileSync(full, 'utf8'), defs);
  }
  return defs;
}

function renderDef(defs, name, depth, stack) {
  if (typeof defs.get(name) !== 'string') {
    throw new Error(`template: no template "${name}" associated with template set`);
  }
  if ((depth || 0) > 12) throw new Error('template: recursion detected');
  const stackNext = (stack || []).concat(name);
  return defs.get(name).replace(/\{\{\s*template\s+"([^"]+)"[^}]*\}\}/g, (_, child) => {
    if (stackNext.includes(child)) throw new Error(`template: recursion: ${stackNext.join(' -> ')} -> ${child}`);
    return renderDef(defs, child, (depth || 0) + 1, stackNext);
  });
}

function execute(defs, name) {
  return renderDef(defs, name, 0, []);
}

const PAGE_FILES = ['base.tmpl', 'partials/nav.tmpl', 'pages/home.tmpl'];

/* --------------------------------------------------------------- static files */

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Resolves a request path inside root, refusing anything that escapes it.
// Go's http.FileServer does the equivalent with path.Clean().
function safeJoin(root, urlPath) {
  const clean = path.posix.normalize('/' + urlPath).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(root, clean);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function directoryListing(res, dir, urlPath) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const items = entries.map((e) => {
    const label = e.name + (e.isDirectory() ? '/' : '');
    const href = `${urlPath.replace(/\/?$/, '/')}${e.name}`;
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`;
  });
  const body = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(urlPath)}</title>
<style>body{font-family:"Ubuntu Mono",monospace;font-size:18px;color:#34495E;padding:1em}
a{color:#34495E}h1{font-size:18px;font-weight:normal}</style></head>
<body><h1>Index of ${escapeHtml(urlPath)}</h1><ul>${items.join('')}</ul>
<p style="color:#9AA3AB;font-size:14px">Directory listing produced by the demo's
http.FileServer equivalent. Go's real handler renders the same links.</p></body></html>`;
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
}

function serveStatic(req, res, urlPath) {
  // urlPath arrives already stripped of the "/static" prefix, like
  // http.StripPrefix("/static", fileServer) does.
  const rel = decodeURIComponent(urlPath.replace(/^\/+/, ''));
  const full = safeJoin(STATIC_ROOT, rel);
  if (!full) return false;

  let stat;
  try {
    stat = fs.statSync(full);
  } catch (e) {
    return false;
  }

  if (stat.isDirectory()) {
    if (!urlPath.endsWith('/')) {
      // http.FileServer redirects /static/css -> /static/css/ with a 301.
      res.writeHead(301, { Location: '/static' + urlPath + '/' });
      res.end();
      return true;
    }
    directoryListing(res, full, '/static' + urlPath);
    return true;
  }

  const ext = path.extname(full).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = '"' + crypto.createHash('sha1').update(String(stat.mtimeMs) + stat.size).digest('hex').slice(0, 16) + '"';

  const headers = {
    'Content-Type': type,
    'Last-Modified': stat.mtime.toUTCString(),
    'Accept-Ranges': 'bytes',
    ETag: etag,
  };

  // If-Modified-Since -> 304, like http.FileServer's serveContent.
  const ims = req.headers['if-modified-since'];
  if (ims) {
    const since = Date.parse(ims);
    if (!Number.isNaN(since) && Math.floor(stat.mtimeMs / 1000) * 1000 <= since) {
      delete headers['Content-Type'];
      res.writeHead(304, headers);
      res.end();
      return true;
    }
  }

  const data = fs.readFileSync(full);

  // Range requests, which the book demonstrates with curl (page 57).
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] === '' ? null : Number(m[1]);
      let end = m[2] === '' ? null : Number(m[2]);
      if (start === null) start = Math.max(0, data.length - (end || 0));
      if (end === null || end >= data.length) end = data.length - 1;
      if (start > end || start >= data.length) {
        res.writeHead(416, { 'Content-Range': `bytes */${data.length}` });
        res.end();
        return true;
      }
      const chunk = data.subarray(start, end + 1);
      res.writeHead(206, Object.assign({}, headers, {
        'Content-Range': `bytes ${start}-${end}/${data.length}`,
        'Content-Length': chunk.length,
      }));
      res.end(chunk);
      return true;
    }
  }

  headers['Content-Length'] = data.length;
  res.writeHead(200, headers);
  res.end(data);
  return true;
}

/* ------------------------------------------------------------ extra pages */

function templatesPage() {
  const files = ['base.tmpl', 'partials/nav.tmpl', 'pages/home.tmpl'];
  const blocks = files.map((rel) => {
    const src = fs.readFileSync(path.join(HTML_ROOT, rel), 'utf8').replace(/\s+$/, '');
    return `<h3>ui/html/${rel}</h3>
<pre><code>${escapeHtml(src)}</code></pre>`;
  }).join('\n');

  return `{{define "title"}}Templates{{end}}
{{define "main"}}
    <h2>Templates</h2>
    <p class="lede">These are the real files this server parses with an
       <code>ExecuteTemplate(w, "base", nil)</code> equivalent. The page you are reading is itself
       rendered through <code>base</code> &rarr; <code>nav</code> + <code>main</code>.</p>
    ${blocks}
{{end}}`;
}

/* ----------------------------------------------------------------- dispatcher */

/**
 * Handles the chapter-2 routes. Returns true when the request was answered.
 */
function handle(req, res, url, config, app) {
  const p = url.pathname;

  // Chapter 3.1: honour -template-dir and -static-dir if they were provided.
  if (config) {
    currentConfig = config;
    HTML_ROOT = config.templateDir || DEFAULTS.templateDir;
    STATIC_ROOT = config.staticDir || DEFAULTS.staticDir;
    if (app) currentConfig = app.config || config;
  }

  // A fully templated home page, at /home so that "/" can keep serving the
  // chapter 2.2 plain-text response that the request console demonstrates.
  if (p === '/home' || p === '/home/') {
    try {
      const defs = loadTemplates(PAGE_FILES);
      const body = execute(defs, 'base');
      const buf = Buffer.from(body, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
      res.end(buf);
    } catch (err) {
      // Chapter 3.3/3.4: the handler reports through the injected errorLog and
      // app.serverError, which logs a stack trace and sends a generic 500.
      if (app) app.serverError(res, err);
      else {
        console.error(err.message);
        const buf = Buffer.from('Internal Server Error\n');
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': buf.length });
        res.end(buf);
      }
    }
    return true;
  }

  if (p === '/templates' || p === '/templates/') {
    const defs = loadTemplates(PAGE_FILES);
    parseDefs(templatesPage(), defs);
    const body = execute(defs, 'base');
    const buf = Buffer.from(body, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
    res.end(buf);
    return true;
  }

  if (p === '/book' || p === '/book/') {
    const defs = loadTemplates(['base.tmpl', 'partials/nav.tmpl', 'pages/book.tmpl']);
    const body = execute(defs, 'base');
    const buf = Buffer.from(body, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
    res.end(buf);
    return true;
  }

  // /static/ is a subtree path: strip the prefix, then hand the rest to the
  // file server (http.StripPrefix("/static", fileServer) in the book).
  if (p === '/static' || p.startsWith('/static/')) {
    const stripped = p.slice('/static'.length) || '/';
    if (serveStatic(req, res, stripped)) return true;
    const buf = Buffer.from('404 page not found\n');
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': buf.length });
    res.end(buf);
    return true;
  }

  return false;
}

module.exports = { handle, execute, loadTemplates, parseDefs, APP_ROOT, HTML_ROOT, STATIC_ROOT };
