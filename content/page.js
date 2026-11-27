/* Page script for chapter-one.html — the chapters 1-3 summary.
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
