const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Define the path for the data directory
const dataDir = path.join(__dirname, 'data');

// Ensure the data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created directory: ${dataDir}`);
}

// Define the path for the database file within the 'data' directory
const DBSOURCE = path.join(dataDir, 'db.sqlite');

// Default admin password that will be used only if no password exists in the database
const DEFAULT_ADMIN_PASSWORD = "admin123";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');

        // Create events table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.log('Events table already exists or error creating table.');
            } else {
                console.log('Events table created.');
            }
        });

        // Create settings table for storing admin password
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.log('Settings table already exists or error creating table.');
            } else {
                console.log('Settings table created.');

                // Insert default admin password if it doesn't exist
                db.get(`SELECT value FROM settings WHERE key = 'admin_password'`, [], (err, row) => {
                    if (err) {
                        console.error('Error checking for admin password:', err.message);
                    } else if (!row) {
                        // No admin password found, insert the default one
                        db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`,
                            ['admin_password', DEFAULT_ADMIN_PASSWORD], function (err) {
                                if (err) {
                                    console.error('Error setting default admin password:', err.message);
                                } else {
                                    console.log('Default admin password set.');
                                }
                            });
                    } else {
                        console.log('Admin password already exists in database.');
                    }
                });
            }
        });
    }
});

module.exports = db;
