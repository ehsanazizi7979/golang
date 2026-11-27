'use strict';

/*
 * Chapter 7 of "Let's Go": advanced routing.
 *
 * The book replaces net/http's ServeMux with julienschmidt/httprouter, because
 * the servemux cannot do method-based routing or clean URLs with variables in
 * the path. This module is a working httprouter:
 *
 *   router.HandlerFunc(method, pattern, handler)
 *   router.Handler(method, pattern, http.Handler)
 *   named parameters   /snippet/view/:id
 *   catch-all          /static/*filepath      (one per pattern, at the end)
 *   ParamsFromContext  the matched values, retrievable in the handler
 *   router.NotFound           custom 404
 *   router.MethodNotAllowed   custom 405
 *   automatic OPTIONS and an Allow header on 405s, as httprouter does
 *   conflicting patterns rejected at registration time
 *
 * The radix-tree detail of the real package is not reproduced — a sorted list of
 * patterns gives the same observable behaviour for the routes in this book.
 */

/* ------------------------------------------------------------------- params */

const PARAMS_KEY = Symbol.for('httprouter.params');

// httprouter.ParamsFromContext(ctx). The demo passes a request object with a
// `context` property, mirroring r.Context().
function ParamsFromContext(ctx) {
  const params = (ctx && ctx[PARAMS_KEY]) || (ctx && ctx.params) || [];
  return {
    byName(name) {
      const hit = params.find((p) => p.key === name);
      return hit ? hit.value : '';
    },
    get length() { return params.length; },
    toArray() { return params.slice(); },
  };
}

/* ------------------------------------------------------------------ matching */

/*
 * Compiles a pattern into a matcher. A pattern like /snippet/view/:id matches
 * one path segment per :name; *name swallows the rest, including slashes.
 */
function compile(pattern) {
  if (pattern === '/') {
    return { pattern, match: (p) => (p === '/' ? [] : null), score: 1 };
  }
  const raw = pattern.replace(/^\//, '').split('/');
  const params = [];
  let catchAllAt = -1;

  const steps = raw.map((seg, i) => {
    if (seg.startsWith('*')) {
      catchAllAt = i;
      params.push(seg.slice(1));
      return { type: 'catchall', name: seg.slice(1) };
    }
    if (seg.startsWith(':')) {
      params.push(seg.slice(1));
      return { type: 'param', name: seg.slice(1) };
    }
    return { type: 'static', value: seg };
  });

  if (catchAllAt !== -1 && catchAllAt !== steps.length - 1) {
    throw new Error(`catch-all routes are only allowed at the end of the path in path '${pattern}'`);
  }

  return {
    pattern,
    score: steps.filter((s) => s.type === 'static').length,
    match(pathname) {
      if (pathname === '/') return null;
      const parts = pathname.replace(/^\//, '').split('/');
      const values = [];
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        if (step.type === 'catchall') {
          values.push({ key: step.name, value: parts.slice(i).join('/') });
          return values.length === params.length ? values : null;
        }
        if (i >= parts.length) return null;
        if (step.type === 'static') {
          if (parts[i] !== step.value) return null;
        } else {
          // :name matches exactly one non-empty segment.
          if (parts[i] === '') return null;
          values.push({ key: step.name, value: parts[i] });
        }
      }
      return parts.length === steps.length ? values : null;
    },
  };
}

/*
 * Two patterns conflict when a single request path could match both. httprouter
 * rejects those at registration time, which is exactly why it needs no
 * routing-priority rules at runtime.
 *
 * A catch-all only conflicts when it is the segment that differs at the point
 * where the patterns diverge — /static/*filepath and /snippet/view/:id both
 * have a wildcard, but their first segments are different literals, so nothing
 * can match both.
 */
function conflicts(a, b) {
  const sa = a.split('/').filter((x, i) => i > 0 || x !== '');
  const sb = b.split('/').filter((x, i) => i > 0 || x !== '');

  // Find the first segment where they differ.
  let i = 0;
  while (i < sa.length && i < sb.length && sa[i] === sb[i]) i += 1;

  // A shared literal prefix that then diverges into two different literals can
  // never overlap.
  const restA = sa.slice(i);
  const restB = sb.slice(i);
  if (!restA.length || !restB.length) {
    // One is a prefix of the other: only a catch-all can absorb the rest.
    return restA.some((x) => x.startsWith('*')) || restB.some((x) => x.startsWith('*'));
  }

  const statA = restA[0];
  const statB = restB[0];
  const isStatic = (x) => !x.startsWith(':') && !x.startsWith('*');

  // Different leading literals => disjoint.
  if (isStatic(statA) && isStatic(statB) && statA !== statB) return false;

  // Otherwise one side is a wildcard where the other is a literal or another
  // wildcard: they can match the same path, so the routes conflict.
  return true;
}

/* ------------------------------------------------------------------- router */

class Router {
  constructor() {
    this.trees = new Map();          // method -> [compiled routes]
    this.NotFound = null;            // http.HandlerFunc
    this.MethodNotAllowed = null;
    this.RedirectTrailingSlash = false;
    this.RedirectFixedPath = false;
    this.HandleOPTIONS = true;
  }

  add(method, pattern, fn, isHandler) {
    if (!this.trees.has(method)) this.trees.set(method, []);
    const routes = this.trees.get(method);
    for (const existing of routes) {
      if (existing.pattern === pattern) {
        throw new Error(`a handle is already registered for path '${pattern}'`);
      }
      if (conflicts(existing.pattern, pattern)) {
        throw new Error(`'${pattern}' in new path '${pattern}' conflicts with existing wildcard '${existing.pattern}'`);
      }
    }
    const compiled = compile(pattern);
    compiled.handler = fn;
    compiled.isHandler = !!isHandler;
    // Static segments win over parameters, which win over catch-alls: the same
    // priority order httprouter's tree encodes.
    routes.push(compiled);
    routes.sort((x, y) => y.score - x.score);
    return this;
  }

  HandlerFunc(method, pattern, fn) {
    return this.add(method, pattern, fn, false);
  }

  Handler(method, pattern, handler) {
    return this.add(method, pattern, handler, true);
  }

  GET(pattern, fn) { return this.HandlerFunc('GET', pattern, fn); }
  POST(pattern, fn) { return this.HandlerFunc('POST', pattern, fn); }

  /**
   * Serve dispatches one request. Returns true when it produced a response.
   */
  serve(req, res) {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = url.pathname;
    const routes = this.trees.get(req.method) || [];

    for (const route of routes) {
      const values = route.match(pathname);
      if (values) {
        // Named parameters are stored on the request context in Go; here they
        // are attached to a context object the handler can read.
        req.context = req.context || {};
        req.context[PARAMS_KEY] = values;
        if (route.isHandler) route.handler(req, res);
        else route.handler(req, res, req.context);
        return true;
      }
    }

    // OPTIONS is answered automatically when the path exists for another method.
    if (this.HandleOPTIONS && req.method === 'OPTIONS') {
      const allowed = this.allowedMethods(pathname);
      if (allowed.length) {
        res.writeHead(200, { Allow: allowed.concat('OPTIONS').join(', ') });
        res.end();
        return true;
      }
    }

    // A path that exists under a different method is a 405, not a 404.
    const allowed = this.allowedMethods(pathname);
    if (allowed.length) {
      const allow = allowed.concat('OPTIONS').join(', ');
      if (this.MethodNotAllowed) {
        res.setHeader('Allow', allow);
        this.MethodNotAllowed(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: allow });
        res.end('Method Not Allowed\n');
      }
      return true;
    }

    if (this.NotFound) {
      this.NotFound(req, res);
      return true;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 page not found\n');
    return true;
  }

  allowedMethods(pathname) {
    const out = [];
    for (const [method, routes] of this.trees) {
      if (routes.some((r) => r.match(pathname))) out.push(method);
    }
    return out.sort();
  }

  /** Every registered route, for the demo's route table. */
  table() {
    const rows = [];
    for (const [method, routes] of this.trees) {
      for (const r of routes) {
        rows.push({ method, pattern: r.pattern, params: r.pattern.match(/[:*]\w+/g) || [] });
      }
    }
    return rows.sort((a, b) => (a.pattern + a.method).localeCompare(b.pattern + b.method));
  }
}

function New() {
  return new Router();
}

/* ------------------------------------------------------- the demo's router */

/*
 * snippetbox's routes as httprouter registers them on pages 185 and 189:
 *
 *   GET  /                     home
 *   GET  /snippet/view/:id     snippetView
 *   GET  /snippet/create       snippetCreate
 *   POST /snippet/create       snippetCreatePost
 *   GET  /static/*filepath     http.FileServer
 *
 * plus the two extras the chapter adds: a custom 404 handler, and a custom 405
 * handler wired the same way (router.MethodNotAllowed).
 */
function buildDemoRouter(handlers) {
  const router = New();

  router.NotFound = handlers.notFound;
  router.MethodNotAllowed = handlers.methodNotAllowed;

  router.HandlerFunc('GET', '/', handlers.home);
  router.HandlerFunc('GET', '/snippet/view/:id', handlers.snippetView);
  router.HandlerFunc('GET', '/snippet/create', handlers.snippetCreate);
  router.HandlerFunc('POST', '/snippet/create', handlers.snippetCreatePost);
  router.HandlerFunc('GET', '/static/*filepath', handlers.staticFile);

  return router;
}

module.exports = { New, Router, ParamsFromContext, compile, conflicts, buildDemoRouter, PARAMS_KEY };
