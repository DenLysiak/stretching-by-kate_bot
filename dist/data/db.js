"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDB = initDB;
exports.getDB = getDB;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
let db;
function initDB(dbPath) {
    db = new better_sqlite3_1.default(dbPath);
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
function getDB() {
    if (!db) {
        throw new Error('База даних ще не ініціалізована!');
    }
    return db;
}
//# sourceMappingURL=db.js.map