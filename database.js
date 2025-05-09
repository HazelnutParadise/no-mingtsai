const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs'); // Required for directory creation

// Define the path for the data directory
const dataDir = path.join(__dirname, 'data');

// Ensure the data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created directory: ${dataDir}`);
}

// Define the path for the database file within the 'data' directory
const DBSOURCE = path.join(dataDir, 'db.sqlite');

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                // Table already created or other error
                console.log('Table already exists or error creating table.');
            } else {
                // Table just created, creating some rows
                console.log('Events table created.');
            }
        });
    }
});

module.exports = db;
