document.addEventListener('DOMContentLoaded', () => {
    const adminEventList = document.getElementById('adminEventList');
    const editModal = document.getElementById('editModal');
    const editEventId = document.getElementById('editEventId');
    const editTitle = document.getElementById('editTitle');
    const editLink = document.getElementById('editLink');
    const editMediaList = document.getElementById('editMediaList');
    const editMediaUpload = document.getElementById('editMediaUpload');
    const editFileInfo = document.getElementById('editFileInfo');
    const changePasswordForm = document.getElementById('changePasswordForm');

    // 存儲當前編輯事件的媒體文件
    let currentMediaFiles = [];
    let removedMediaFiles = [];

    // 當選擇新的媒體檔案時更新檔案信息
    if (editMediaUpload) {
        editMediaUpload.addEventListener('change', () => {
            if (editMediaUpload.files.length > 0) {
                let fileNames = Array.from(editMediaUpload.files).map(file => file.name).join(', ');
                let fileCount = editMediaUpload.files.length;
                editFileInfo.textContent = `已選擇 ${fileCount} 個檔案: ${fileNames}`;
            } else {
                editFileInfo.textContent = '未選擇任何檔案';
            }
        });
    }

    // Function to fetch and display events for admin
    async function fetchAdminEvents() {
        try {
            adminEventList.innerHTML = '<li class="loading"><i class="fas fa-spinner fa-spin"></i> 載入中...</li>';

            const response = await fetch('/api/events');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            adminEventList.innerHTML = ''; // Clear existing list

            if (result.data && result.data.length > 0) {
                result.data.forEach(event => {
                    const listItem = document.createElement('li');

                    let mediaPreview = '';
                    // 如果有媒體文件，顯示數量
                    if (event.mediaFiles && event.mediaFiles.length > 0) {
                        mediaPreview = `<div class="event-media-count"><i class="fas fa-photo-video"></i> ${event.mediaFiles.length} 個媒體文件</div>`;
                    }

                    listItem.innerHTML = `
                        <div class="event-title">
                            ${event.title}
                        </div>
                        ${mediaPreview}
                        ${event.link ? `<div class="event-link"><a href="${event.link}" target="_blank"><i class="fas fa-external-link-alt"></i> 查看連結</a></div>` : ''}
                        <div class="event-date">${formatDate(event.timestamp)}</div>
                        <div class="admin-controls">
                            <button class="edit-btn" onclick="openEditModal(${event.id})">
                                <i class="fas fa-edit"></i> 編輯
                            </button>
                            <button class="delete-btn" onclick="deleteEvent(${event.id})">
                                <i class="fas fa-trash-alt"></i> 刪除
                            </button>
                        </div>
                    `;
                    adminEventList.appendChild(listItem);
                });
            } else {
                adminEventList.innerHTML = '<li class="no-events"><i class="fas fa-info-circle"></i> 目前尚無事件記錄。</li>';
            }
        } catch (error) {
            console.error("Failed to fetch events for admin:", error);
            adminEventList.innerHTML = '<li class="error"><i class="fas fa-exclamation-circle"></i> 無法載入事件列表。</li>';
        }
    }

    // Format date in a more readable format
    function formatDate(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('zh-TW', options);
    }

    // Escape special characters in strings for safe insertion into HTML
    window.escapeString = function (str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Show notification
    function showNotification(message, isSuccess = true) {
        const notif = document.createElement('div');
        notif.className = `notification ${isSuccess ? 'success' : 'error'}`;
        notif.innerHTML = `
            <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${message}
        `;
        document.body.appendChild(notif);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 500);
        }, 3000);
    }

    // 生成媒體文件預覽
    function renderMediaPreview(mediaFiles) {
        editMediaList.innerHTML = '';
        if (!mediaFiles || mediaFiles.length === 0) {
            editMediaList.innerHTML = '<div class="no-media">無媒體檔案</div>';
            return;
        }

        currentMediaFiles = [...mediaFiles];

        mediaFiles.forEach((file, index) => {
            const mediaPath = `/media/${file}`;
            const isVideo = file.includes('.mp4') || file.includes('.mov') || file.includes('.webm');

            const mediaItem = document.createElement('div');
            mediaItem.className = 'edit-media-item';

            if (isVideo) {
                mediaItem.innerHTML = `
                    <div class="media-preview-container video-container">
                        <video src="${mediaPath}" class="media-preview" preload="metadata"></video>
                        <div class="media-overlay" data-action="preview" data-index="${index}">
                            <i class="fas fa-play-circle"></i>
                        </div>
                    </div>
                    <div class="media-actions">
                        <button class="remove-media-btn" data-index="${index}">
                            <i class="fas fa-trash-alt"></i> 刪除
                        </button>
                    </div>
                `;
            } else {
                mediaItem.innerHTML = `
                    <div class="media-preview-container">
                        <img src="${mediaPath}" class="media-preview" alt="事件相關圖片">
                        <div class="media-overlay" data-action="preview" data-index="${index}">
                            <i class="fas fa-search-plus"></i>
                        </div>
                    </div>
                    <div class="media-actions">
                        <button class="remove-media-btn" data-index="${index}">
                            <i class="fas fa-trash-alt"></i> 刪除
                        </button>
                    </div>
                `;
            }

            editMediaList.appendChild(mediaItem);
        });

        // 添加點擊事件處理
        const removeButtons = editMediaList.querySelectorAll('.remove-media-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(button.dataset.index);
                if (index >= 0 && index < currentMediaFiles.length) {
                    // 添加到刪除列表
                    removedMediaFiles.push(currentMediaFiles[index]);
                    // 從當前列表移除
                    currentMediaFiles.splice(index, 1);
                    // 重新渲染
                    renderMediaPreview(currentMediaFiles);
                }
            });
        });

        // 添加預覽點擊事件
        const previewOverlays = editMediaList.querySelectorAll('.media-overlay[data-action="preview"]');
        previewOverlays.forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                const index = parseInt(overlay.dataset.index);
                if (index >= 0 && index < currentMediaFiles.length) {
                    const mediaPath = `/media/${currentMediaFiles[index]}`;
                    const isVideo = currentMediaFiles[index].includes('.mp4') ||
                        currentMediaFiles[index].includes('.mov') ||
                        currentMediaFiles[index].includes('.webm');
                    openMediaPreview(mediaPath, isVideo);
                }
            });
        });
    }

    // 打開媒體預覽模態框
    function openMediaPreview(mediaPath, isVideo) {
        // 創建預覽模態框
        let previewModal = document.getElementById('mediaPreviewModal');
        if (!previewModal) {
            previewModal = document.createElement('div');
            previewModal.id = 'mediaPreviewModal';
            previewModal.className = 'media-preview-modal';
            previewModal.innerHTML = `
                <div class="modal-content">
                    <span class="close-preview">&times;</span>
                    <div class="preview-container"></div>
                </div>
            `;
            document.body.appendChild(previewModal);

            // 添加關閉按鈕事件
            const closeButton = previewModal.querySelector('.close-preview');
            closeButton.addEventListener('click', () => {
                previewModal.style.display = 'none';
                previewModal.querySelector('.preview-container').innerHTML = '';
            });

            // 點擊背景關閉
            previewModal.addEventListener('click', (e) => {
                if (e.target === previewModal) {
                    previewModal.style.display = 'none';
                    previewModal.querySelector('.preview-container').innerHTML = '';
                }
            });
        }

        const previewContainer = previewModal.querySelector('.preview-container');
        if (isVideo) {
            previewContainer.innerHTML = `<video controls autoplay src="${mediaPath}" class="preview-media"></video>`;
        } else {
            previewContainer.innerHTML = `<img src="${mediaPath}" class="preview-media" alt="媒體預覽">`;
        }

        previewModal.style.display = 'flex';
    }

    // Function to open the edit modal with full event info
    window.openEditModal = async (id) => {
        try {
            // 重置移除的媒體文件列表
            removedMediaFiles = [];

            // 獲取事件詳細信息
            const response = await fetch(`/api/events/${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            if (!result.data) throw new Error('未找到事件資料');

            const event = result.data;

            // 填充表單
            editEventId.value = event.id;
            editTitle.value = event.title || '';
            editLink.value = event.link || '';

            // 處理媒體文件
            const mediaFiles = event.mediaFiles || [];
            renderMediaPreview(mediaFiles);

            // 重置新上傳文件選擇
            editMediaUpload.value = '';
            editFileInfo.textContent = '未選擇任何檔案';

            // 顯示模態框
            editModal.classList.add('active');
        } catch (error) {
            console.error("Failed to fetch event details:", error);
            showNotification(`無法獲取事件資料: ${error.message}`, false);
        }
    };

    // Function to close the edit modal
    window.closeModal = () => {
        editModal.classList.remove('active');
        // 清空移除的媒體文件列表
        removedMediaFiles = [];
    };

    // Function to submit the edited event
    window.submitEdit = async () => {
        const id = editEventId.value;
        const title = editTitle.value;
        const link = editLink.value;

        if (!title) {
            showNotification('標題不能為空。', false);
            return;
        }

        // 檢查是否至少有連結或媒體檔案
        const hasNewMedia = editMediaUpload.files && editMediaUpload.files.length > 0;
        if (!link && currentMediaFiles.length === 0 && !hasNewMedia) {
            showNotification('請至少提供連結或上傳媒體檔案。', false);
            return;
        }

        const password = prompt("請輸入管理員密碼以儲存變更:");
        if (password === null) return; // User cancelled

        try {
            // 使用 FormData 來處理檔案上傳
            const formData = new FormData();
            formData.append('title', title);
            formData.append('link', link || '');
            formData.append('password', password);

            // 添加當前保留的媒體文件
            if (currentMediaFiles.length > 0) {
                formData.append('keepMediaFiles', JSON.stringify(currentMediaFiles));
            }

            // 添加要刪除的媒體文件
            if (removedMediaFiles.length > 0) {
                formData.append('removeMediaFiles', JSON.stringify(removedMediaFiles));
            }

            // 添加新上傳的媒體文件
            if (hasNewMedia) {
                for (let i = 0; i < editMediaUpload.files.length; i++) {
                    formData.append('newMedia', editMediaUpload.files[i]);
                }
            }

            const response = await fetch(`/api/events/${id}`, {
                method: 'PUT',
                body: formData // 不設置 Content-Type，讓瀏覽器自動設置
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            closeModal();
            showNotification('事件更新成功！');
            fetchAdminEvents(); // Refresh the list
        } catch (error) {
            console.error("Failed to update event:", error);
            showNotification(`更新失敗: ${error.message}`, false);
        }
    };

    // Function to delete an event
    window.deleteEvent = async (id) => {
        if (!confirm('確定要刪除這個事件嗎？此操作無法復原。')) {
            return;
        }

        const password = prompt("請輸入管理員密碼:");
        if (password === null) return; // User cancelled

        try {
            const response = await fetch(`/api/events/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            showNotification('事件已成功刪除！');
            fetchAdminEvents(); // Refresh the list
        } catch (error) {
            console.error("Failed to delete event:", error);
            showNotification(`刪除失敗: ${error.message}`, false);
        }
    };

    // Handle change password form submission
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                showNotification("新密碼與確認密碼不相符。", false);
                return;
            }

            if (newPassword.length < 6) {
                showNotification("新密碼長度至少需要6個字元。", false);
                return;
            }

            // Add loading state to button
            const submitButton = changePasswordForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';
            submitButton.disabled = true;

            try {
                const response = await fetch('/api/admin/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ currentPassword, newPassword }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `HTTP error! status: ${response.status}`);
                }

                showNotification(result.message || "密碼已成功更改。");
                changePasswordForm.reset();
            } catch (error) {
                console.error("Failed to change password:", error);
                showNotification(`更改密碼失敗: ${error.message}`, false);
            } finally {
                // Restore button state
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }

    // Add CSS for notification and media editor
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            z-index: 1001;
            display: flex;
            align-items: center;
            transform: translateY(0);
            opacity: 1;
            transition: transform 0.3s, opacity 0.3s;
        }
        .notification.success {
            background-color: #27ae60;
        }
        .notification.error {
            background-color: #e74c3c;
        }
        .notification i {
            margin-right: 8px;
            font-size: 1.2em;
        }
        .notification.fade-out {
            transform: translateY(10px);
            opacity: 0;
        }
        .no-events, .error, .loading {
            color: #7f8c8d;
            text-align: center;
            padding: 20px 0;
        }
        .event-date {
            font-size: 0.85em;
            color: #7f8c8d;
            margin: 5px 0;
        }
        .back-link {
            display: inline-flex;
            align-items: center;
            color: var(--primary-color);
            text-decoration: none;
            font-weight: 500;
            transition: var(--transition);
        }
        .back-link i {
            margin-right: 6px;
        }
        .back-link:hover {
            color: var(--primary-dark);
        }
        
        /* 媒體編輯樣式 */
        .edit-media-list {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-top: 10px;
        }
        .edit-media-item {
            position: relative;
            width: 150px;
            margin-bottom: 10px;
        }
        .media-preview-container {
            position: relative;
            width: 100%;
            height: 150px;
            overflow: hidden;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            cursor: pointer;
        }
        .media-preview {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .media-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.4);
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .media-preview-container:hover .media-overlay {
            opacity: 1;
        }
        .media-overlay i {
            color: white;
            font-size: 2rem;
        }
        .media-actions {
            margin-top: 5px;
            text-align: center;
        }
        .remove-media-btn {
            background-color: #e74c3c;
            color: white;
            border: none;
            padding: 5px 8px;
            border-radius: 3px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .remove-media-btn:hover {
            background-color: #c0392b;
        }
        .no-media {
            color: #7f8c8d;
            font-style: italic;
            padding: 10px 0;
        }
        .event-media-count {
            font-size: 0.9em;
            color: #7f8c8d;
            margin: 5px 0;
        }
        .event-link {
            margin: 5px 0;
        }
        
        /* 媒體預覽模態框 */
        .media-preview-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.85);
            z-index: 1200;
            justify-content: center;
            align-items: center;
        }
        .media-preview-modal .modal-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
        }
        .close-preview {
            position: absolute;
            top: -30px;
            right: 0;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            z-index: 1210;
        }
        .preview-container {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .preview-media {
            max-width: 100%;
            max-height: 90vh;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
        }
        
        /* 文件信息樣式 */
        .file-info {
            margin-top: 5px;
            font-size: 0.85em;
            color: #7f8c8d;
        }
    `;
    document.head.appendChild(style);

    // Handle ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (editModal.classList.contains('active')) {
                closeModal();
            }

            const previewModal = document.getElementById('mediaPreviewModal');
            if (previewModal && previewModal.style.display === 'flex') {
                previewModal.style.display = 'none';
                previewModal.querySelector('.preview-container').innerHTML = '';
            }
        }
    });

    // Close modal when clicking outside modal content
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeModal();
        }
    });

    // Initial fetch of events
    fetchAdminEvents();
});
