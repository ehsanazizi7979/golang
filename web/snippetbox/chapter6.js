'use strict';

/*
 * Chapter 6 demo pages.
 *
 *   /middleware       the chain, executed for real, with a trace of every link
 *   /middleware/panic the panic, with and without recoverPanic()
 *   /middleware/alice alice.New(...).Then(mux) versus nested wrapping
 *   /api/mw/trace     JSON: run the chain and return the events + headers
 *   /api/mw/panic     JSON: the panic, recovered vs unrecovered
 */

const mw = require('./middleware');
const chapter6ui = require('./chapter6ui');

const CSP = "default-src 'self'; style-src 'self' fonts.googleapis.com; font-src fonts.gstatic.com";

/* ---------------------------------------------- the chain, in the book's order */

/*
 * routes.go, page 179:
 *
 *   standard := alice.New(app.recoverPanic, app.logRequest, secureHeaders)
 *   return standard.Then(mux)
 *
 * recoverPanic is outermost, so it covers panics in everything after it.
 */
function standardChain(app, handler) {
  return mw.alice([
    (next) => mw.recoverPanic(app, next),
    (next) => mw.logRequest(app, next),
    (next) => mw.secureHeaders(next),
  ]).Then(handler);
}

/* ---------------------------------------------------- middleware applied to a route */

// chapter5's render() writes headers itself, so chapter 6's middleware has to be
// applied around it rather than inside it. This wraps a handler so the security
// headers land on its response.
function withStandardHeaders(handler) {
  return function (req, res) {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Referrer-Policy', 'origin-when-cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'deny');
    res.setHeader('X-XSS-Protection', '0');
    return handler(req, res);
  };
}

/* --------------------------------------------------------------- dispatcher */

function handle(req, res, url, app) {
  const p = url.pathname;

  if (p === '/middleware' || p === '/middleware/') {
    return send(res, 200, chapter6ui.indexPage(app.traceLog || []));
  }

  if (p === '/middleware/panic') {
    return send(res, 200, chapter6ui.panicPage());
  }

  if (p === '/middleware/alice') {
    return send(res, 200, chapter6ui.alicePage());
  }

  if (p === '/api/mw/trace') {
    const trace = mw.newTrace();
    // A fake request object carrying the trace, so every link can report itself.
    const fakeReq = {
      method: 'GET',
      url: '/',
      httpVersion: '1.1',
      socket: { remoteAddress: '127.0.0.1', remotePort: 45988 },
      __trace: trace,
    };
    const headers = {};
    const fakeRes = {
      headersSent: false,
      setHeader: (k, v) => { headers[k] = v; },
      getHeader: (k) => headers[k],
    };
    const chain = standardChain(app, (rq, rs) => mw.demoHandler(rq, rs));
    const body = chain(fakeReq, fakeRes);
    return json(res, {
      architecture: 'recoverPanic -> logRequest -> secureHeaders -> servemux -> application handler',
      events: trace.events,
      headers,
      body,
      elapsedMs: Date.now() - trace.startedAt,
    });
  }

  if (p === '/api/mw/panic') {
    const recovered = runPanic(true, app);
    const bare = runPanic(false, app);
    return json(res, { recovered, bare });
  }

  return false;
}

/** Runs the middleware chain around a handler that panics. */
function runPanic(withMiddleware, app) {
  const events = [];
  const headers = {};
  let status = 200;
  let body = '';
  let connectionHeader = null;

  const req = {
    method: 'GET', url: '/', httpVersion: '1.1',
    socket: { remoteAddress: '127.0.0.1', remotePort: 45988 },
    __trace: { events, startedAt: Date.now() },
  };
  // A stand-in ResponseWriter that records what app.serverError() would send.
  const res = {
    headersSent: false,
    setHeader: (k, v) => {
      headers[k] = v;
      if (k.toLowerCase() === 'connection') connectionHeader = v;
    },
    getHeader: (k) => headers[k],
    writeHead: (code) => { status = code; res.headersSent = true; },
    end: (chunk) => { if (chunk) body = String(chunk); },
    write: (chunk) => { if (chunk) body = String(chunk); },
  };

  // The handler from page 173: panic("oops! something went wrong").
  const panicking = () => { mw.panic('oops! something went wrong'); };

  try {
    if (withMiddleware) {
      const chain = standardChain(app, (rq, rs) => panicking());
      chain(req, res);
    } else {
      // No recoverPanic: Go unwinds the goroutine and closes the connection,
      // so curl sees an empty reply rather than a response.
      panicking();
    }
  } catch (err) {
    status = 0;
    body = 'curl: (52) Empty reply from server';
  }

  return {
    middleware: withMiddleware,
    status,
    headers,
    connection: connectionHeader,
    body,
    events,
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

module.exports = {
  handle,
  standardChain,
  withStandardHeaders,
  CSP,
};
