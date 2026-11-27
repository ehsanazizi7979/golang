'use strict';

/*
 * internal/validator — chapter 8.5.
 *
 * Go's version is a struct wrapping map[string]string with small helper
 * functions. The behaviour that matters, and that the demo exercises:
 *
 *   CheckField(ok, key, message)  adds an error only if the check failed
 *   AddFieldError(key, msg)       never overwrites an existing message
 *   Valid()                       true when there are no errors at all
 *
 * The helper predicates are the same three the book writes: NotBlank() (after
 * strings.TrimSpace), MaxChars() (counting *characters*, not bytes — "Zoë" is 3
 * characters and 4 bytes), and PermittedInt().
 */

class Validator {
  constructor() {
    // A nil map in Go still answers lookups with the zero value, so
    // {{with .Form.FieldErrors.title}} renders nothing rather than failing.
    // An empty object reproduces that exactly.
    this.FieldErrors = {};
  }

  /** Valid reports whether there are no field errors. */
  Valid() {
    return Object.keys(this.FieldErrors).length === 0;
  }

  /** AddFieldError adds a message, but never replaces an existing one. */
  AddFieldError(key, message) {
    if (!(key in this.FieldErrors)) this.FieldErrors[key] = message;
  }

  /** CheckField adds an error only when the check does not pass. */
  CheckField(ok, key, message) {
    if (!ok) this.AddFieldError(key, message);
  }

  /** The errors, always as an object — convenient for templates. */
  errors() {
    return this.FieldErrors;
  }
}

/* --------------------------------------------------------- the check helpers */

// NotBlank: strings.TrimSpace(value) != "" (space, tab, newline, CR, vertical
// tab and form feed are trimmed, matching Go's unicode.IsSpace for ASCII).
function TrimSpace(value) {
  return String(value).replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '');
}

function NotBlank(value) {
  return TrimSpace(value) !== '';
}

// MaxChars counts runes, not bytes: [...value] iterates code points.
function MaxChars(value, n) {
  return [...String(value)].length <= n;
}

function PermittedInt(value, ...permitted) {
  return permitted.includes(Number(value));
}

module.exports = { Validator, NotBlank, MaxChars, PermittedInt, TrimSpace };
