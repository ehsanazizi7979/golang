'use strict';

/*
 * Chapter 6 of "Let's Go": middleware.
 *
 *   cmd/web/middleware.go  secureHeaders(), app.logRequest(), app.recoverPanic()
 *   cmd/web/routes.go      routes() returning http.Handler, and the alice chain
 *
 * A middleware in Go is a function that takes the next http.Handler and returns
 * a new one:
 *
 *   func secureHeaders(next http.Handler) http.Handler {
 *       return http.HandlerFunc(func(w, r) {
 *           w.Header().Set(...)   // on the way down
 *           next.ServeHTTP(w, r)
 *       })                        // on the way back up
 *   }
 *
 * Here the same shape is a JS function that takes `next` and returns
 * `(req, res) => ...`. The chain is really executed, in the real order, on every
 * request — and each link reports when it runs and whether it continued.
 */

const crypto = require('crypto');

/* ------------------------------------------------------------ chain tracing */

// Every middleware entry records its own execution, so the demo pages can show
// the down/up flow rather than describing it.
function newTrace() {
  return { events: [], startedAt: Date.now() };
}

/* --------------------------------------------------------- 6.2 secureHeaders */

// The `secureHeaders` function from page 167. Function middleware: it needs no
// access to application state, so it is not a method.
function secureHeaders(next) {
  return function (req, res) {
    const trace = req.__trace;
    if (trace) trace.events.push({ mw: 'secureHeaders', phase: 'down' });
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; style-src 'self' fonts.googleapis.com; font-src fonts.gstatic.com");
    res.setHeader('Referrer-Policy', 'origin-when-cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'deny');
    res.setHeader('X-XSS-Protection', '0');
    if (trace) trace.events.push({ mw: 'servemux', phase: 'in' });
    const result = next(req, res);
    if (trace) {
      trace.events.push({ mw: 'servemux', phase: 'out' });
      trace.events.push({ mw: 'secureHeaders', phase: 'up' });
    }
    return result;
  };
}

/* ------------------------------------------------------------ 6.3 logRequest */

// As a method on *application, so it can reach app.infoLog. This is page 171.
function logRequest(app, next) {
  return function (req, res) {
    const trace = req.__trace;
    if (trace) trace.events.push({ mw: 'logRequest', phase: 'down' });
    // r.RemoteAddr is "IP:port"; the demo shows the peer it actually saw.
    app.infoLog.Printf('%s - %s %s %s',
      req.socket ? `${req.socket.remoteAddress}:${req.socket.remotePort}` : '127.0.0.1:0',
      'HTTP/' + (req.httpVersion || '1.1'),
      req.method,
      req.url);
    const result = next(req, res);
    if (trace) trace.events.push({ mw: 'logRequest', phase: 'up' });
    return result;
  };
}

/* ----------------------------------------------------------- 6.4 recoverPanic */

// Deferred functions always run while a panic unwinds the stack, which is what
// makes this pattern work in Go. In JS the equivalent is try/catch/finally.
function recoverPanic(app, next) {
  return function (req, res) {
    const trace = req.__trace;
    if (trace) trace.events.push({ mw: 'recoverPanic', phase: 'down' });
    try {
      return next(req, res);
    } catch (err) {
      // err is whatever was passed to panic(): a string, an error, anything.
      // Panic() carries the raw value, so unwrap it to the text Go would print.
      const raw = err && err.isPanic ? err.value : err;
      const message = typeof raw === 'string' ? raw
        : (raw && raw.message) || String(raw);
      if (trace) trace.events.push({ mw: 'recoverPanic', phase: 'recovered', panic: message });
      app.errorLog.Printf('panic recovered: %s', message);
      if (!res.headersSent) {
        // Connection: close makes Go's server close the connection after the
        // response, and tells the user it is about to happen.
        res.setHeader('Connection', 'close');
        app.serverError(res, new Error(message));
      }
      return true;
    } finally {
      if (trace) trace.events.push({ mw: 'recoverPanic', phase: 'up' });
    }
  };
}

/* ------------------------------------------------------- 6.5 alice (justinas)

 * alice.New(a, b, c).Then(handler) — the first argument is the outermost
 * middleware, exactly like recoverPanic(logRequest(secureHeaders(mux))).
 */

class Chain {
  constructor(middleware) {
    this.middleware = middleware || [];
  }

  // alice.Chain.Append — returns a NEW chain, leaving the receiver untouched.
  Append(...extra) {
    return new Chain(this.middleware.concat(extra));
  }

  Then(handler) {
    // Build from the inside out so the first middleware ends up outermost.
    return this.middleware.reduceRight((next, mw) => (req, res) => mw(next)(req, res), handler);
  }

  Extend(chain) {
    return new Chain(this.middleware.concat(chain.middleware));
  }
}

function alice(middleware) {
  return new Chain(middleware);
}

/* ------------------------------------------------------------- panic helpers */

// A panic carrying any value — a string, an Error, or an object.
class Panic {
  constructor(value) {
    this.value = value;
    this.isPanic = true;
  }
}

function panic(value) {
  throw new Panic(value);
}

// 6.4 "Additional information": a panic in a goroutine that the middleware
// never sees, unless that goroutine recovers it itself.
function runInGoroutine(app, fn) {
  const out = { recovered: false, message: null, crashed: false };
  try {
    // A real goroutine would take the process down. Here we simulate both
    // outcomes so the difference is visible rather than fatal.
    fn();
  } catch (err) {
    if (err && err.__withRecover) {
      out.recovered = true;
      out.message = err.message;
    } else {
      out.crashed = true;
      out.message = (err && (err.message || err.value)) || String(err);
    }
  }
  return out;
}

/** Runs fn, recovering any Panic — the `defer recover()` inside the goroutine. */
function withRecover(fn) {
  try {
    fn();
    return { recovered: false, crashed: false, message: null };
  } catch (err) {
    if (err && err.isPanic) {
      return { recovered: true, crashed: false, message: String(err.value) };
    }
    throw err;
  }
}

/** Runs fn with no recovery at all — what happens without the defer. */
function withoutRecover(fn) {
  try {
    fn();
    return { recovered: false, crashed: false, message: null };
  } catch (err) {
    return { recovered: false, crashed: true, message: String((err && err.value) || err) };
  }
}

/* ------------------------------------------------------------------ the demo */

// The handler in the middle of the chain: it reports what it received.
function demoHandler(req, res) {
  const trace = req.__trace;
  if (trace) trace.events.push({ mw: 'application handler', phase: 'in' });
  const body = `<pre class="light">servemux -> application handler

You asked for: ${req.method} ${req.url}
The response has these headers set by secureHeaders():

  Content-Security-Policy: ${res.getHeader('Content-Security-Policy') || '(none)'}
  Referrer-Policy:         ${res.getHeader('Referrer-Policy') || '(none)'}
  X-Content-Type-Options:  ${res.getHeader('X-Content-Type-Options') || '(none)'}
  X-Frame-Options:         ${res.getHeader('X-Frame-Options') || '(none)'}
  X-XSS-Protection:        ${res.getHeader('X-XSS-Protection') || '(none)'}
</pre>`;
  if (trace) trace.events.push({ mw: 'application handler', phase: 'out' });
  return body;
}

module.exports = {
  secureHeaders,
  logRequest,
  recoverPanic,
  alice,
  Chain,
  Panic,
  panic,
  newTrace,
  demoHandler,
  withRecover,
  withoutRecover,
};
