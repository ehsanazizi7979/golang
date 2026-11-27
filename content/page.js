/* Page script for chapter-one.html — the chapters 1-8 summary.
 *
 * Kept as a real .js file (rather than a Python string) so the escaping is
 * unambiguous; build_chapter1.py inlines it into the generated page. */

(function () {
  var DEMO = 'http://localhost:__PORT__';
  if (location.port === '__PORT__') DEMO = location.origin;
  if (location.protocol === 'https:' && DEMO.indexOf('http://localhost') === 0) DEMO = location.origin;

  // Point every absolute demo link at the right origin.
  document.querySelectorAll('a[href^="http://localhost:__PORT__"]').forEach(function (a) {
    a.href = DEMO + a.getAttribute('href').replace('http://localhost:__PORT__', '');
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function statusClass(s) { return s < 300 ? 'ok' : s < 400 ? 'warn' : 'bad'; }

  function request(spec) {
    return fetch(DEMO + spec.path, {
      method: spec.method || 'GET',
      headers: spec.headers || {},
      cache: 'no-store'
    }).then(function (res) {
      return res.text().then(function (body) {
        var head = [];
        ['content-type', 'content-length', 'allow', 'last-modified', 'content-range',
         'accept-ranges', 'location', 'date'].forEach(function (h) {
          var v = res.headers.get(h);
          if (v) head.push(h + ': ' + v);
        });
        return { status: res.status, text: res.statusText, body: body, head: head, spec: spec };
      });
    });
  }

  function paint(slot, r, method, path) {
    var shown = r.body;
    if (shown.length > 1400) shown = shown.slice(0, 1400) + ' ... (' + r.body.length + ' bytes total)';
    slot.hidden = false;
    slot.innerHTML =
      '<div class="resp__bar"><span class="status ' + statusClass(r.status) + '">' + r.status + ' ' + esc(r.text) + '</span>' +
        '<span style="margin-left:auto;color:#6d7c84">' + esc(method + ' ' + path) + '</span></div>' +
      '<pre>' + (esc(shown) || '(empty body)') + '</pre>' +
      '<div class="meta">' + r.head.map(esc).join('\n') + '</div>' +
      '<div class="meta">$ curl -i ' + (method !== 'GET' ? '-X ' + esc(method) + ' ' : '') + esc(DEMO + path) + '</div>';
  }

  function message(slot, status, label, note) {
    slot.hidden = false;
    slot.innerHTML =
      '<div class="resp__bar"><span class="status ' + statusClass(status) + '">' + esc(status + ' ' + label) + '</span></div>' +
      '<pre>' + esc(note) + '</pre>';
  }

  function fail(slot, err) {
    message(slot, 0, 'demo unreachable', 'Start the server with:  node web/server.js\n\n' + err.message);
  }

  /* ------------------------------------------------------------ chapter 2 */

  var CH2 = {
    home: { path: '/home' },
    'static': { path: '/static/' },
    css: { path: '/static/css/main.css' },
    '304': { path: '/static/css/main.css', conditional: true },
    range: { path: '/static/img/logo.svg', range: 'bytes=0-49' },
    traversal: { path: '/static/../server.js' }
  };

  document.querySelectorAll('[data-ch2]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ch2');
      var spec = Object.assign({}, CH2[key]);
      var slot = document.querySelector(key === 'home' ? '[data-ch2-slot="home"]' : '[data-ch2-slot="static"]');
      btn.disabled = true;
      slot.hidden = false;
      slot.innerHTML = '<div class="resp__bar"><span class="status">...</span>' +
        '<span style="color:#6d7c84">sending request</span></div>';

      function go(headers) {
        spec.headers = headers || {};
        request(spec).then(function (r) {
          paint(slot, r, spec.method || 'GET', spec.path);
          if (key === '304') {
            slot.querySelector('.meta').insertAdjacentHTML('afterend',
              '<div class="meta">Conditional request: the page fetched Last-Modified first, then asked again ' +
              'with If-Modified-Since. Go\'s http.FileServer answers 304 Not Modified.</div>');
          }
        }).catch(function (err) {
          fail(slot, err);
        }).then(function () { btn.disabled = false; });
      }

      if (spec.conditional) {
        fetch(DEMO + spec.path, { cache: 'no-store' }).then(function (res) {
          go({ 'If-Modified-Since': res.headers.get('last-modified') || new Date().toUTCString() });
        }).catch(function () { go({}); });
      } else if (spec.range) {
        go({ Range: spec.range });
      } else {
        go({});
      }
    });
  });

  /* ------------------------------------------------------------ chapter 3 */

  var CH3_SLOT = { traffic: 'logs', logs: 'logs', config: 'config', home: 'home' };

  document.querySelectorAll('[data-ch3]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ch3');
      var slot = document.querySelector('[data-ch3-slot="' + (CH3_SLOT[key] || 'home') + '"]');
      btn.disabled = true;
      var done = function () { btn.disabled = false; };

      if (key === 'traffic') {
        Promise.all([
          fetch(DEMO + '/home'),
          fetch(DEMO + '/static/css/main.css'),
          fetch(DEMO + '/nope')
        ]).then(function () {
          return fetch(DEMO + '/api/logs', { cache: 'no-store' });
        }).then(function (r) {
          return r.json();
        }).then(function (entries) {
          var text = entries.slice(-6).map(function (e) {
            var level = (e.level + '      ').slice(0, 7);
            var site = (e.site || '').padEnd(18);
            return level + ' ' + site + ' ' + e.msg.split('\n')[0];
          }).join('\n');
          message(slot, 200, 'log entries', text || '(no entries yet)');
        }).catch(function (err) {
          fail(slot, err);
        }).then(done);
        return;
      }

      if (key === 'logs') {
        fetch(DEMO + '/api/logs', { cache: 'no-store' }).then(function (r) {
          return r.json();
        }).then(function (entries) {
          message(slot, 200, entries.length + ' entries', JSON.stringify(entries.slice(-4), null, 2));
        }).catch(function (err) {
          fail(slot, err);
        }).then(done);
        return;
      }

      if (key === 'break-on' || key === 'break-off') {
        fetch(DEMO + '/break?toggle=' + (key === 'break-on' ? 'on' : 'off'), { cache: 'no-store' })
          .then(function (r) {
            message(slot, r.status,
              key === 'break-on' ? 'deliberate error enabled' : 'template restored',
              key === 'break-on'
                ? 'ui/html/pages/home.tmpl is now treated as missing.\nPress "GET /home" — the handler will ' +
                  'log an ERROR with its own file and line, and return a generic 500.'
                : 'ui/html/pages/home.tmpl is available again.');
          }).catch(function (err) {
            fail(slot, err);
          }).then(done);
        return;
      }

      var path = key === 'config' ? '/config' : '/home';
      fetch(DEMO + path, { cache: 'no-store' }).then(function (r) {
        return r.text().then(function (body) { return [r, body]; });
      }).then(function (pair) {
        var res = pair[0];
        var body = pair[1];
        if (key === 'config') {
          var rows = body.match(/<code>(-[a-z-]+)<\/code><\/td><td><code>([^<]+)</g) || [];
          body = rows.map(function (row) {
            var m = /<code>(-[a-z-]+)<\/code><\/td><td><code>([^<]+)</.exec(row);
            return m ? m[1] + ' = ' + m[2] : row;
          }).join('\n') || body.slice(0, 800);
        } else if (body.length > 1200) {
          body = body.slice(0, 1200) + ' ... (' + body.length + ' bytes total)';
        }
        message(slot, res.status, res.statusText, body);
      }).catch(function (err) {
        fail(slot, err);
      }).then(done);
    });
  });

  /* ------------------------------------------------------------ chapter 1 */

  function slotFor(key) {
    if (key === 'GET /') return document.querySelector('[data-slot="home"]');
    if (key.indexOf('/snippet/view') > -1) return document.querySelector('[data-slot="view"]');
    return document.querySelector('[data-slot="create"]');
  }

  function run(spec, btn) {
    var parts = spec.split(' ');
    var method = parts[0];
    var path = parts[1];
    var slot = slotFor(spec);
    btn.disabled = true;
    slot.hidden = false;
    slot.innerHTML = '<div class="resp__bar"><span class="status">...</span>' +
      '<span style="color:#6d7c84">sending request</span></div>';
    request({ path: path, method: method }).then(function (r) {
      paint(slot, r, method, path);
      if (r.status === 405) {
        slot.querySelector('.meta').insertAdjacentHTML('afterend',
          '<div class="meta">Note the Allow header — the book adds it explicitly in chapter 2.4.</div>');
      }
    }).catch(function (err) {
      fail(slot, err);
    }).then(function () { btn.disabled = false; });
  }

  document.querySelectorAll('[data-run]').forEach(function (btn) {
    btn.addEventListener('click', function () { run(btn.getAttribute('data-run'), btn); });
  });

  /* ------------------------------------------------------------ chapter 4 */

  var CH4_SLOT = { params: 'sql', 'safe-inject': 'sql', 'bad-inject': 'sql',
                   get: 'model', get99: 'model', latest: 'model', create: 'model', tx: 'tx' };

  function ch4Query(mode, id) {
    return fetch(DEMO + '/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode, id: id })
    }).then(function (r) { return r.json(); });
  }

  function renderQuery(r) {
    if (!r.ok) return 'error: ' + r.error + '\n\nSQL sent:\n' + (r.sql || '');
    var out = ['SQL:  ' + r.sql];
    if (r.params && r.params.length) out.push('args: ' + JSON.stringify(r.params));
    out.push('');
    out.push(r.rows.length ? r.rows.length + ' row(s):' : '0 rows');
    r.rows.forEach(function (row) {
      out.push('  {ID:' + row.id + ' Title:' + row.title + ' Content:' + row.content +
               ' Created:' + row.created + ' Expires:' + row.expires + '}');
    });
    if (r.note) out.push('', r.note);
    return out.join('\n');
  }

  document.querySelectorAll('[data-ch4]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ch4');
      var slot = document.querySelector('[data-ch4-slot="' + (CH4_SLOT[key] || 'sql') + '"]');
      btn.disabled = true;
      var done = function () { btn.disabled = false; };

      if (key === 'get' || key === 'get99') {
        var id = key === 'get' ? 1 : 99;
        fetch(DEMO + '/snippet/view?id=' + id, { cache: 'no-store' }).then(function (r) {
          return r.text().then(function (body) { return [r, body]; });
        }).then(function (pair) {
          var res = pair[0], body = pair[1];
          if (res.status === 404) {
            message(slot, 404, 'not found',
              'Get(' + id + ') -> nil, models.ErrNoRecord\n\n' +
              'errors.Is(err, models.ErrNoRecord) is true, so snippetView()\n' +
              'calls app.notFound(w) and the response is a plain 404 —\n' +
              'exactly as an expired row behaves, because the SELECT filters\n' +
              'on  expires > UTC_TIMESTAMP() .\n\n' +
              'body: ' + body.trim());
          } else {
            message(slot, res.status, 'Get(' + id + ') -> Snippet', body.trim());
          }
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'create') {
        fetch(DEMO + '/snippet/create', { method: 'POST', redirect: 'manual' }).then(function (r) {
          var location = r.headers.get('location');
          return r.text().then(function () {
            message(slot, r.status, 'See Other',
              'POST /snippet/create\n\n' +
              'HTTP/1.1 ' + r.status + ' ' + r.statusText + '\n' +
              'Location: ' + location + '\n\n' +
              'That is snippetCreate(): Insert() returns LastInsertId(), and the\n' +
              'handler redirects to /snippet/view?id=' + (location || '').split('=')[1] + ' with\n' +
              'http.StatusSeeOther (303) — which is why `curl -iL` follows it.');
          });
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'latest') {
        fetch(DEMO + '/snippets', { cache: 'no-store' }).then(function (r) {
          return r.text().then(function (body) { return [r, body]; });
        }).then(function (pair) {
          var n = pair[1].trim().split(/\n(?=\{ID:)/).filter(Boolean).length;
          message(slot, pair[0].status, 'Latest() -> ' + n + ' snippet' + (n === 1 ? '' : 's'), pair[1].trim());
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'tx') {
        fetch(DEMO + '/api/db/transaction', { method: 'POST' }).then(function (r) {
          return r.json();
        }).then(function (r) {
          var lines = r.log.map(function (e) {
            return e.stmt + '   -- ' + e.status + (e.note ? '\n   ' + e.note : '');
          });
          lines.push('', 'committed: ' + r.committed, 'live rows after: ' + r.rowsAfter);
          message(slot, 500, 'transaction rolled back', lines.join('\n'));
        }).catch(failOn(slot)).then(done);
        return;
      }

      var mode = key === 'bad-inject' ? 'interpolated' : 'params';
      var value = (key === 'params') ? '1' : '1 OR 1=1';
      ch4Query(mode, value).then(function (r) {
        message(slot, 200,
          (r.injected ? 'injection succeeded' : 'statement executed'),
          renderQuery(r));
      }).catch(failOn(slot)).then(done);
    });
  });

  function failOn(slot) {
    return function (err) { fail(slot, err); };
  }

  /* ------------------------------------------------------------ chapter 5 */

  var CH5_SLOT = { home: 'tpl', view: 'tpl', view99: 'tpl', range: 'tpl', with: 'tpl',
                   xss: 'safe', error: 'safe' };

  function tplRun(source, data) {
    return fetch(DEMO + '/api/tplx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: source, data: JSON.stringify(data) })
    }).then(function (r) { return r.json(); });
  }

  document.querySelectorAll('[data-ch5]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ch5');
      var slot = document.querySelector('[data-ch5-slot="' + (CH5_SLOT[key] || 'tpl') + '"]');
      btn.disabled = true;
      var done = function () { btn.disabled = false; };

      if (key === 'home' || key === 'view' || key === 'view99') {
        var path = key === 'home' ? '/newsnippets'
          : key === 'view' ? '/newsnippets/view?id=1' : '/newsnippets/view?id=99';
        fetch(DEMO + path, { cache: 'no-store' }).then(function (r) {
          return r.text().then(function (body) { return [r, body]; });
        }).then(function (pair) {
          var res = pair[0], body = pair[1];
          if (res.status === 404) {
            message(slot, 404, 'not found',
              'Get(99) -> models.ErrNoRecord, so snippetView() calls app.notFound(w)\n' +
              'before any template is touched. The template cache is never consulted.');
            return;
          }
          var main = /<main>([\s\S]*?)<\/main>/.exec(body);
          var title = /<title>([\s\S]*?)<\/title>/.exec(body);
          var footer = /<footer>([\s\S]*?)<\/footer>/.exec(body);
          message(slot, res.status, key === 'home' ? 'home.tmpl rendered' : 'view.tmpl rendered',
            '<title>' + (title ? title[1].trim() : '') + '</title>\n\n' +
            (main ? main[1].trim() : body.trim()) +
            '\n\n<footer>' + (footer ? footer[1].trim().replace(/\s+/g, ' ') : '') + '</footer>');
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'range') {
        tplRun('{{range .Snippets}}<tr><td>{{.Title}}</td><td>{{humanDate .Created}}</td></tr>\n{{else}}<p>There is nothing to see here... yet!</p>\n{{end}}',
          { Snippets: [
              { Title: 'O snail', Created: '2022-04-05T07:32:45Z' },
              { Title: 'An old silent pond', Created: '2022-04-05T07:20:05Z' },
              { Title: 'An old silent pond', Created: '2022-04-05T07:20:05Z', ID: 1 } ] })
          .then(function (r) {
            message(slot, 200, 'range over 3 snippets', r.ok ? r.html : 'ERROR\n' + r.error);
          }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'with') {
        tplRun('{{with .Snippet}}\n  <strong>{{.Title}}</strong> #{{.ID}}\n  Created: {{humanDate .Created}}\n{{else}}\n  no snippet\n{{end}}\n\n{{with .Missing}}x{{else}}dot unchanged where .Missing is nil{{end}}',
          { Snippet: { ID: 1, Title: 'An old silent pond', Created: '2022-04-05T07:20:05Z' }, Missing: null })
          .then(function (r) {
            message(slot, 200, 'with changes dot', r.ok ? r.html : 'ERROR\n' + r.error);
          }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'xss') {
        // Split literals: a literal closing script tag inside a string would
        // terminate the page's script element early.
        var payload = '<' + 'script>alert(\'xss attack\')<' + '/script>';
        tplRun('<p>{{.Payload}}</p>', { Payload: payload })
          .then(function (r) {
            message(slot, 200, 'html/template escaped it',
              'value yielded:  ' + payload + '\n\n' +
              'html/template:  ' + (r.ok ? r.html : r.error) + '\n\n' +
              'text/template would have emitted the ' + '<' + 'script>' + ' tag verbatim.\n' +
              'Go also chooses the escaper by context — HTML text, attribute,\n' +
              'URI, JS or CSS — so the same value is escaped five ways.');
          }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'error') {
        fetch(DEMO + '/tplx/error', { cache: 'no-store' }).then(function (r) {
          return r.text();
        }).then(function (body) {
          var m = /template: home\.tmpl[^<"]*/.exec(body);
          var chunks = /(\d+) chunks were written/.exec(body);
          message(slot, 500, 'half-written 200 -> clean 500',
            'The one-stage render had already sent "200 OK" and\n' +
            (chunks ? chunks[1] : '?') + ' chunks of markup when {{len nil}} failed.\n\n' +
            'The error:\n  ' + (m ? m[0].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : 'home.tmpl:5:5') + '\n\n' +
            'The two-stage render writes to a bytes.Buffer first, so\n' +
            'the buffer is discarded and the user gets a plain 500\n' +
            'instead of half a page with the wrong status code.');
        }).catch(failOn(slot)).then(done);
        return;
      }
    });
  });

  /* ------------------------------------------------------------ chapter 6 */

  var CH6_SLOT = { trace: 'chain', headers: 'chain', panic: 'panic' };

  document.querySelectorAll('[data-ch6]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ch6');
      var slot = document.querySelector('[data-ch6-slot="' + (CH6_SLOT[key] || 'chain') + '"]');
      btn.disabled = true;
      var done = function () { btn.disabled = false; };

      if (key === 'trace') {
        fetch(DEMO + '/api/mw/trace', { cache: 'no-store' }).then(function (r) {
          return r.json();
        }).then(function (d) {
          var depth = { recoverPanic: 0, logRequest: 1, secureHeaders: 2, servemux: 3, 'application handler': 4 };
          var lines = d.events.map(function (e) {
            var pad = new Array((depth[e.mw] || 0) + 1).join('  ');
            var arrow = (e.phase === 'down' || e.phase === 'in') ? '\u2193' : '\u2191';
            return pad + arrow + ' ' + e.mw + ' (' + e.phase + ')';
          });
          lines.push('', 'order: ' + d.architecture, '');
          Object.keys(d.headers).forEach(function (k) {
            lines.push(k + ': ' + d.headers[k]);
          });
          message(slot, 200, 'chain executed', lines.join('\n'));
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'headers') {
        // A real XHR through the chain, showing the headers that arrive.
        fetch(DEMO + '/newsnippets', { cache: 'no-store' }).then(function (r) {
          var head = [];
          ['content-security-policy', 'referrer-policy', 'x-content-type-options',
           'x-frame-options', 'x-xss-protection'].forEach(function (h) {
            var v = r.headers.get(h);
            if (v) head.push(h + ': ' + v);
          });
          return r.text().then(function (body) {
            var title = /<title>([\s\S]*?)<\/title>/.exec(body);
            message(slot, r.status, 'GET /newsnippets',
              'status: ' + r.status + '\n\n' + head.join('\n') +
              '\n\nbody begins with the cached templates:\n  ' +
              (title ? '<title>' + title[1].trim() + '</title>' : '(no title)'));
          });
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'panic') {
        fetch(DEMO + '/api/mw/panic', { cache: 'no-store' }).then(function (r) {
          return r.json();
        }).then(function (d) {
          var a = d.recovered, b = d.bare, lines = [];
          lines.push('--- without recoverPanic() ---');
          lines.push('  status:  ' + (b.status === 0 ? 'none' : b.status));
          lines.push('  body:    ' + b.body);
          lines.push('  events:  ' + (b.events.length
            ? b.events.map(function (e) { return e.mw; }).join(' -> ')
            : '(none — the panic took the whole chain with it)'));
          lines.push('');
          lines.push('--- with recoverPanic() ---');
          lines.push('  status:  ' + a.status + ' ' + a.body);
          lines.push('  Connection: ' + (a.connection || '(unset)'));
          lines.push('  events:  ' + a.events.map(function (e) {
            return e.mw + '(' + e.phase + ')';
          }).join(' -> '));
          lines.push('');
          lines.push('  headers on the 500:');
          Object.keys(a.headers).forEach(function (k) {
            lines.push('    ' + k + ': ' + a.headers[k]);
          });
          message(slot, 500, 'panic: oops! something went wrong', lines.join('\n'));
        }).catch(failOn(slot)).then(done);
        return;
      }
    });
  });

  /* ------------------------------------------------------------ chapter 7 */

  var CH7_SLOT = { view: 'routing', wrongmethod: 'routing', missing: 'routing', create: 'routing',
                   probe1: 'probe', probe2: 'probe', probe3: 'probe', probe4: 'probe' };

  function probeRoute(path, method) {
    return fetch(DEMO + '/api/router/match?path=' + encodeURIComponent(path) + '&method=' + method,
      { cache: 'no-store' }).then(function (r) { return r.json(); });
  }

  function renderProbe(d) {
    var lines = [d.method + ' ' + d.path, ''];
    lines.push('status:  ' + d.status);
    if (d.pattern) lines.push('pattern: ' + d.pattern);
    if (d.params && d.params.length) {
      lines.push('params:  ' + d.params.map(function (x) {
        return x.key + '=' + JSON.stringify(x.value);
      }).join(', '));
    }
    if (d.allow) lines.push('Allow:   ' + d.allow);
    if (d.note) lines.push('', d.note);
    return lines.join('\n');
  }

  document.querySelectorAll('[data-ch7]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ch7');
      var slot = document.querySelector('[data-ch7-slot="' + (CH7_SLOT[key] || 'routing') + '"]');
      btn.disabled = true;
      var done = function () { btn.disabled = false; };

      var probes = {
        probe1: ['/snippet/view/1', 'GET'],
        probe2: ['/snippet/view/abc', 'GET'],
        probe3: ['/snippet/view/1/extra', 'GET'],
        probe4: ['/snippet/create', 'POST']
      };
      if (probes[key]) {
        probeRoute(probes[key][0], probes[key][1]).then(function (d) {
          message(slot, d.status, 'router.match', renderProbe(d));
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'view') {
        fetch(DEMO + '/clean/snippet/view/1', { cache: 'no-store' }).then(function (r) {
          return r.text().then(function (body) { return [r, body]; });
        }).then(function (pair) {
          var main = /<main>([\s\S]*?)<\/main>/.exec(pair[1]);
          var title = /<title>([\s\S]*?)<\/title>/.exec(pair[1]);
          message(slot, pair[0].status, 'clean URL resolved',
            '<title>' + (title ? title[1].trim() : '') + '</title>\n\n' +
            'The id came from the path, via\n' +
            'router.ParamsFromContext(r.Context()).ByName("id"),\n' +
            'not from r.URL.Query().Get("id").\n\n' +
            (main ? main[1].trim() : ''));
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'wrongmethod') {
        fetch(DEMO + '/clean/snippet/view/1', {
          method: 'POST', cache: 'no-store', redirect: 'manual'
        }).then(function (r) {
          return r.text().then(function (body) { return [r, body]; });
        }).then(function (pair) {
          message(slot, pair[0].status, 'Method Not Allowed',
            'POST /clean/snippet/view/1\n\n' +
            'HTTP/1.1 ' + pair[0].status + ' ' + pair[0].statusText + '\n' +
            'Allow: ' + (pair[0].headers.get('allow') || 'GET, OPTIONS') + '\n\n' +
            pair[1].trim() + '\n\n' +
            'The route only accepts GET, so httprouter answers 405 and\n' +
            'lists what would work. The handler was never called.');
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'missing') {
        fetch(DEMO + '/clean/missing', { cache: 'no-store' }).then(function (r) {
          return r.text().then(function (body) { return [r, body]; });
        }).then(function (pair) {
          message(slot, pair[0].status, 'custom 404 handler',
            'GET /clean/missing\n\n' +
            'No pattern matches, so httprouter calls router.NotFound,\n' +
            'which wraps app.notFound(). Before section 7.2 set that\n' +
            'field this returned "404 page not found" while\n' +
            '/clean/snippet/view/99 returned "Not Found".\n\n' +
            'body: ' + pair[1].trim());
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'create') {
        fetch(DEMO + '/clean/snippet/create', {
          method: 'POST', cache: 'no-store', redirect: 'manual'
        }).then(function (r) {
          var location = r.headers.get('location');
          return r.text().then(function () {
            message(slot, r.status, 'See Other',
              'POST /clean/snippet/create\n\n' +
              'HTTP/1.1 ' + r.status + ' ' + r.statusText + '\n' +
              'Location: ' + location + '\n\n' +
              'snippetCreatePost() inserts and redirects with\n' +
              'http.StatusSeeOther. Note the redirect uses the clean\n' +
              'URL format: /snippet/view/' + (location || '').split('/').pop() +
              ' instead of ?id=' + (location || '').split('/').pop() + '.\n\n' +
              'There is no method check in the handler any more —\n' +
              'httprouter dispatched GET here and POST to\n' +
              'snippetCreatePost, from the same pattern.');
          });
        }).catch(failOn(slot)).then(done);
        return;
      }
    });
  });


  /* ------------------------------------------------------------ chapter 8 */

  var CH8_SLOT = { get: 'pgr', valid: 'pgr', blank: 'pgr', long: 'pgr', atoi: 'pgr',
                   rune: 'rune', bytelimit: 'rune',
                   decode: 'decode', invalid: 'decode', multipart: 'decode' };

  function postForm(path, body) {
    return fetch(DEMO + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
      cache: 'no-store',
      redirect: 'manual'
    }).then(function (res) {
      return res.text().then(function (text) {
        return { status: res.status, text: res.statusText, body: text, res: res };
      });
    });
  }

  function formErrors(html) {
    var out = [];
    var re = /<label class='error'>([\s\S]*?)<\/label>/g;
    var m;
    while ((m = re.exec(html)) !== null) out.push(m[1].trim());
    return out;
  }

  function repopulated(html) {
    var title = /name='title' value='([^']*)'/.exec(html);
    var content = /<textarea name='content'>([\s\S]*?)<\/textarea>/.exec(html);
    var checked = /name='expires' value='(\d+)' checked/.exec(html);
    return {
      title: title ? title[1] : null,
      content: content ? content[1] : null,
      expires: checked ? checked[1] : null
    };
  }

  function ch8Post(slot, key, body, describe, done) {
    postForm('/newsnippet/create', body).then(function (r) {
      var head = ['POST /newsnippet/create', '', 'HTTP/1.1 ' + r.status + ' ' + r.text];
      var loc = r.res.headers.get('location');
      if (loc) head.push('Location: ' + loc);
      head.push('');
      var lines = (describe || []).slice();
      if (r.status === 303) {
        lines.push('The snippet was inserted and the response is a redirect.');
        lines.push('The browser will GET ' + loc + ' next — that is the');
        lines.push('"redirect" half of Post-Redirect-Get. The POST response');
        lines.push('itself has no body, so a refresh cannot resubmit.');
      } else if (r.status === 422) {
        var errs = formErrors(r.body);
        var re = repopulated(r.body);
        lines.push('Re-rendered create.tmpl with 422 Unprocessable Entity.');
        lines.push('');
        lines.push('field errors shown:');
        if (!errs.length) lines.push('  (none)');
        errs.forEach(function (e) { lines.push('  "label class=\'error\'" -> ' + e); });
        lines.push('');
        lines.push('re-populated from the submission:');
        lines.push('  value=\'' + (re.title === null ? '(absent)' : re.title) + '\'');
        lines.push('  <textarea> ' + JSON.stringify(re.content === null ? '' : re.content));
        lines.push('  checked: expires=' + (re.expires === null ? '(none)' : re.expires));
      } else if (r.status === 400) {
        lines.push('400 Bad Request. ParseForm() or Decode() failed, so the');
        lines.push('handler returned before any validation ran.');
      }
      message(slot, r.status, labelFor(r.status), head.join('\n') + '\n' + lines.join('\n'));
    }).catch(failOn(slot)).then(done);
  }

  function labelFor(status) {
    return { 200: 'OK', 303: 'See Other', 400: 'Bad Request',
             422: 'Unprocessable Entity', 500: 'Internal Server Error' }[status] || 'response';
  }

  function ch8Api(slot, kind, payload, note, done) {
    fetch(DEMO + '/api/forms/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ kind: kind }, payload || {})),
      cache: 'no-store'
    }).then(function (r) { return r.json(); }).then(function (d) {
      message(slot, d.status, d.label, (note ? note + '\n\n' : '') + d.text);
    }).catch(failOn(slot)).then(done);
  }

  document.querySelectorAll('[data-ch8]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ch8');
      var slot = document.querySelector('[data-ch8-slot="' + (CH8_SLOT[key] || 'pgr') + '"]');
      btn.disabled = true;
      var done = function () { btn.disabled = false; };

      if (key === 'get') {
        fetch(DEMO + '/newsnippet/create', { cache: 'no-store' }).then(function (r) {
          return r.text().then(function (body) { return [r, body]; });
        }).then(function (pair) {
          var re = repopulated(pair[1]);
          message(slot, pair[0].status, 'the blank form',
            'GET /newsnippet/create\n\n' +
            'status: ' + pair[0].status + '\n' +
            'template: create.tmpl\n\n' +
            'expires checked by default: ' + (re.expires === null ? '(none)' : re.expires) + '\n' +
            'why: snippetCreate() sets data.Form = snippetCreateForm{Expires: 365}\n' +
            '     before rendering, so {{if (eq .Form.Expires 365)}} fires.\n\n' +
            'title value: ' + JSON.stringify(re.title || '') + '   (empty)\n' +
            'errors shown: ' + (formErrors(pair[1]).length || 0));
        }).catch(failOn(slot)).then(done);
        return;
      }

      if (key === 'valid') {
        ch8Post(slot, key, 'title=From+time+to+time&content=The+clouds+give+rest&expires=7',
          ['title=From time to time', 'content=The clouds give rest', 'expires=7', ''], done);
        return;
      }
      if (key === 'blank') {
        ch8Post(slot, key, 'title=&content=Blown+from+the+west&expires=365',
          ['title=(blank)', 'content=Blown from the west', 'expires=365', '',
           'TrimSpace(title) == "" so the first rule fires.'], done);
        return;
      }
      if (key === 'long') {
        ch8Post(slot, key, 'title=' + new Array(121).join('a') +
          '&content=Blown+from+the+west&expires=365',
          ['title=' + new Array(121).join('a').slice(0, 24) + '\u2026 (120 characters)',
           'content=Blown from the west', 'expires=365', '',
           'utf8.RuneCountInString(title) > 100, so the length rule fires.',
           'AddFieldError() refuses to overwrite, but nothing was added for',
           'blankness anyway: TrimSpace of 120 a\'s is not empty.'], done);
        return;
      }
      if (key === 'atoi') {
        ch8Post(slot, key, 'title=Hi&content=There&expires=abc',
          ['title=Hi', 'content=There', 'expires=abc', '',
           'The decoder cannot turn "abc" into the int field, so it returns',
           'a DecodeError before validation — a client error, so 400.'], done);
        return;
      }

      if (key === 'rune') {
        ch8Api(slot, 'runes', { text: new Array(101).join('\u00eb') }, null, done);
        return;
      }
      if (key === 'bytelimit') {
        ch8Api(slot, 'runes', { text: new Array(101).join('\u00eb'), rule: 'bytes' },
          'The same title, with the rule rewritten as a byte count:', done);
        return;
      }
      if (key === 'decode') {
        ch8Api(slot, 'decode', { title: 'O snail', content: 'Climb Mount Fuji', expires: '7' }, null, done);
        return;
      }
      if (key === 'invalid') {
        ch8Api(slot, 'invalid', null, null, done);
        return;
      }
      if (key === 'multipart') {
        ch8Api(slot, 'multipart', null, null, done);
        return;
      }
    });
  });

  /* --------------------------------------------------------- live badges */

  function badge(id) {
    var el = document.getElementById(id);
    if (!el) return;
    function ping() {
      fetch(DEMO + '/healthz', { cache: 'no-store' })
        .then(function (r) { el.textContent = r.ok ? 'demo running' : 'demo error'; })
        .catch(function () { el.textContent = 'demo offline'; });
    }
    ping();
    setInterval(ping, 10000);
  }
  badge('demoState');
  badge('ch2State');
  badge('ch3State');
  badge('ch4State');
  badge('ch5State');
  badge('ch6State');
  badge('ch7State');
  badge('ch8State');

  /* ------------------------------------------------------- replica form */

  var pub = document.getElementById('publishBtn');
  var toast = document.getElementById('toast');
  if (pub) {
    pub.addEventListener('click', function () {
      var title = document.getElementById('dTitle').value.trim();
      pub.textContent = title ? 'Publishing "' + title.slice(0, 22) + '"...' : 'Publishing...';
      setTimeout(function () {
        pub.textContent = 'Publish snippet';
        toast.textContent = 'This replica form does not store anything — snippets arrive in chapter 8.';
        toast.classList.add('on');
        setTimeout(function () { toast.classList.remove('on'); }, 2600);
      }, 700);
    });
  }

  /* ------------------------------------------- Go syntax highlighting */

  var KW = /\b(package|import|func|return|if|else|for|range|var|const|type|struct|interface|map|string|int|bool|nil|true|false|go|defer|switch|case|break|continue|make|new|byte|error|any)\b/g;

  document.querySelectorAll('pre.code').forEach(function (pre) {
    if (pre.classList.contains('is-highlighted')) return;
    pre.classList.add('is-highlighted');
    var h = esc(pre.textContent);
    h = h.replace(/(\/\/[^\n]*)/g, '<span class="com">$1</span>');
    h = h.replace(/("(?:[^"\\\n]|\\.)*")/g, '<span class="str">$1</span>');
    h = h.replace(KW, '<span class="kw">$1</span>');
    pre.innerHTML = h;
  });
})();
