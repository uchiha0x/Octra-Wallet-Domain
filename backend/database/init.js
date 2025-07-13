const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'domains.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database at:', dbPath);
    });

    db.serialize(() => {
      // Create domains table
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
      `, (err) => {
        if (err) {
          console.error('Error creating domains table:', err);
          reject(err);
          return;
        }
      });

      // Create registration_logs table
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
        if (err) {
          console.error('Error creating registration_logs table:', err);
          reject(err);
          return;
        }
        
        console.log('Database tables created successfully');
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
            reject(err);
          } else {
            console.log('Database initialization completed');
            resolve();
          }
        });
      });
    });
  });
};

// Function to get a new database connection
const getDatabase = () => {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database connection:', err);
      throw err;
    }
  });
};

// Function to close database connection
const closeDatabase = (db) => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
    });
  }
};

module.exports = { 
  initDatabase, 
  getDatabase, 
  closeDatabase 
};