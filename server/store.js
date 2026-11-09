// SQLite veri deposu (Node'un yerleşik node:sqlite modülü; ek paket gerekmez).
// Uygulama verisi koleksiyon başına bir JSON belgesi olarak tutulur; her kayıtta yalnızca değişen koleksiyonlar yazılır.
// Pilot ölçeği (10–50 kişi) için tasarlandı. Büyük ölçekte koleksiyonlar satır bazlı tablolara taşınmalıdır.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OBJECT_COLLECTIONS = ['members', 'states', 'revisions', 'policies'];
const ARRAY_COLLECTIONS = ['workspaces', 'notifications', 'comments', 'activities', 'times'];

export function openStore(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS documents (name TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT, created INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_states (state TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, return_to TEXT, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, email TEXT, action TEXT NOT NULL, detail TEXT);
  `);

  const data = {};
  const written = {};
  const read = db.prepare('SELECT json FROM documents WHERE name = ?');
  for (const name of [...OBJECT_COLLECTIONS, ...ARRAY_COLLECTIONS]) {
    const row = read.get(name);
    data[name] = row ? JSON.parse(row.json) : OBJECT_COLLECTIONS.includes(name) ? {} : [];
    written[name] = row ? row.json : null;
  }

  const upsert = db.prepare(
    'INSERT INTO documents (name, json, updated) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET json = excluded.json, updated = excluded.updated',
  );
  function persist() {
    const changed = [];
    for (const name of Object.keys(written)) {
      const json = JSON.stringify(data[name]);
      if (json !== written[name]) changed.push([name, json]);
    }
    if (!changed.length) return;
    db.exec('BEGIN');
    try {
      const now = Date.now();
      for (const [name, json] of changed) upsert.run(name, json, now);
      db.exec('COMMIT');
      for (const [name, json] of changed) written[name] = json;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  const token = () => randomBytes(32).toString('base64url');
  const sessions = {
    create(email, name, hours) {
      const id = token();
      const now = Date.now();
      db.prepare('INSERT INTO sessions (id, email, name, created, expires) VALUES (?, ?, ?, ?, ?)').run(id, email, name || '', now, now + hours * 3600e3);
      return id;
    },
    get(id) {
      if (!id) return null;
      const row = db.prepare('SELECT email, name, expires FROM sessions WHERE id = ?').get(id);
      return row && row.expires > Date.now() ? { email: row.email, name: row.name } : null;
    },
    delete(id) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    },
    deleteForEmail(email) {
      db.prepare('DELETE FROM sessions WHERE email = ?').run(email);
    },
    purge() {
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
      db.prepare('DELETE FROM login_states WHERE created <= ?').run(Date.now() - 10 * 60e3);
    },
  };
  const loginStates = {
    save(state, nonce, verifier, returnTo) {
      db.prepare('INSERT INTO login_states (state, nonce, verifier, return_to, created) VALUES (?, ?, ?, ?, ?)').run(state, nonce, verifier, returnTo, Date.now());
    },
    /** Tek kullanımlık: okunan durum silinir; 10 dakikadan eskisi geçersizdir */
    take(state) {
      if (!state) return null;
      const row = db.prepare('SELECT nonce, verifier, return_to, created FROM login_states WHERE state = ?').get(state);
      db.prepare('DELETE FROM login_states WHERE state = ?').run(state);
      return row && row.created > Date.now() - 10 * 60e3 ? row : null;
    },
  };

  function audit(email, action, detail = '') {
    db.prepare('INSERT INTO audit (at, email, action, detail) VALUES (?, ?, ?, ?)').run(Date.now(), email || '', action, String(detail).slice(0, 500));
  }

  /** Tutarlı anlık yedek (VACUUM INTO); en yeni `keep` yedek kalır */
  function backup(dir, keep = 14) {
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = join(dir, `pusula-${stamp}.db`);
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    const files = readdirSync(dir).filter((f) => /^pusula-.*\.db$/.test(f)).sort();
    for (const old of files.slice(0, Math.max(0, files.length - keep))) rmSync(join(dir, old));
    return target;
  }

  return { load: () => data, persist, sessions, loginStates, audit, backup, close: () => db.close(), db };
}
