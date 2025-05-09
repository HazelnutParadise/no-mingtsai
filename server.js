const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;
let ADMIN_PASSWORD = "admin123"; // Changed to let

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
app.delete('/api/events/:id', (req, res) => {
    const providedPassword = req.body.password;
    if (providedPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ "error": "Unauthorized: Invalid password" });
    }
    const sql = 'DELETE FROM events WHERE id = ?';
    db.run(sql, req.params.id, function (err, result) {
        if (err) {
            res.status(400).json({ "error": res.message });
            return;
        }
        res.json({ message: "deleted", changes: this.changes });
    });
});

// API endpoint to update an event (for admin)
app.put('/api/events/:id', (req, res) => {
    const { title, link, password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ "error": "Unauthorized: Invalid password" });
    }
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

    if (currentPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ "error": "Unauthorized: Invalid current password" });
    }

    if (!newPassword || newPassword.length < 6) { // Basic validation for new password
        return res.status(400).json({ "error": "New password must be at least 6 characters long" });
    }

    ADMIN_PASSWORD = newPassword;
    res.json({ "message": "Password changed successfully" });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
