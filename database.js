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

// 創建媒體文件存儲目錄
const mediaDir = path.join(dataDir, 'media');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
    console.log(`Created media directory: ${mediaDir}`);
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
            link TEXT,
            media_files TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.log('Events table already exists or error creating table.');
            } else {
                console.log('Events table created or updated.');
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

        // 檢查是否需要更新表結構
        db.get("PRAGMA table_info(events)", [], (err, rows) => {
            if (err) {
                console.error("Error checking table schema:", err.message);
                return;
            }

            // 檢查是否有 media_files 字段
            db.get("SELECT COUNT(*) as count FROM pragma_table_info('events') WHERE name='media_files'", [], (err, row) => {
                if (err) {
                    console.error("Error checking for media_files column:", err.message);
                    return;
                }

                // 如果沒有 media_files 字段，添加它
                if (row.count === 0) {
                    db.run("ALTER TABLE events ADD COLUMN media_files TEXT", (err) => {
                        if (err) {
                            console.error("Error adding media_files column:", err.message);
                        } else {
                            console.log("Added media_files column to events table");
                        }
                    });
                }

                // 檢查 link 是否為 NOT NULL
                db.get("SELECT COUNT(*) as count FROM pragma_table_info('events') WHERE name='link' AND [notnull]=1", [], (err, row) => {
                    if (err) {
                        console.error("Error checking link column constraint:", err.message);
                        return;
                    }

                    // 如果 link 是 NOT NULL，需要創建新表來移除約束
                    if (row.count > 0) {
                        console.log("Recreating events table to make link column nullable");
                        db.serialize(() => {
                            db.run("BEGIN TRANSACTION");

                            // 創建新表
                            db.run(`CREATE TABLE IF NOT EXISTS events_new (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                title TEXT NOT NULL,
                                link TEXT,
                                media_files TEXT,
                                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                            )`);

                            // 複製數據
                            db.run("INSERT INTO events_new SELECT id, title, link, media_files, timestamp FROM events");

                            // 刪除舊表
                            db.run("DROP TABLE events");

                            // 重命名新表
                            db.run("ALTER TABLE events_new RENAME TO events");

                            db.run("COMMIT");

                            console.log("Successfully updated events table schema");
                        });
                    }
                });
            });
        });
    }
});

module.exports = db;
module.exports.mediaDir = mediaDir;
