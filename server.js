const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./database.js');
const mediaDir = db.mediaDir;

const app = express();
const PORT = process.env.PORT || 3000;

// 設置文件存儲配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 為每個事件創建一個唯一的目錄（一次上傳只創建一次）
        if (!req.eventId) {
            const eventId = uuidv4();
            const eventDir = path.join(mediaDir, eventId);

            if (!fs.existsSync(eventDir)) {
                fs.mkdirSync(eventDir, { recursive: true });
            }

            // 將 eventId 傳給 req 對象，以便後續使用
            req.eventDir = eventDir;
            req.eventId = eventId;
        }

        cb(null, req.eventDir);
    },
    filename: function (req, file, cb) {
        // 使用隨機名稱 + 原始副檔名
        const randomName = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, randomName + ext);
    }
});

// 檔案過濾器
const fileFilter = (req, file, cb) => {
    // 允許的檔案類型
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|webm/i;

    // 檢查檔案類型
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('只允許上傳圖片(jpeg/jpg/png/gif)和影片(mp4/mov/webm)檔案!'));
    }
};

// 設置 multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter
    // 移除檔案大小限制
});

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
    // 支援從formData或JSON中獲取密碼
    const providedPassword = req.body.password;

    if (!providedPassword) {
        return res.status(401).json({ "error": "需要提供密碼" });
    }

    getAdminPassword((err, adminPassword) => {
        if (err) {
            return res.status(500).json({ "error": "內部伺服器錯誤" });
        }

        if (providedPassword !== adminPassword) {
            return res.status(401).json({ "error": "未授權: 密碼無效" });
        }

        next();
    });
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// 提供媒體文件的靜態服務，支援串流
app.use('/media', (req, res, next) => {
    // 擷取請求的文件路徑
    const filePath = path.join(mediaDir, req.path);

    // 檢查文件是否存在
    fs.stat(filePath, (err, stats) => {
        if (err) {
            // 如果文件不存在或其他錯誤，交給下一個中間件處理
            return next();
        }

        // 判斷文件類型
        const isVideo = /\.(mp4|mov|webm)$/i.test(filePath);

        // 如果不是影片或沒有 Range 請求頭，使用普通的靜態文件服務
        if (!isVideo || !req.headers.range) {
            return next();
        }

        // 處理 Range 請求 (用於串流影片)
        const fileSize = stats.size;
        const range = req.headers.range;
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        // 如果 end 不存在，則默認為文件結尾
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        // 計算塊大小
        const chunkSize = (end - start) + 1;

        // 創建文件讀取流
        const fileStream = fs.createReadStream(filePath, { start, end });

        // 設置回應頭
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4'
        });

        // 管道流到響應
        fileStream.pipe(res);

        // 處理錯誤
        fileStream.on('error', err => {
            console.error('串流影片時發生錯誤:', err);
            // 如果還沒有發送響應，則發送錯誤
            if (!res.headersSent) {
                res.status(500).send('影片載入失敗');
            } else {
                // 如果已經發送了部分響應，則結束響應
                res.end();
            }
        });
    });
});

// 一般靜態文件服務
app.use('/media', express.static(mediaDir));

// API endpoint to get all events
app.get('/api/events', (req, res) => {
    const sql = "SELECT * FROM events ORDER BY timestamp DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }

        // 處理媒體文件路徑
        rows.forEach(row => {
            if (row.media_files) {
                try {
                    row.mediaFiles = JSON.parse(row.media_files);
                } catch (e) {
                    row.mediaFiles = [];
                }
            } else {
                row.mediaFiles = [];
            }
        });

        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// API endpoint to get a single event (for edit form)
app.get('/api/events/:id', (req, res) => {
    const sql = "SELECT * FROM events WHERE id = ?";
    db.get(sql, req.params.id, (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }

        if (!row) {
            res.status(404).json({ "error": "Event not found" });
            return;
        }

        // 處理媒體文件路徑
        if (row.media_files) {
            try {
                row.mediaFiles = JSON.parse(row.media_files);
            } catch (e) {
                row.mediaFiles = [];
            }
        } else {
            row.mediaFiles = [];
        }

        res.json({
            "message": "success",
            "data": row
        });
    });
});

// API endpoint to add a new event with media files
app.post('/api/events', upload.array('media', 10), (req, res) => {
    const { title, link } = req.body;
    const files = req.files || [];

    // 檢查是否提供了至少一項
    if (!title || (!link && files.length === 0)) {
        // 如果已經上傳了文件但請求失敗，清理這些文件
        if (files.length > 0 && req.eventDir) {
            try {
                fs.rmdirSync(req.eventDir, { recursive: true });
            } catch (err) {
                console.error('刪除文件夾失敗:', err);
            }
        }

        return res.status(400).json({ "error": "標題必須填寫，且至少需要提供連結或上傳媒體檔案" });
    }

    let mediaFilesJSON = '[]';

    // 如果有上傳文件，將其路徑儲存到資料庫
    if (files.length > 0) {
        const mediaFiles = files.map(file => {
            // 將文件路徑轉換為相對於 mediaDir 的路徑
            return path.join(path.basename(req.eventDir), file.filename);
        });

        mediaFilesJSON = JSON.stringify(mediaFiles);
    }

    // 儲存事件資訊到資料庫
    const sql = 'INSERT INTO events (title, link, media_files) VALUES (?, ?, ?)';
    const params = [title, link || null, mediaFilesJSON];

    db.run(sql, params, function (err) {
        if (err) {
            // 如果資料庫操作失敗，清理上傳的檔案
            if (files.length > 0 && req.eventDir) {
                try {
                    fs.rmdirSync(req.eventDir, { recursive: true });
                } catch (error) {
                    console.error('刪除文件夾失敗:', error);
                }
            }

            return res.status(400).json({ "error": err.message });
        }

        res.json({
            "message": "success",
            "data": {
                id: this.lastID,
                title,
                link: link || null,
                mediaFiles: files.length > 0 ? JSON.parse(mediaFilesJSON) : []
            }
        });
    });
});

// 處理檔案上傳錯誤
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '檔案大小不可超過 50MB' });
        }
        return res.status(400).json({ error: `上傳錯誤: ${err.message}` });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

// API endpoint to delete an event (for admin)
app.delete('/api/events/:id', verifyAdminPassword, (req, res) => {
    // 先獲取事件資訊，以便刪除相關的媒體文件
    db.get('SELECT media_files FROM events WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }

        // 刪除相關媒體文件
        if (row && row.media_files) {
            try {
                const mediaFiles = JSON.parse(row.media_files);
                if (mediaFiles.length > 0) {
                    // 獲取事件的目錄名稱（第一個媒體文件的目錄）
                    const eventDirName = path.dirname(mediaFiles[0]);
                    const eventDirPath = path.join(mediaDir, eventDirName);

                    // 如果目錄存在，則刪除
                    if (fs.existsSync(eventDirPath)) {
                        fs.rmdirSync(eventDirPath, { recursive: true });
                    }
                }
            } catch (error) {
                console.error('刪除媒體文件失敗:', error);
                // 繼續刪除資料庫記錄，即使文件刪除失敗
            }
        }

        // 刪除資料庫記錄
        const sql = 'DELETE FROM events WHERE id = ?';
        db.run(sql, req.params.id, function (err) {
            if (err) {
                return res.status(400).json({ "error": err.message });
            }

            res.json({ message: "deleted", changes: this.changes });
        });
    });
});

// API endpoint to update an event (for admin) with media files
app.put('/api/events/:id', upload.array('newMedia', 10), verifyAdminPassword, (req, res) => {
    const { title, link, keepMediaFiles, removeMediaFiles } = req.body;
    const files = req.files || [];

    if (!title) {
        // 如果上傳了文件但請求失敗，清理這些文件
        if (files.length > 0 && req.eventDir) {
            try {
                fs.rmdirSync(req.eventDir, { recursive: true });
            } catch (err) {
                console.error('刪除文件夾失敗:', err);
            }
        }
        return res.status(400).json({ "error": "標題不能為空" });
    }

    // 先獲取當前事件的媒體文件
    db.get('SELECT media_files FROM events WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            // 清理上傳的文件
            if (files.length > 0 && req.eventDir) {
                try {
                    fs.rmdirSync(req.eventDir, { recursive: true });
                } catch (err) {
                    console.error('刪除文件夾失敗:', err);
                }
            }
            return res.status(400).json({ "error": err.message });
        }

        if (!row) {
            // 清理上傳的文件
            if (files.length > 0 && req.eventDir) {
                try {
                    fs.rmdirSync(req.eventDir, { recursive: true });
                } catch (err) {
                    console.error('刪除文件夾失敗:', err);
                }
            }
            return res.status(404).json({ "error": "Event not found" });
        }

        // 處理媒體文件
        let currentMediaFiles = [];
        if (row.media_files) {
            try {
                currentMediaFiles = JSON.parse(row.media_files);
            } catch (e) {
                currentMediaFiles = [];
            }
        }

        // 處理要保留的媒體文件
        let updatedMediaFiles = [];
        if (keepMediaFiles) {
            try {
                const keepFiles = JSON.parse(keepMediaFiles);
                // 確保要保留的文件都存在於當前文件列表中
                updatedMediaFiles = keepFiles.filter(file => currentMediaFiles.includes(file));
            } catch (e) {
                console.error('解析保留媒體文件錯誤:', e);
            }
        }

        // 處理要刪除的媒體文件
        if (removeMediaFiles) {
            try {
                const removeFiles = JSON.parse(removeMediaFiles);
                // 刪除這些文件
                removeFiles.forEach(file => {
                    const filePath = path.join(mediaDir, file);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });

                // 檢查是否需要刪除空目錄
                const uniqueDirs = new Set();
                removeFiles.forEach(file => {
                    uniqueDirs.add(path.dirname(file));
                });

                // 檢查每個目錄是否還有其他文件
                uniqueDirs.forEach(dirName => {
                    const dirPath = path.join(mediaDir, dirName);
                    if (fs.existsSync(dirPath)) {
                        const remainingFiles = fs.readdirSync(dirPath);
                        if (remainingFiles.length === 0) {
                            fs.rmdirSync(dirPath);
                        }
                    }
                });
            } catch (e) {
                console.error('刪除媒體文件錯誤:', e);
            }
        }

        // 添加新上傳的文件
        if (files.length > 0) {
            const newMediaFiles = files.map(file => {
                return path.join(path.basename(req.eventDir), file.filename);
            });
            updatedMediaFiles = updatedMediaFiles.concat(newMediaFiles);
        }

        // 檢查是否至少有連結或媒體
        if (!link && updatedMediaFiles.length === 0) {
            // 清理剛上傳的文件
            if (files.length > 0 && req.eventDir) {
                try {
                    fs.rmdirSync(req.eventDir, { recursive: true });
                } catch (err) {
                    console.error('刪除文件夾失敗:', err);
                }
            }
            return res.status(400).json({ "error": "請至少提供連結或上傳媒體檔案" });
        }

        // 更新資料庫
        const mediaFilesJSON = JSON.stringify(updatedMediaFiles);
        const sql = `UPDATE events SET 
                    title = ?,
                    link = ?,
                    media_files = ?
                    WHERE id = ?`;
        const params = [title, link || null, mediaFilesJSON, req.params.id];

        db.run(sql, params, function (err) {
            if (err) {
                // 如果數據庫操作失敗，清理新上傳的文件
                if (files.length > 0 && req.eventDir) {
                    try {
                        fs.rmdirSync(req.eventDir, { recursive: true });
                    } catch (error) {
                        console.error('刪除文件夾失敗:', error);
                    }
                }
                return res.status(400).json({ "error": err.message });
            }

            res.json({
                message: "success",
                data: {
                    id: parseInt(req.params.id),
                    title,
                    link: link || null,
                    mediaFiles: updatedMediaFiles
                }
            });
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
