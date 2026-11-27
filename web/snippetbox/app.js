'use strict';

/*
 * Chapter 3 of "Let's Go": configuration and error handling.
 *
 * The book turns main.go inside out in five steps, and each one has a
 * counterpart here:
 *
 *   3.1  managing configuration     <- parseConfig() below emulates the
 *                                      flag.String() / flag.Parse() pair,
 *                                      including -help output
 *   3.2  leveled logging            <- infoLog / errorLog write to stdout and
 *                                      stderr with INFO / ERROR prefixes, and
 *                                      the error log carries file:line
 *   3.3  dependency injection       <- the `application` struct, with handlers
 *                                      defined as methods on it
 *   3.4  centralized error handling <- serverError / clientError / notFound,
 *                                      including the Output(2, ...) frame skip
 *   3.5  isolating the routes       <- app.routes()
 *
 * Everything is observable from the running demo: /logs shows the live stream
 * and /debug shows the parsed configuration.
 */

const path = require('path');

/* ---------------------------------------------------------------- 3.1 flags */

/**
 * Emulates Go's flag package closely enough to be recognisable:
 *
 *   node web/server.js -addr=:4000 -static-dir=./ui/static
 *   node web/server.js -help
 *
 * Like flag.Parse(), a bad value terminates the application.
 */
function parseConfig(argv) {
  const defaults = {
    addr: ':' + (process.env.PORT || 3000),
    staticDir: './web/snippetbox/ui/static',
    templateDir: './web/snippetbox/ui/html',
  };

  const flags = [
    { name: 'addr', def: defaults.addr, help: 'HTTP network address' },
    { name: 'static-dir', def: defaults.staticDir, help: 'Path to static assets' },
    { name: 'template-dir', def: defaults.templateDir, help: 'Path to HTML templates' },
  ];

  const values = {};
  for (const f of flags) values[f.name] = f.def;

  const usage = () => {
    const lines = [`Usage of ${argv[1]}:`];
    for (const f of flags) {
      lines.push(`  -${f.name} string`);
      lines.push(`        ${f.help} (default "${f.def}")`);
    }
    return lines.join('\n');
  };

  for (const arg of argv.slice(2)) {
    if (arg === '-help' || arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    const m = /^-{1,2}([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!m) {
      console.error(`flag provided but not defined: ${arg}`);
      console.error(usage());
      process.exit(2);
    }
    const [, name, value] = m;
    const flag = flags.find((f) => f.name === name);
    if (!flag) {
      console.error(`flag provided but not defined: -${name}`);
      console.error(usage());
      process.exit(2);
    }
    if (value === undefined) {
      console.error(`flag needs an argument: -${name}`);
      console.error(usage());
      process.exit(2);
    }
    values[name] = value;
  }

  // Go requires "host:port"; a bare number is rejected at listen time.
  const addr = values.addr;
  const idx = addr.lastIndexOf(':');
  if (idx === -1) {
    console.error(`listen tcp: address ${addr}: missing port in address`);
    process.exit(1);
  }
  const host = addr.slice(0, idx) || '0.0.0.0';
  const port = addr.slice(idx + 1);
  if (!/^\d+$/.test(port) || Number(port) < 0 || Number(port) > 65535) {
    console.error(`listen tcp: address ${addr}: invalid port`);
    process.exit(1);
  }

  return {
    addr,
    host,
    port: Number(port),
    // flag names are kebab-case ("-static-dir"), so look them up verbatim
    staticDir: path.resolve(process.cwd(), values['static-dir']),
    templateDir: path.resolve(process.cwd(), values['template-dir']),
    usage,
  };
}

/* -------------------------------------------------------- 3.2 leveled logging */

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestamp(d) {
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// "shortfile" equivalent: the first stack frame that is application code,
// mirroring log.Lshortfile's file.go:123 output.
function stackFrames() {
  return new Error().stack.split('\n').slice(1)
    .map((line) => /\(?([^()\s]+):(\d+):\d+\)?$/.exec(line.trim()))
    .filter(Boolean)
    .map((m) => ({ file: m[1], line: Number(m[2]) }))
    // Drop this module (where the message is written) and Node/libuv internals.
    .filter((f) => !f.file.includes('/web/snippetbox/app.js'))
    .filter((f) => !f.file.startsWith('node:') && !f.file.includes('/internal/'));
}

// index 0 = the first frame outside this module, i.e. whoever called the logger.
function siteAt(index) {
  const frame = stackFrames()[index];
  if (!frame) return 'unknown:0';
  return `${path.basename(frame.file)}:${frame.line}`;
}

/**
 * A logger in the shape of Go's log.Logger: a destination (here a stream plus a
 * ring buffer for the /logs page), a prefix, and flags controlling the output.
 */
class Logger {
  constructor({ name, prefix, stream, shortfile, store }) {
    this.name = name;
    this.prefix = prefix;
    this.stream = stream;
    this.shortfile = shortfile;
    this.store = store;
  }

  // Output(calldepth, msg): same convention as Go, where 2 means "the caller of
  // the function that called Output" — which is exactly what serverError wants.
  Output(calldepth, msg) {
    this.write(msg, Math.max(0, (calldepth || 2) - 2));
  }

  Print(msg) {
    this.write(String(msg), 0);
  }

  Printf(fmt, ...args) {
    let i = 0;
    const rendered = String(fmt).replace(/%[svd]/g, (m) => {
      const v = args[i];
      i += 1;
      return m === '%d' ? String(Number(v)) : String(v);
    });
    this.write(rendered, 0);
  }

  write(msg, frameIndex) {
    let site = '';
    if (this.shortfile) {
      site = `${siteAt(frameIndex || 0)}: `;
    }
    const text = String(msg);
    const prefix = `${this.prefix}${timestamp(new Date())} `;
    const lines = text.split('\n');
    const first = prefix + site + lines[0];
    this.stream.write(first + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '') + '\n');
    if (this.store) {
      this.store.push({
        level: this.name,
        t: Date.now(),
        prefix: this.prefix.trim(),
        site: site.replace(/: $/, ''),
        msg: text,
        first,
      });
      if (this.store.length > 300) this.store.shift();
    }
  }

  // log.Fatal: write, then exit(1).
  Fatal(msg) {
    this.write(String(msg), 0);
    process.exit(1);
  }
}

/* ------------------------------------------------------ 3.3 application struct */

class Application {
  constructor(config) {
    const logs = this.logs = [];
    this.config = config;

    // 3.2: INFO to stdout, ERROR to stderr with the calling file and line.
    this.infoLog = new Logger({ name: 'INFO', prefix: 'INFO\t', stream: process.stdout, shortfile: false, store: logs });
    this.errorLog = new Logger({ name: 'ERROR', prefix: 'ERROR\t', stream: process.stderr, shortfile: true, store: logs });

    // 3.3: dependencies live on the struct, not in globals.
    this.templateDir = config.templateDir;
    this.staticDir = config.staticDir;
    // Shared with the template loader so -template-dir and the deliberate-error
    // switch both live on the same object.
    this.config = config;

    // 8.6: one decoder for the whole application, created in main() and
    // injected here — the same shape as templateCache and the snippet model.
    this.formDecoder = require('./forms').NewDecoder();

    // The deliberate error from page 77, switchable at runtime.
    this.brokenTemplate = false;
  }

  /* ------------------------------------------- 3.4 centralised error handling */

  // serverError writes the error and a stack trace to the error log, then sends
  // a generic 500 to the user. Output(2, ...) makes the reported file:line the
  // handler's, not this helper's — the whole point of page 82.
  serverError(res, err) {
    const trace = `${err.message}\n${err.stack || ''}`;
    this.errorLog.Output(2, trace);
    this.sendText(res, 500, 'Internal Server Error');
  }

  clientError(res, status, headers) {
    this.sendText(res, status, httpStatusText(status), headers);
  }

  notFound(res) {
    this.clientError(res, 404);
  }

  sendText(res, status, body, headers) {
    const buf = Buffer.from(body + '\n', 'utf8');
    res.writeHead(status, Object.assign({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': buf.length,
      'X-Content-Type-Options': 'nosniff',
    }, headers || {}));
    res.end(buf);
  }
}

// http.StatusText, for the handful of codes the demo uses.
function httpStatusText(status) {
  return {
    200: 'OK',
    301: 'Moved Permanently',
    304: 'Not Modified',
    400: 'Bad Request',
    403: 'Forbidden',
    404: 'Page Not Found',
    405: 'Method Not Allowed',
    500: 'Internal Server Error',
  }[status] || 'Unknown Status';
}

module.exports = { parseConfig, Application, Logger, httpStatusText, timestamp };
