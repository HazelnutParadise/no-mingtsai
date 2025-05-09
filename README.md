# 羅明才選區暴力事件集錦

一個簡單的網站應用程式，用於收集和展示羅明才選區的暴力事件。使用者可以提交事件標題和相關連結，管理員可以管理這些事件。

## 功能特色

- 使用者可以提交暴力事件的標題和相關連結
- 所有提交的事件會立即顯示在網頁上
- 管理介面支援編輯和刪除事件
- 管理員可以修改管理密碼
- 響應式設計，支援手機和桌面裝置
- 簡潔綠白配色主題

## 技術堆疊

- **前端**：HTML, CSS, JavaScript
- **後端**：Node.js, Express.js
- **資料庫**：SQLite

## 安裝與設定

### 前置需求

- Node.js (建議版本 v14 或更高)
- npm (通常隨 Node.js 一起安裝)

### 安裝步驟

1. 複製專案碼源碼
   ```
   git clone https://github.com/your-username/no-mingtsai.git
   cd no-mingtsai
   ```

2. 安裝相依套件
   ```
   npm install
   ```

3. 啟動應用程式
   ```
   npm start
   ```

4. 開啟瀏覽器，訪問：
   ```
   http://localhost:3000
   ```

## 使用說明

### 一般使用者

1. 訪問首頁 (`http://localhost:3000`)
2. 瀏覽已提交的暴力事件列表
3. 使用表單新增事件（需填寫標題和相關連結）

### 管理員

1. 訪問管理頁面 (`http://localhost:3000/admin/`)
2. 使用管理功能編輯或刪除事件（需要輸入管理員密碼）
3. 可以在管理頁面更改管理員密碼

**預設管理員密碼**：`admin123`

## 專案結構

```
no-mingtsai/
├── data/               # 存放資料庫文件
│   └── db.sqlite       # SQLite 資料庫文件
├── public/             # 靜態文件目錄
│   ├── admin/          # 管理頁面相關文件
│   │   ├── index.html  # 管理頁面 HTML
│   │   └── admin_script.js  # 管理頁面 JavaScript
│   ├── index.html      # 主頁面 HTML
│   ├── script.js       # 主頁面 JavaScript
│   └── style.css       # CSS 樣式表
├── database.js         # 資料庫連接和初始化
├── server.js           # 應用程式主文件和 API 端點
├── package.json        # 專案資訊和相依套件
└── README.md           # 本文件
```

## API 端點

- `GET /api/events` - 獲取所有事件
- `POST /api/events` - 新增事件
- `PUT /api/events/:id` - 更新特定事件（需密碼驗證）
- `DELETE /api/events/:id` - 刪除特定事件（需密碼驗證）
- `POST /api/admin/change-password` - 更改管理員密碼（需驗證當前密碼）

## 授權條款

MIT

## 貢獻指南

1. Fork 本專案
2. 建立您的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟一個 Pull Request