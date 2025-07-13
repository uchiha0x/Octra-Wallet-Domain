// backend/database/init.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbFile = path.join(__dirname, '../database/database.sqlite');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path.dirname(dbFile))) {
      fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    }

    const db = new sqlite3.Database(dbFile);

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS domains (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain TEXT UNIQUE NOT NULL,
          address TEXT NOT NULL,
          tx_hash TEXT NOT NULL,
          registered_at INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active'
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS registration_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain TEXT NOT NULL,
          address TEXT NOT NULL,
          tx_hash TEXT NOT NULL,
          action TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    db.close();
  });
};

module.exports = { initDatabase };