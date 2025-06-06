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

// 根據檔案類型獲取 Content-Type
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.mp4':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        case '.mov':
            return 'video/quicktime';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        default:
            return 'application/octet-stream';
    }
}

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
        }        // 處理 Range 請求 (用於串流影片)
        const fileSize = stats.size;
        const range = req.headers.range;
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);

        // 設定最大分塊大小 (1MB)，縮小分塊以改善串流效能
        const maxChunkSize = 1 * 1024 * 1024;

        // 如果 end 不存在或超過最大分塊大小，則設定適當的 end 值
        let end;
        if (parts[1]) {
            end = parseInt(parts[1], 10);
        } else {
            // 如果沒有指定 end，則使用 start + maxChunkSize 或文件結尾，取較小者
            end = Math.min(start + maxChunkSize - 1, fileSize - 1);
        }

        // 計算塊大小
        const chunkSize = (end - start) + 1;

        // 創建文件讀取流，提高緩衝區大小
        const fileStream = fs.createReadStream(filePath, {
            start,
            end,
            highWaterMark: 64 * 1024 // 64KB 的緩衝區大小，提高讀取效率
        });        // 設置回應頭
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': getContentType(filePath),
            'Cache-Control': 'public, max-age=3600' // 客戶端緩存，提高性能
        });

        // 增加流的優先級
        fileStream.on('open', () => {
            // 管道流到響應
            fileStream.pipe(res);
        });        // 處理錯誤
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

        // 處理請求終止（例如用戶關閉頁面）
        req.on('close', () => {
            fileStream.destroy();
        });

        // 處理可能的超時
        req.on('timeout', () => {
            console.log('請求超時');
            fileStream.destroy();
            if (!res.headersSent) {
                res.status(408).send('請求超時');
            } else {
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

            // 解析標題中的日期
            row.extractedDate = extractDateFromTitle(row.title);
        });

        // 根據提取的日期排序
        rows.sort((a, b) => {
            // 如果兩個項目都有提取的日期，按日期排序（新的在前）
            if (a.extractedDate && b.extractedDate) {
                return b.extractedDate.getTime() - a.extractedDate.getTime();
            }
            // 如果只有一個有日期，有日期的排在前面
            else if (a.extractedDate) {
                return -1;
            }
            else if (b.extractedDate) {
                return 1;
            }
            // 如果都沒有日期，按照資料庫原本的timestamp排序
            else {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }
        });

        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// 從標題中提取日期的函數
function extractDateFromTitle(title) {
    if (!title) return null;

    // 匹配各種日期格式
    // YYYY/MM/DD 或 YYYY/M/D
    const fullDateRegex = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/;
    // MM/DD 或 M/D（當前年份）
    const shortDateRegex = /^(\d{1,2})\/(\d{1,2})/;

    let match;

    // 嘗試匹配完整日期格式（年/月/日）
    if ((match = fullDateRegex.exec(title)) !== null) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // 月份從0開始
        const day = parseInt(match[3]);

        // 檢查是否為有效日期
        const date = new Date(year, month, day);
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
        }
    }

    // 嘗試匹配簡短日期格式（月/日）
    if ((match = shortDateRegex.exec(title)) !== null) {
        const currentYear = new Date().getFullYear();
        const month = parseInt(match[1]) - 1; // 月份從0開始
        const day = parseInt(match[2]);

        // 檢查是否為有效日期
        const date = new Date(currentYear, month, day);
        if (date.getMonth() === month && date.getDate() === day) {
            return date;
        }
    }

    return null;
}

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
