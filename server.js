const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// 從資料庫獲取管理員密碼的函數
function getAdminPassword(callback) {
    db.get("SELECT value FROM settings WHERE key = 'admin_password'", [], (err, row) => {
        if (err) {
            console.error("Error getting admin password:", err.message);
            callback(err, null);
            return;
        }
        callback(null, row ? row.value : null);
    });
}

// 驗證管理員密碼的中間件
function verifyAdminPassword(req, res, next) {
    const providedPassword = req.body.password;

    if (!providedPassword) {
        return res.status(401).json({ "error": "Password is required" });
    }

    getAdminPassword((err, adminPassword) => {
        if (err) {
            return res.status(500).json({ "error": "Internal server error" });
        }

        if (providedPassword !== adminPassword) {
            return res.status(401).json({ "error": "Unauthorized: Invalid password" });
        }

        next();
    });
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// API endpoint to get all events
app.get('/api/events', (req, res) => {
    const sql = "SELECT * FROM events ORDER BY timestamp DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// API endpoint to add a new event
app.post('/api/events', (req, res) => {
    const { title, link } = req.body;
    if (!title || !link) {
        res.status(400).json({ "error": "Missing title or link" });
        return;
    }
    const sql = 'INSERT INTO events (title, link) VALUES (?,?)';
    const params = [title, link];
    db.run(sql, params, function (err, result) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": { id: this.lastID, title, link },
        });
    });
});

// API endpoint to delete an event (for admin)
app.delete('/api/events/:id', verifyAdminPassword, (req, res) => {
    const sql = 'DELETE FROM events WHERE id = ?';
    db.run(sql, req.params.id, function (err, result) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({ message: "deleted", changes: this.changes });
    });
});

// API endpoint to update an event (for admin)
app.put('/api/events/:id', verifyAdminPassword, (req, res) => {
    const { title, link } = req.body;

    if (!title || !link) {
        res.status(400).json({ "error": "Missing title or link" });
        return;
    }

    const sql = `UPDATE events set 
                title = COALESCE(?,title), 
                link = COALESCE(?,link) 
                WHERE id = ?`;
    const params = [title, link, req.params.id];

    db.run(sql, params, function (err, result) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            message: "success",
            data: { id: req.params.id, title, link },
            changes: this.changes
        });
    });
});

// API endpoint to change admin password
app.post('/api/admin/change-password', (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ "error": "New password must be at least 6 characters long" });
    }

    getAdminPassword((err, adminPassword) => {
        if (err) {
            return res.status(500).json({ "error": "Internal server error" });
        }

        if (currentPassword !== adminPassword) {
            return res.status(401).json({ "error": "Unauthorized: Invalid current password" });
        }

        // Update password in database
        db.run("UPDATE settings SET value = ? WHERE key = 'admin_password'", [newPassword], function (err) {
            if (err) {
                console.error("Error updating admin password:", err.message);
                return res.status(500).json({ "error": "Failed to update password" });
            }

            res.json({ "message": "Password changed successfully" });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
