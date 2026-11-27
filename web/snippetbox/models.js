'use strict';

/*
 * Chapter 4 of "Let's Go": database-driven responses.
 *
 * The book talks to MySQL through database/sql and a SnippetModel. There is no
 * MySQL (or Go) in this sandbox, so this module is a faithful stand-in: an
 * in-memory `snippets` table plus a model with the same methods and the same
 * observable behaviour as the chapter's code:
 *
 *   Insert(title, content, expires) -> LastInsertId, RowsAffected
 *   Get(id)      -> a single record, or ErrNoRecord when missing/expired
 *   Latest()     -> the 10 newest unexpired records
 *
 * It also implements the parts of database/sql the chapter explains, because
 * they are the point of the chapter:
 *
 *   - `?` placeholder parameters, so values are always data, never SQL
 *   - a statement compiler that shows *why* interpolation is dangerous
 *   - transactions (Begin/Rollback/Commit) with the all-or-nothing guarantee
 *   - a connection-pool stub with Ping() and open/in-use counters
 */

const pool = { maxOpen: 25, opened: 0, inUse: 0, maxIdle: 25 };

/* --------------------------------------------------------------- the table */

// DATETIME with second precision, like MySQL's DATETIME columns.
function now() {
  const d = new Date();
  d.setMilliseconds(0);
  return d;
}

function addDays(from, days) {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

// The three haiku the book INSERTs in section 4.1.
function seed() {
  const t = now();
  return [
    {
      id: 1,
      title: 'An old silent pond',
      content: 'An old silent pond...\nA frog jumps into the pond,\nsplash! Silence again.\n\n– Matsuo Bashō',
      created: t,
      expires: addDays(t, 365),
    },
    {
      id: 2,
      title: 'Over the wintry forest',
      content: 'Over the wintry\nforest, winds howl in rage\nwith no leaves to blow.\n\n– Natsume Soseki',
      created: t,
      expires: addDays(t, 365),
    },
    {
      id: 3,
      title: 'First autumn morning',
      content: "First autumn morning\nthe mirror I stare into\nshows my father's face.\n\n– Murakami Kijo",
      created: t,
      expires: addDays(t, 7),
    },
  ];
}

/* ---------------------------------------------------------------- the model */

// models.ErrNoRecord — the model's own error, so callers never depend on the
// datastore's error values (the book explains this on page 111).
class ModelError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelError';
  }
}

const ErrNoRecord = new ModelError('models: no matching record found');

/**
 * Stands in for a `snippets` table in MySQL.
 */
class Table {
  constructor(rows) {
    this.rows = rows.slice();
    this.nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    this.statements = 0; // "prepared statements executed"
  }

  // A row is visible only while it has not expired — the WHERE clause in every
  // SELECT in the chapter.
  live(nowDate) {
    return this.rows.filter((r) => r.expires.getTime() > nowDate.getTime());
  }
}

/**
 * SnippetModel, mirroring internal/models/snippets.go.
 */
class SnippetModel {
  constructor(table) {
    this.table = table;
    this.WasCalled = false;
  }

  // Section 4.6: Exec() with placeholder parameters.
  Insert(title, content, expires) {
    if (typeof title !== 'string' || typeof content !== 'string') {
      return [0, new ModelError('models: title and content must be strings')];
    }
    const days = Number(expires);
    if (!Number.isFinite(days) || days < 0) {
      return [0, new ModelError('models: expires must be a non-negative number of days')];
    }
    const created = now();
    const row = {
      id: this.table.nextId,
      title,
      content,
      created,
      expires: addDays(created, days),
    };
    this.table.rows.push(row);
    this.table.nextId += 1;
    this.table.statements += 1;
    return [row.id, null]; // LastInsertId(), error
  }

  // Section 4.7: QueryRow() + Scan(), returning ErrNoRecord for no rows.
  Get(id) {
    this.table.statements += 1;
    const t = now();
    const row = this.table.live(t).find((r) => r.id === Number(id));
    if (!row) return [null, ErrNoRecord];
    return [Object.assign({}, row), null];
  }

  // Section 4.8: Query() + Next()/Scan()/Err().
  Latest() {
    this.table.statements += 1;
    const rows = this.table.live(now())
      .slice()
      .sort((a, b) => b.id - a.id)
      .slice(0, 10)
      .map((r) => Object.assign({}, r));
    return [rows, null];
  }
}

/* ------------------------------------------------------- the SQL playground */

/*
 * A deliberately small SQL evaluator for the statements the chapter uses. The
 * point is not to be a database: it is to show, visibly, the difference between
 * passing values as parameters and splicing them into the SQL string.
 */

const SQL_STATEMENTS = {
  selectOne:
    /^SELECT id, title, content, created, expires FROM snippets WHERE expires > UTC_TIMESTAMP\(\) AND id = \?$/i,
  selectOneRaw:
    /^SELECT id, title, content, created, expires FROM snippets WHERE expires > UTC_TIMESTAMP\(\) AND id = (.*)$/i,
  selectLatest:
    /^SELECT id, title, content, created, expires FROM snippets WHERE expires > UTC_TIMESTAMP\(\) ORDER BY id DESC LIMIT 10$/i,
  insert:
    /^INSERT INTO snippets \(title, content, created, expires\) VALUES\s*\(\?, \?, UTC_TIMESTAMP\(\), DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL \? DAY\)\)$/i,
  del:
    /^DELETE FROM snippets WHERE id = \?$/i,
};

function formatRow(r) {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    created: r.created.toISOString().slice(0, 19).replace('T', ' '),
    expires: r.expires.toISOString().slice(0, 19).replace('T', ' '),
  };
}

/**
 * Compiles and runs one of the chapter's statements.
 *
 * mode 'params'      — values are bound to ? placeholders (submitted separately,
 *                      exactly what database/sql does)
 * mode 'interpolated' — values are spliced into the statement text, which is how
 *                      SQL injection happens
 */
function runSQL(table, sql, params, mode) {
  const query = String(sql || '').trim().replace(/\s+/g, ' ');

  if (mode === 'interpolated') {
    // Naive interpolation: the classic mistake. Each ? is replaced by the value,
    // quoted — but a value can close the quote and inject new SQL.
    let i = 0;
    const spliced = query.replace(/\?/g, () => {
      const v = params[i];
      i += 1;
      return typeof v === 'number' ? String(v) : `'${String(v)}'`;
    });

    const raw = SQL_STATEMENTS.selectOneRaw.exec(spliced);
    if (raw) {
      const expr = raw[1].trim();
      let rows;
      if (/^\d+$/.test(expr)) {
        rows = table.live(now()).filter((r) => r.id === Number(expr));
      } else if (/^'[^']*'\s+OR\s+1\s*=\s*1$/i.test(expr) || /OR\s+1\s*=\s*1/i.test(expr)) {
        // Injection succeeded: the WHERE clause now matches every live row.
        rows = table.live(now());
      } else if (/^\d+\s+OR\s+1\s*=\s*1$/i.test(expr)) {
        rows = table.live(now());
      } else {
        return { ok: false, error: `syntax error near '${expr}'`, injected: false, sql: spliced };
      }
      return {
        ok: true,
        sql: spliced,
        injected: rows.length > 1,
        rows: rows.map(formatRow),
        note: rows.length > 1
          ? 'Injection succeeded: the value changed the meaning of the statement, and every live row came back.'
          : 'The value happened to be harmless here — but it is still part of the SQL text.',
      };
    }
    return { ok: false, error: 'unsupported statement for interpolation mode', injected: false, sql: spliced };
  }

  // Parameter mode — the safe path.
  if (SQL_STATEMENTS.selectOne.test(query)) {
    const [row, err] = new SnippetModel(table).Get(params[0]);
    if (err) return { ok: true, sql: query, params: params.slice(), rows: [], note: 'no rows — sql.ErrNoRows → models.ErrNoRecord' };
    return { ok: true, sql: query, params: params.slice(), rows: [formatRow(row)], note: null };
  }
  if (SQL_STATEMENTS.selectLatest.test(query)) {
    const [rows] = new SnippetModel(table).Latest();
    return { ok: true, sql: query, params: [], rows: rows.map(formatRow), note: null };
  }
  if (SQL_STATEMENTS.insert.test(query)) {
    const [id, err] = new SnippetModel(table).Insert(params[0], params[1], params[2]);
    if (err) return { ok: false, error: err.message, injected: false, sql: query };
    return { ok: true, sql: query, params: params.slice(), rows: [formatRow(table.rows.find((r) => r.id === id))], note: `LastInsertId() = ${id}` };
  }
  if (SQL_STATEMENTS.del.test(query)) {
    const id = Number(params[0]);
    const before = table.rows.length;
    table.rows = table.rows.filter((r) => r.id !== id);
    const affected = before - table.rows.length;
    return { ok: true, sql: query, params: params.slice(), rows: [], note: `RowsAffected() = ${affected}` };
  }
  return { ok: false, error: 'unsupported statement', injected: false, sql: query };
}

/* ------------------------------------------------------------ transactions */

/*
 * Section 4.9: Begin/Rollback/Commit. The guarantee the book describes is that
 * either every statement lands, or none does — demonstrated by making the
 * second statement in the transaction fail on purpose.
 */
function runTransaction(table) {
  const snapshot = {
    rows: table.rows.map((r) => Object.assign({}, r)),
    nextId: table.nextId,
  };
  const log = [];
  const tx = { statements: 0 };

  try {
    log.push({ stmt: 'BEGIN', status: 'ok' });

    // 1. Insert a snippet.
    const created = now();
    const first = {
      id: table.nextId,
      title: 'Transaction: step one',
      content: 'This row only survives if the whole transaction commits.',
      created,
      expires: addDays(created, 1),
    };
    table.rows.push(first);
    table.nextId += 1;
    tx.statements += 1;
    log.push({ stmt: `INSERT INTO snippets (title, ...) VALUES ('Transaction: step one', ...)`, status: 'ok' });

    // 2. A second statement that fails: the classic reason to roll back.
    throw new ModelError("Error 1062: Duplicate entry 'Transaction: step one' for key 'snippets.idx_title'");
  } catch (err) {
    // defer tx.Rollback() — undoes statement 1.
    table.rows = snapshot.rows;
    table.nextId = snapshot.nextId;
    log.push({ stmt: 'ROLLBACK', status: 'ok', note: err.message });
    return { committed: false, log, error: err.message, rowsAfter: table.live(now()).length };
  }
}

module.exports = {
  Table,
  SnippetModel,
  ErrNoRecord,
  ModelError,
  pool,
  seed,
  runSQL,
  runTransaction,
  formatRow,
};
