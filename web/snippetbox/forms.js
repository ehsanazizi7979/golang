'use strict';

/*
 * Chapter 8 of "Let's Go": processing forms.
 *
 * Three pieces of net/http behaviour the chapter depends on, reimplemented so
 * the demo can be honest about them:
 *
 *   r.ParseForm()        parses a POST body into r.PostForm (url.Values), and
 *                        returns an error for a malformed or oversized body
 *   r.PostForm.Get(k)    the first value for k, or "" when absent
 *   r.PostForm[k]        all values, for multiple-value fields like checkboxes
 *
 * plus http.MaxBytesReader and the go-playground/form decoder, which maps form
 * values onto a struct by field tag and handles the type conversions — "12"
 * becoming the int 12 — and reports invalid targets the way Go does.
 */

const DEFAULT_MAX_MEMORY = 10 * 1024 * 1024; // net/http's 10MB default

/* -------------------------------------------------------------- url.Values */

class Values {
  constructor(pairs) {
    this.map = new Map();
    for (const { key, value } of pairs || []) {
      if (!this.map.has(key)) this.map.set(key, []);
      this.map.get(key).push(value);
    }
  }

  /** Get returns the first value, or "" — exactly like url.Values.Get. */
  Get(key) {
    const v = this.map.get(key);
    return v && v.length ? v[0] : '';
  }

  /** The raw slice, as r.PostForm["items"] gives you. */
  getAll(key) {
    return (this.map.get(key) || []).slice();
  }

  has(key) {
    return this.map.has(key);
  }

  keys() {
    return [...this.map.keys()];
  }

  /** The map as a plain object, for the demo's JSON view. */
  toObject() {
    const out = {};
    for (const [k, v] of this.map) out[k] = v.slice();
    return out;
  }
}

/* -------------------------------------------------------------- ParseForm */

class FormError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormError';
  }
}

// http.MaxBytesReader's error, surfaced by ParseForm when the limit is hit.
class MaxBytesError extends FormError {
  constructor(limit) {
    super(`http: request body too large (limit ${limit} bytes)`);
    this.name = 'MaxBytesError';
    this.limit = limit;
  }
}

/**
 * parseForm(body, contentType, maxBytes) — the semantics of r.ParseForm() for
 * the two content types a plain HTML form produces.
 *
 * Returns { values } or throws a FormError, which the handler turns into a 400
 * Bad Request via app.clientError().
 */
function parseForm(body, contentType, maxBytes) {
  const limit = maxBytes || DEFAULT_MAX_MEMORY;
  const bytes = Buffer.byteLength(body || '', 'utf8');
  if (bytes > limit) throw new MaxBytesError(limit);

  const type = String(contentType || '').toLowerCase();
  if (type.startsWith('multipart/form-data')) {
    return new Values(parseMultipart(body, contentType));
  }
  // Default enctype: application/x-www-form-urlencoded.
  return new Values(parseUrlEncoded(body || ''));
}

function parseUrlEncoded(body) {
  const pairs = [];
  for (const chunk of body.split('&')) {
    if (!chunk) continue;
    const eq = chunk.indexOf('=');
    const rawKey = eq === -1 ? chunk : chunk.slice(0, eq);
    const rawVal = eq === -1 ? '' : chunk.slice(eq + 1);
    pairs.push({ key: decodeComponent(rawKey), value: decodeComponent(rawVal) });
  }
  return pairs;
}

function decodeComponent(s) {
  try {
    return decodeURIComponent(String(s).replace(/\+/g, ' '));
  } catch (e) {
    // Go returns an error for bad escapes; a demo form never sends them.
    return String(s);
  }
}

// Enough multipart parsing for a form with text fields.
function parseMultipart(body, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw new FormError('no multipart boundary param in Content-Type');
  const boundary = '--' + (m[1] || m[2]).trim();
  const pairs = [];
  for (const part of String(body).split(boundary)) {
    const idx = part.indexOf('\r\n\r\n');
    if (idx === -1) continue;
    const headers = part.slice(0, idx);
    const value = part.slice(idx + 4).replace(/\r\n$/, '');
    const name = /name="([^"]*)"/i.exec(headers);
    if (!name) continue;
    pairs.push({ key: name[1], value });
  }
  return pairs;
}

/* ------------------------------------------------ go-playground/form decoder */

/*
 * The decoder from 8.6. Struct tags say where each value goes:
 *
 *   Title   string `form:"title"`
 *   Expires int    `form:"expires"`
 *   Validator      `form:"-"`
 *
 * A missing form key is not an error — the field keeps its zero value. A value
 * that will not convert is an error, which the handler reports as a 400.
 */

class InvalidDecoderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidDecoderError';
    this.isInvalidDecoder = true;
  }
}

class DecodeError extends Error {
  constructor(field, message) {
    super(`form: cannot decode "${field}": ${message}`);
    this.name = 'DecodeError';
    this.field = field;
  }
}

class Decoder {
  constructor() {
    this.IgnoreUnknownKeys = false;
  }

  /**
   * Decode(dst, values) — dst is a plain object standing in for a pointer to a
   * struct, plus the field schema the caller registers.
   *
   * In Go the destination must be a non-nil pointer; passing anything else is a
   * programming error, which decodePostForm() turns into a panic. The demo
   * mirrors that with InvalidDecoderError.
   */
  Decode(dst, values) {
    // decodePostForm() passes &form, and Decode checks it is a non-nil pointer
    // before it looks at anything else. In Go an int or a map is a *pointer*,
    // so only nil and non-pointers fail here; a struct with no tags simply
    // decodes to nothing.
    if (!dst || typeof dst !== 'object') {
      throw new InvalidDecoderError('form: Decode target must be a non-nil pointer');
    }
    const data = values instanceof Values ? values : new Values(normalisePairs(values));
    if (!dst.__schema) return dst;  // a struct with no form tags: nothing to set.
    for (const field of dst.__schema) {
      if (field.tag === '-') continue;              // `form:"-"`
      if (!data.has(field.tag)) continue;           // absent: keep the zero value
      const raw = data.Get(field.tag);
      dst[field.name] = coerce(raw, field, dst[field.name]);
    }
    return dst;
  }
}

function normalisePairs(values) {
  // Accept a plain object or Map as well as url.Values.
  if (values instanceof Map) {
    const out = [];
    for (const [k, v] of values) out.push({ key: k, value: Array.isArray(v) ? v[0] : v });
    return out;
  }
  return Object.keys(values || {}).map((k) => ({
    key: k,
    value: Array.isArray(values[k]) ? values[k][0] : values[k],
  }));
}

// Type conversion, as the decoder does it: ints from strings, and a clear error
// when the value does not convert.
function coerce(raw, field, current) {
  switch (field.type) {
    case 'string':
      return raw;
    case 'int': {
      if (/^[+-]?\d+$/.test(String(raw).trim())) return Number(raw);
      throw new DecodeError(field.tag, `strconv.ParseInt: parsing "${raw}": invalid syntax`);
    }
    case 'bool':
      // strconv.ParseBool's set: 1 t T TRUE true True and 0 f F FALSE false
      // False. Anything else is a decode error.
      if (/^(1|t|T|TRUE|true|True)$/.test(raw)) return true;
      if (/^(0|f|F|FALSE|false|False)$/.test(raw)) return false;
      throw new DecodeError(field.tag, `strconv.ParseBool: parsing "${raw}": invalid syntax`);
    default:
      return raw;
  }
}

function NewDecoder() {
  return new Decoder();
}

/* --------------------------------------------- the snippetCreateForm struct */

const validator = require('./validator');

/*
 * type snippetCreateForm struct {
 *     Title   string             `form:"title"`
 *     Content string             `form:"content"`
 *     Expires int                `form:"expires"`
 *     validator.Validator        `form:"-"`
 * }
 *
 * The schema stands in for Go's struct tags, and the Validator is attached the
 * same way embedding would be: its methods are borrowed by the form.
 */
function newSnippetCreateForm(values) {
  const form = {
    Title: '',
    Content: '',
    Expires: 0,
    __schema: [
      { name: 'Title', tag: 'title', type: 'string' },
      { name: 'Content', tag: 'content', type: 'string' },
      { name: 'Expires', tag: 'expires', type: 'int' },
      { name: 'Validator', tag: '-', type: 'struct' },
    ],
  };

  // Embedding: the form "inherits" the Validator's fields and methods.
  const v = new validator.Validator();
  form.CheckField = v.CheckField.bind(v);
  form.AddFieldError = v.AddFieldError.bind(v);
  form.Valid = v.Valid.bind(v);
  Object.defineProperty(form, 'FieldErrors', {
    get() { return v.FieldErrors; },
    set(val) { v.FieldErrors = val; },
    enumerable: true,
  });

  if (values) {
    form.Title = values.Get('title');
    form.Content = values.Get('content');
    const raw = values.Get('expires');
    const n = Number(raw);
    form.Expires = Number.isFinite(n) && raw !== '' ? n : 0;
  }
  return form;
}

/** The four checks from page 217, in the book's order. */
function validate(form) {
  form.CheckField(validator.NotBlank(form.Title), 'title', 'This field cannot be blank');
  form.CheckField(validator.MaxChars(form.Title, 100), 'title', 'This field cannot be more than 100 characters long');
  form.CheckField(validator.NotBlank(form.Content), 'content', 'This field cannot be blank');
  form.CheckField(validator.PermittedInt(form.Expires, 1, 7, 365), 'expires', 'This field must equal 1, 7 or 365');
  return form;
}

module.exports = {
  Values,
  parseForm,
  FormError,
  MaxBytesError,
  Decoder,
  NewDecoder,
  InvalidDecoderError,
  DecodeError,
  newSnippetCreateForm,
  validate,
  DEFAULT_MAX_MEMORY,
};
