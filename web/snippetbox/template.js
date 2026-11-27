'use strict';

/*
 * Chapter 5 of "Let's Go": dynamic HTML templates.
 *
 * The book's handlers call html/template. This module is a working
 * implementation of the subset of that package the book uses, so the templates
 * in web/snippetbox/ui/html/ are the real ones and the behaviour can be
 * exercised in the browser:
 *
 *   actions     {{.Field}} {{.A.B}} {{$var}} {{if}}/{{else}}/{{else if}} {{end}}
 *               {{with}} {{range}} {{template "x" .}} {{block}} {{define}}
 *               {{break}} {{continue}}
 *   functions   eq ne lt le gt ge not and or index len printf println print
 *   pipelines   {{if .Foo | len | gt 0}}, {{humanDate .Created}}, method calls
 *   variables   {{$n := len .Snippets}}
 *   pruning     empty maps/slices/structs render as ZERO, not <nil>
 *   escaping    context-aware: HTML text, attribute, JS, CSS and URI contexts,
 *               which is why html/template stops XSS and text/template does not.
 *
 * Errors are raised as TemplateError, carrying the template name and the line
 * number inside that template, so a deliberate runtime error reports like Go's:
 *
 *   template: home.tmpl:6:8: executing "main" at <len nil>: error calling len:
 *   len of nil pointer
 */

const fs = require('fs');
const path = require('path');

class TemplateError extends Error {
  constructor(name, line, column, message) {
    super(`${name}:${line}:${column}: ${message}`);
    this.name = 'TemplateError';
    this.templateName = name;
    this.line = line;
    this.column = column;
  }
}

/* ------------------------------------------------------------------ parsing */

const KEYWORDS = ['if', 'else', 'end', 'range', 'with', 'template', 'block', 'define', 'break', 'continue'];

function parse(source, name) {
  // Tokenise into {{...}} actions and text, tracking line/column.
  const items = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const bump = (s) => {
    for (const ch of s) {
      if (ch === '\n') { line += 1; col = 1; } else { col += 1; }
    }
  };
  while (i < source.length) {
    const start = source.indexOf('{{', i);
    if (start === -1) {
      items.push({ kind: 'text', text: source.slice(i) });
      break;
    }
    if (start > i) {
      const text = source.slice(i, start);
      items.push({ kind: 'text', text });
      bump(text);
    }
    const end = source.indexOf('}}', start + 2);
    if (end === -1) throw new TemplateError(name, line, col, 'unclosed action');
    const raw = source.slice(start + 2, end);
    // {{- trims surrounding whitespace, exactly as Go does.
    const trimLeft = raw.startsWith('-');
    const trimRight = raw.endsWith('-');
    const inner = raw.replace(/^-/, '').replace(/-$/, '').trim();
    items.push({ kind: 'action', text: inner, line, col, raw });
    bump(source.slice(start, end + 2));
    i = end + 2;
    if (trimLeft && items.length > 1) {
      const prev = items[items.length - 2];
      if (prev.kind === 'text') prev.text = prev.text.replace(/\s+$/, '');
    }
    if (trimRight) {
      const m = /^\s*/.exec(source.slice(i));
      if (m) i += m[0].length;
    }
  }
  return items;
}

/** Build a tree from the flat item list: if/range/with/block/define nest. */
function buildTree(items, name) {
  let pos = 0;

  function block() {
    const nodes = [];
    while (pos < items.length) {
      const it = items[pos];
      if (it.kind === 'text') { nodes.push(it); pos += 1; continue; }
      const head = it.text;
      const kw = /^([a-zA-Z]+)\b/.exec(head);
      const word = kw ? kw[1] : null;

      if (word === 'end' || word === 'else') {
        return { nodes, stop: it };
      }
      if (word === 'if' || word === 'with' || word === 'range') {
        pos += 1;
        const branches = [];
        let cond = head.slice(word.length).trim();
        let body = block();
        branches.push({ cond, nodes: body.nodes });
        while (body.stop && body.stop.text.startsWith('else')) {
          const rest = body.stop.text.slice(4).trim();
          pos += 1;
          const inner = block();
          if (rest.startsWith('if ')) {
            // {{else if X}} — desugars to a nested if in the else slot.
            branches.push({ cond: rest.slice(3).trim(), nodes: inner.nodes, elif: true });
            body = inner;
            continue;
          }
          branches.push({ cond: null, nodes: inner.nodes, else: true });
          body = inner;
          break;
        }
        pos += 1; // consume {{end}}
        nodes.push({ kind: word, branches, line: it.line, column: it.col });
        continue;
      }
      if (word === 'define' || word === 'block') {
        const m = /^(?:define|block)\s+"([^"]+)"\s*(.*)$/.exec(head);
        if (!m) throw new TemplateError(name, it.line, it.col, 'bad ' + word + ' clause');
        pos += 1;
        const body = block();
        pos += 1;
        nodes.push({ kind: 'define', target: m[1], nodes: body.nodes,
                     invoke: word === 'block' ? m[2].trim() : null,
                     line: it.line, column: it.col });
        continue;
      }
      if (word === 'template') {
        const m = /^template\s+"([^"]+)"\s*(.*)$/.exec(head);
        if (!m) throw new TemplateError(name, it.line, it.col, 'bad template clause');
        nodes.push({ kind: 'template', target: m[1], arg: m[2].trim(), line: it.line, column: it.col });
        pos += 1;
        continue;
      }
      if (word === 'break' || word === 'continue') {
        nodes.push({ kind: word, line: it.line, column: it.col });
        pos += 1;
        continue;
      }
      nodes.push({ kind: 'action', text: head, line: it.line, column: it.col });
      pos += 1;
    }
    return { nodes, stop: null };
  }

  const { nodes } = block();
  return nodes;
}

/* --------------------------------------------------------------- evaluation */

class Break { constructor() { this.signal = 'break'; } }
class Continue { constructor() { this.signal = 'continue'; } }

// isTrue mirrors Go's "empty value" rules for if/with/and/or.
function isTrue(v) {
  if (v === null || v === undefined) return false;
  if (v === false) return false;
  if (v === 0 || v === 0n) return false;
  if (v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof Map || v instanceof Set) return v.size > 0;
  if (typeof v === 'object') {
    if (v.__goType === 'time') return true;
    // Go templates prune empty structs: an all-zero struct is "empty".
    return Object.keys(v).length > 0;
  }
  return true;
}

// splitFields splits an action body on spaces, keeping quoted strings and
// parenthesised groups together.
function splitFields(s) {
  const out = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') { cur += s[i + 1] || ''; i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === '|' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    if (/\s/.test(ch) && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// A pipeline is a list of commands separated by |, each command a list of
// space-separated terms. Splitting on | only — whitespace separates terms.
function parsePipeline(src) {
  return splitPipes(src).map((cmd) => splitTerms(cmd));
}

function splitPipes(s) {
  const out = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') { cur += s[i + 1] || ''; i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === '|' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function splitTerms(cmd) {
  const terms = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < cmd.length; i += 1) {
    const ch = cmd[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') { cur += cmd[i + 1] || ''; i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '(') { depth += 1; cur += ch; continue; }
    if (ch === ')') { depth -= 1; cur += ch; continue; }
    if (/\s/.test(ch) && depth === 0) {
      if (cur) terms.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) terms.push(cur);
  return terms;
}

class ExecContext {
  constructor(tmpl, dot, funcs, depth) {
    this.tmpl = tmpl;
    this.dot = dot;
    this.vars = new Map();
    this.funcs = funcs;
    this.depth = depth || 0;
    this.sink = null;
  }

  child(dot) {
    const c = new ExecContext(this.tmpl, dot, this.funcs, this.depth);
    c.vars = new Map(this.vars);
    c.sink = this.sink; // streaming applies to the whole template tree
    return c;
  }
}

function goTypeName(v) {
  if (v === null || v === undefined) return 'nil';
  if (Array.isArray(v)) return 'slice';
  if (typeof v === 'object') return 'struct';
  return typeof v;
}

function evalTerm(term, ctx, node) {
  if (term.startsWith('(') && term.endsWith(')')) {
    const inner = term.slice(1, -1).trim();
    const pipe = parsePipeline(inner);
    return evalPipeline(pipe, ctx, node, true);
  }
  if (term.startsWith('"') || term.startsWith('`')) {
    return term.slice(1, -1);
  }
  if (term === 'true') return true;
  if (term === 'false') return false;
  if (term === 'nil') return null;
  if (/^-?\d+$/.test(term)) return Number(term);
  if (/^-?\d+\.\d+$/.test(term)) return Number(term);
  if (term.startsWith('.')) {
    return evalFieldPath(ctx.dot, term, ctx, node);
  }
  if (term.startsWith('$')) {
    const m = /^\$([A-Za-z0-9_]*)(.*)$/.exec(term);
    const name = m[1];
    if (name === '' && m[2] === '') return ctx.dot;
    if (!ctx.vars.has(name)) {
      throw new TemplateError(ctx.tmpl, node.line, node.column,
        `undefined variable "$${name}"`);
    }
    return evalFieldPath(ctx.vars.get(name), m[2], ctx, node);
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(term)) {
    // A bare identifier is a function call with no arguments only if it is
    // registered; otherwise it is a field of dot.
    if (ctx.funcs[term]) return ctx.funcs[term]();
    return evalFieldPath(ctx.dot, term, ctx, node);
  }
  throw new TemplateError(ctx.tmpl, node.line, node.column, `bad character ${JSON.stringify(term[0])}`);
}

// A field path may be ".Title", ".Snippet.ID" or "" (dot itself).
function evalFieldPath(base, pathStr, ctx, node) {
  if (!pathStr || pathStr === '.') return base;
  const parts = pathStr.replace(/^\./, '').split('.');
  let cur = base;
  let walked = pathStr.startsWith('.') ? '' : null;
  for (const part of parts) {
    if (!part) continue;
    if (cur === null || cur === undefined) {
      throw new TemplateError(ctx.tmpl, node.line, node.column,
        `nil pointer evaluating ${goTypeName(cur)}.${part}`);
    }
    const isMethod = part.includes(' ');
    if (isMethod) {
      const [fn, ...args] = part.split(' ');
      cur = callMethod(cur, fn, args, ctx, node);
      continue;
    }
    if (typeof cur === 'object' && part in cur) {
      const v = cur[part];
      cur = typeof v === 'function' ? v.call(cur) : v;
      walked = walked === null ? part : walked + '.' + part;
      continue;
    }
    // Map semantics. Every exported struct field starts with a capital, so a
    // lowercase name that is absent can only be a missing map key — and Go
    // answers a missing map key with the zero value instead of an error. That
    // is what makes {{with .Form.FieldErrors.title}} safe when FieldErrors is
    // nil or holds no entry for "title".
    if (typeof cur === 'object' && cur !== null && /^[a-z]/.test(part)) {
      cur = undefined;
      continue;
    }
    throw new TemplateError(ctx.tmpl, node.line, node.column,
      `can't evaluate field ${part} in type ${goTypeName(cur)}`);
  }
  return cur;
}

function callMethod(obj, name, args, ctx, node) {
  const fn = obj && obj[name];
  if (typeof fn !== 'function') {
    throw new TemplateError(ctx.tmpl, node.line, node.column,
      `can't evaluate field ${name} in type ${goTypeName(obj)}`);
  }
  const values = args.map((a) => evalTerm(a, ctx, node));
  return fn.apply(obj, values);
}

const BUILTINS = {
  eq: (...a) => a.slice(1).every((v) => v === a[0]),
  ne: (a, b) => a !== b,
  lt: (a, b) => a < b,
  le: (a, b) => a <= b,
  gt: (a, b) => a > b,
  ge: (a, b) => a >= b,
  not: (a) => !isTrue(a),
  and: (...a) => { for (const v of a) if (!isTrue(v)) return v; return a[a.length - 1]; },
  or: (...a) => { for (const v of a) if (isTrue(v)) return v; return a[a.length - 1]; },
  index: (a, i) => (a == null ? undefined : a[i]),
  len: (a) => {
    if (a === null || a === undefined) throw new Error('len of nil pointer');
    if (typeof a === 'object') {
      if (Array.isArray(a)) return a.length;
      if (a instanceof Map || a instanceof Set) return a.size;
      if (typeof a.length === 'number') return a.length;
      return Object.keys(a).length;
    }
    if (typeof a === 'string') return a.length;
    throw new Error(`len of type ${goTypeName(a)}`);
  },
  print: (...a) => a.join(''),
  println: (...a) => a.join(' ') + '\n',
  printf: (fmt, ...a) => goSprintf(fmt, a),
  slice: (a, ...r) => a.slice(...r),
};

// A small fmt.Sprintf: %s %d %v %q %t, width and precision for strings.
function goSprintf(fmt, args) {
  let i = 0;
  return String(fmt).replace(/%([-+ 0#]*)(\d*)(?:\.(\d+))?([sdvqtx%])/g, (m, flags, width, prec, verb) => {
    if (verb === '%') return '%';
    const arg = args[i];
    i += 1;
    let s;
    if (verb === 'd') s = String(Math.trunc(Number(arg)));
    else if (verb === 'q') s = JSON.stringify(arg);
    else if (verb === 't') s = String(!!arg);
    else if (verb === 'x') s = Number(arg).toString(16);
    else if (verb === 'v') s = String(arg);
    else s = String(arg);
    if (prec) s = s.slice(0, Number(prec));
    if (width) s = flags.includes('-') ? s.padEnd(Number(width)) : s.padStart(Number(width));
    return s;
  });
}

function evalPipeline(commands, ctx, node, nested) {
  let value;
  let first = true;
  for (const terms of commands) {
    if (!terms.length) { value = ctx.dot; first = false; continue; }
    if (first) {
      const [head, ...args] = terms;
      const fn = ctx.funcs[head] || BUILTINS[head];
      if (fn && !(head.startsWith('.'))) {
        const argv = args.length ? args.map((t) => evalTerm(t, ctx, node))
                                 : (nodes_has_no_args(node) ? [] : []);
        try {
          value = fn(...argv);
        } catch (err) {
          throw new TemplateError(ctx.tmpl, node.line, node.column,
            `executing ${JSON.stringify(head)} at <${terms.join(' ')}>: error calling ${head}: ${err.message}`);
        }
      } else {
        value = evalTerm(head, ctx, node);
        if (args.length) {
          throw new TemplateError(ctx.tmpl, node.line, node.column, `too many arguments for ${head}`);
        }
      }
      first = false;
      continue;
    }
    // Subsequent commands receive the previous value as their final argument.
    const [head, ...args] = terms;
    const fn = ctx.funcs[head] || BUILTINS[head];
    if (!fn) {
      // A value, not a function — e.g. the first command of a nested pipeline
      // such as {{printf "%s" .Title}}.
      value = evalTerm(head, ctx, node);
      continue;
    }
    const argv = args.map((t) => evalTerm(t, ctx, node));
    argv.push(value);
    try {
      value = fn(...argv);
    } catch (err) {
      throw new TemplateError(ctx.tmpl, node.line, node.column,
        `executing ${JSON.stringify(head)} at <${terms.join(' ')}>: error calling ${head}: ${err.message}`);
    }
  }
  return value;
}

function nodes_has_no_args() { return true; }

/* --------------------------------------------------------------- rendering */

/*
 * Context-aware escaping, the heart of html/template. The parser tracks where
 * in the document we are (text, attribute, JS, CSS, URI) and applies the right
 * escaping — Go's escaper does the same analysis at parse time.
 */
function escapeHTMLText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#34;')
    .replace(/'/g, '&#39;')
    .replace(/\+/g, '&#43;');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&#34;').replace(/'/g, '&#39;').replace(/\+/g, '&#43;');
}

function escapeJS(s) {
  return JSON.stringify(String(s)).slice(1, -1)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027');
}

// Go's URL escaper (html/template urlquery): everything outside the unreserved
// set is percent-encoded — including &, =, ? and / — so a value can never
// introduce another query parameter or path segment.
function escapeURL(s) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function escapeCSS(s) {
  return String(s).replace(/[^a-zA-Z0-9]/g, (c) => '\\' + c.charCodeAt(0).toString(16) + ' ');
}

/** Works out the escaping context by scanning the emitted HTML so far. */
function contextAt(out) {
  const lastOpen = out.lastIndexOf('<');
  const lastClose = out.lastIndexOf('>');
  // Inside <script>...</script> the whole body is a JavaScript context, not an
  // attribute context — Go's escaper makes the same distinction.
  const scriptOpen = out.toLowerCase().lastIndexOf('<script');
  const scriptClose = out.toLowerCase().lastIndexOf('</script');
  if (scriptOpen > scriptClose) {
    const tag = out.slice(scriptOpen);
    // Attributes of the <script> tag itself (src=...) are still attributes;
    // once the opening tag is closed, everything is JavaScript.
    if (tag.lastIndexOf('>') === -1) {
      if (/(?:src|href)\s*=\s*["']?[^"'>]*$/i.test(tag)) return 'url';
      return 'attr';
    }
    return 'js';
  }
  const styleOpen = out.toLowerCase().lastIndexOf('<style');
  const styleClose = out.toLowerCase().lastIndexOf('</style');
  if (styleOpen > styleClose) {
    const tag = out.slice(styleOpen);
    if (tag.lastIndexOf('>') === -1) return 'attr';
    return 'css';
  }
  if (lastOpen > lastClose) {
    const tag = out.slice(lastOpen);
    // The URI context ends at the closing quote (or at '>' for unquoted
    // attributes) — Go treats the whole attribute as one URI context.
    const attr = /(?:href|src|action|formaction)\s*=\s*(["'])([^"']*)$/i.exec(tag);
    if (attr) return 'url';
    if (/(?:href|src|action|formaction)\s*=\s*[^"'\s>]*$/i.test(tag)) return 'url';
    return 'attr';
  }
  return 'html';
}

function stringify(v, ctx, node, ex) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) {
    // Go prints [a b c] for a slice of strings.
    return '[' + v.map((x) => stringify(x, 'html', node, ex)).join(' ') + ']';
  }
  if (typeof v === 'object') {
    if (v.__goType === 'time') return v.String();
    // Pruning: an empty struct renders as ZERO, as in the book.
    if (Object.keys(v).length === 0) return 'ZERO';
    return String(v);
  }
  return String(v);
}

function renderNodes(nodes, ctx, out, node0) {
  for (const node of nodes) {
    if (node.kind === 'text') { emit(ctx, out, node.text); continue; }

    if (node.kind === 'if') {
      let done = false;
      for (const br of node.branches) {
        if (br.else) { renderNodes(br.nodes, ctx, out); done = true; break; }
        const pipe = parsePipeline(br.cond);
        const v = evalPipeline(pipe, ctx, node);
        if (isTrue(v)) { renderNodes(br.nodes, ctx, out); done = true; break; }
      }
      continue;
    }

    if (node.kind === 'with') {
      let done = false;
      for (const br of node.branches) {
        if (br.else) { renderNodes(br.nodes, ctx, out); done = true; break; }
        const v = evalPipeline(parsePipeline(br.cond), ctx, node);
        if (isTrue(v)) {
          renderNodes(br.nodes, ctx.child(v), out);
          done = true;
          break;
        }
      }
      continue;
    }

    if (node.kind === 'range') {
      let done = false;
      for (const br of node.branches) {
        if (br.else) { renderNodes(br.nodes, ctx, out); done = true; break; }
        const v = evalPipeline(parsePipeline(br.cond), ctx, node);
        if (!isTrue(v)) continue;
        const items = Array.isArray(v) ? v
          : (v instanceof Map ? [...v.values()] : Object.values(v));
        for (const item of items) {
          try {
            renderNodes(br.nodes, ctx.child(item), out);
          } catch (e) {
            if (e instanceof Break) break;
            if (e instanceof Continue) continue;
            throw e;
          }
        }
        done = true;
        break;
      }
      if (!done) {
        for (const br of node.branches) if (br.else) { renderNodes(br.nodes, ctx, out); break; }
      }
      continue;
    }

    if (node.kind === 'break') throw new Break();
    if (node.kind === 'continue') throw new Continue();

    if (node.kind === 'define') {
      if (node.invoke) {
        // {{block "x" .}} is define + template in one.
        renderTemplate(node.target, node.invoke, ctx, out, node);
      }
      continue;
    }

    if (node.kind === 'template') {
      renderTemplate(node.target, node.arg, ctx, out, node);
      continue;
    }

    // A plain action: {{.Field}}, {{humanDate .Created}}, {{$x := ...}}.
    const text = node.text;
    const assign = /^\$([A-Za-z0-9_]+)\s*:?=\s*(.*)$/.exec(text);
    if (assign) {
      const v = evalPipeline(parsePipeline(assign[2]), ctx, node);
      ctx.vars.set(assign[1], v);
      continue;
    }
    const v = evalPipeline(parsePipeline(text), ctx, node);
    emit(ctx, out, escapeFor(v, out, node, ctx));
  }
}

/*
 * emit records output for context tracking and, when the template is being
 * executed with a live sink, writes it to the client immediately — which is
 * exactly why a single-stage render leaves a half-written page behind.
 */
function emit(ctx, out, str) {
  out.push(str);
  if (ctx.sink) ctx.sink(str);
}

function escapeFor(v, out, node, ctx) {
  if (v === null || v === undefined) return '';
  const ctxName = contextAt(out.join(''));
  const s = stringify(v, ctxName, node, ctx);
  switch (ctxName) {
    case 'attr': return escapeAttr(s);
    case 'js': return escapeJS(s);
    case 'css': return escapeCSS(s);
    case 'url': return escapeURL(s);
    default: return escapeHTMLText(s);
  }
}

function renderTemplate(target, argSrc, ctx, out, node) {
  const def = ctx.tmpl.templates.get(target);
  if (!def) {
    throw new TemplateError(ctx.tmpl, node.line, node.column,
      `template: no template "${target}" associated with template "base"`);
  }
  let dot = ctx.dot;
  if (argSrc) dot = evalPipeline(parsePipeline(argSrc), ctx, node);
  const sub = new ExecContext(ctx.tmpl, dot, ctx.funcs, ctx.depth + 1);
  sub.sink = ctx.sink;
  if (ctx.depth > 20) throw new TemplateError(ctx.tmpl, node.line, node.column, 'template: recursion detected');
  renderNodes(def.nodes, sub, out);
}

/* ------------------------------------------------------------- the template */

class Template {
  constructor(name, funcs) {
    this.name = name;
    this.funcs = Object.assign({}, funcs || {});
    this.templates = new Map();
  }

  toString() { return this.name; }

  Funcs(map) {
    Object.assign(this.funcs, map);
    return this;
  }

  // ParseFiles adds every {{define}} block in the given files.
  ParseFiles(...files) {
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const base = path.basename(f);
      const items = parse(src, base);
      const nodes = buildTree(items, base);
      this.collect(nodes, base);
      // In Go, the file's own name becomes a template if it has no {{define}}.
      if (!nodes.some((n) => n.kind === 'define')) this.templates.set(base, { nodes });
    }
    return this;
  }

  collect(nodes, name) {
    for (const n of nodes) {
      if (n.kind === 'define') {
        this.templates.set(n.target, { nodes: n.nodes, name });
        this.collect(n.nodes, name);
      } else if (n.kind === 'template' || n.kind === 'block') {
        if (n.nodes) this.collect(n.nodes, name);
      }
    }
  }

  /**
   * Streaming executes the template straight through to w, chunk by chunk, the
   * way Go's ExecuteTemplate does. Used to show the half-written 200 response
   * from page 150, before the book introduces the buffer.
   */
  Streaming(on) {
    this.streaming = on !== false;
    return this;
  }

  /** Parse template source held in memory, as {{define}} blocks or bare text. */
  parseInline(source, name) {
    const nm = name || this.name;
    const items = parse(source, nm);
    const nodes = buildTree(items, nm);
    this.collect(nodes, nm);
    if (!nodes.some((n) => n.kind === 'define')) this.templates.set(nm, { nodes });
    return this;
  }

  // ExecuteTemplate(w, name, data) — or ExecuteTemplate(name, data) for the
  // in-memory convenience form used by the sandbox.
  ExecuteTemplate(w, name, data) {
    if (typeof w === 'string' && arguments.length === 2) {
      data = name;
      name = w;
      w = null;
    }
    const def = this.templates.get(name);
    if (!def) {
      throw new TemplateError(name, 0, 0, `template: no template "${name}" associated with template "${this.name}"`);
    }
    const out = [];
    const ctx = new ExecContext(this, data, this.funcs, 0);
    if (w && typeof w.write === 'function' && this.streaming) ctx.sink = (str) => w.write(str);
    renderNodes(def.nodes, ctx, out);
    const body = out.join('');
    if (w && typeof w.write === 'function') w.write(body);
    return body;
  }

  Execute(w, data) {
    const firstName = [...this.templates.keys()][0];
    return this.ExecuteTemplate(w, firstName, data);
  }
}

/** template.New(name).Funcs(functions).ParseFiles(...) */
function New(name) {
  return new Template(name);
}

/** glob() like filepath.Glob, relative to a root. */
function glob(pattern, root) {
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  const abs = path.join(root, dir);
  let entries;
  try {
    entries = fs.readdirSync(abs);
  } catch (e) {
    return [];
  }
  const re = new RegExp('^' + base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return entries.filter((f) => re.test(f)).sort().map((f) => path.join(dir, f));
}

module.exports = { Template, New, glob, TemplateError, escapeHTMLText, isTrue, goSprintf };
