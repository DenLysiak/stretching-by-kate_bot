import Database from 'better-sqlite3';

let db: Database.Database;

export function initDB(dbPath: string) {
  db = new Database(dbPath);

  db.prepare(`
    CREATE TABLE IF NOT EXISTS allowed_users (
      user_id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      date_added TEXT NOT NULL,
      permission_type TEXT NOT NULL CHECK (permission_type IN ('permanent', 'temporary')),
      end_date TEXT
    )
  `).run();

  console.log('✅ База даних ініціалізована:', dbPath);
}

export function getDB(): Database.Database {
  if (!db) {
    throw new Error('База даних ще не ініціалізована!');
  }
  
  return db;
}
