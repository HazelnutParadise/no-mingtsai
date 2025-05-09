document.addEventListener('DOMContentLoaded', () => {
    const eventForm = document.getElementById('eventForm');
    const eventList = document.getElementById('eventList');
    const fileInput = document.getElementById('media');
    const fileInfo = document.getElementById('fileInfo');
    // 添加模態框元素
    let mediaModal = null;

    // 創建模態框用於查看媒體文件
    function createMediaModal() {
        // 如果已存在則返回
        if (mediaModal) return mediaModal;

        // 創建模態框元素
        mediaModal = document.createElement('div');
        mediaModal.className = 'media-modal';
        mediaModal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <div class="modal-body"></div>
            </div>
        `;

        // 為關閉按鈕添加事件
        const closeButton = mediaModal.querySelector('.close-modal');
        closeButton.addEventListener('click', () => {
            mediaModal.style.display = 'none';
            // 清空內容以停止影片播放
            mediaModal.querySelector('.modal-body').innerHTML = '';
        });

        // 點擊模態框背景時也關閉
        mediaModal.addEventListener('click', (e) => {
            if (e.target === mediaModal) {
                mediaModal.style.display = 'none';
                mediaModal.querySelector('.modal-body').innerHTML = '';
            }
        });

        // 添加到頁面
        document.body.appendChild(mediaModal);
        return mediaModal;
    }

    // 打開媒體文件的函數
    function openMediaInModal(mediaPath, isVideo) {
        const modal = createMediaModal();
        const modalBody = modal.querySelector('.modal-body');

        if (isVideo) {
            // 使用影片串流技術，設置 preload="auto" 啟用預加載
            // 設置 playsinline 在iOS上內嵌播放
            // 添加 range 支援，確保正確處理串流請求
            modalBody.innerHTML = `
                <video controls autoplay preload="auto" playsinline 
                    class="modal-media" 
                    src="${mediaPath}">
                </video>
                <div class="video-loading">
                    <div class="spinner"></div>
                    <span>影片載入中...</span>
                </div>`;

            // 監聽影片載入狀態
            const video = modalBody.querySelector('video');
            const loadingIndicator = modalBody.querySelector('.video-loading');

            // 當媒體數據開始加載
            video.addEventListener('loadstart', () => {
                loadingIndicator.style.display = 'flex';
            });

            // 當有足夠數據可以開始播放
            video.addEventListener('canplay', () => {
                loadingIndicator.style.display = 'none';
            });

            // 當播放暫停等待更多數據
            video.addEventListener('waiting', () => {
                loadingIndicator.style.display = 'flex';
            });

            // 當錯誤發生
            video.addEventListener('error', () => {
                loadingIndicator.style.display = 'none';
                modalBody.innerHTML = `<div class="video-error">影片載入失敗，請稍後再試</div>`;
            });
        } else {
            modalBody.innerHTML = `<img src="${mediaPath}" class="modal-media" alt="事件相關圖片">`;
        }

        modal.style.display = 'flex';
    }

    // 顯示選擇的文件信息
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                let fileNames = Array.from(fileInput.files).map(file => file.name).join(', ');
                let fileCount = fileInput.files.length;
                fileInfo.textContent = `已選擇 ${fileCount} 個檔案: ${fileNames}`;
            } else {
                fileInfo.textContent = '未選擇任何檔案';
            }
        });
    }

    // Function to fetch and display events
    async function fetchEvents() {
        try {
            const response = await fetch('/api/events');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            eventList.innerHTML = ''; // Clear existing list

            if (result.data && result.data.length > 0) {
                result.data.forEach(event => {
                    const listItem = document.createElement('li');
                    let content = `<div class="event-title">${event.title}</div>`;

                    // 添加媒體內容顯示（如果有）
                    if (event.mediaFiles && event.mediaFiles.length > 0) {
                        content += '<div class="event-media">';
                        event.mediaFiles.forEach(file => {
                            const mediaPath = `/media/${file}`;
                            const isVideo = file.includes('.mp4') || file.includes('.mov') || file.includes('.webm');

                            if (isVideo) {
                                // 影片檔案，使用 poster 屬性預先顯示視頻縮圖
                                content += `
                                    <div class="media-container video-container">
                                        <video src="${mediaPath}#t=0.1" preload="metadata" class="media-preview"></video>
                                        <div class="media-overlay">
                                            <i class="fas fa-play-circle"></i>
                                        </div>
                                    </div>`;
                            } else {
                                // 圖片檔案，使用 loading="lazy" 屬性延遲載入
                                content += `
                                    <div class="media-container">
                                        <img src="${mediaPath}" loading="eager" class="media-preview" alt="事件相關圖片">
                                        <div class="media-overlay">
                                            <i class="fas fa-search-plus"></i>
                                        </div>
                                    </div>`;
                            }
                        });
                        content += '</div>';
                    }

                    // 添加連結（如果有）
                    if (event.link) {
                        content += `<a href="${event.link}" target="_blank" class="event-link">
                            <i class="fas fa-external-link-alt"></i> 連結
                        </a>`;
                    }

                    content += `<div class="event-date">${formatDate(event.timestamp)}</div>`;
                    listItem.innerHTML = content;
                    eventList.appendChild(listItem);

                    // 為媒體添加點擊事件
                    if (event.mediaFiles && event.mediaFiles.length > 0) {
                        const mediaContainers = listItem.querySelectorAll('.media-container');
                        event.mediaFiles.forEach((file, index) => {
                            const isVideo = file.includes('.mp4') || file.includes('.mov') || file.includes('.webm');
                            mediaContainers[index].addEventListener('click', () => {
                                openMediaInModal(`/media/${file}`, isVideo);
                            });
                        });
                    }
                });
            } else {
                eventList.innerHTML = '<li class="no-events">目前尚無事件記錄。</li>';
            }
        } catch (error) {
            console.error("Failed to fetch events:", error);
            eventList.innerHTML = '<li class="error"><i class="fas fa-exclamation-circle"></i> 無法載入事件列表。</li>';
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

    // Handle form submission
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('title').value;
            const link = document.getElementById('link').value;

            // 檢查至少有連結或媒體檔案
            if (!link && (!fileInput.files || fileInput.files.length === 0)) {
                showNotification('請至少提供連結或上傳媒體檔案', false);
                return;
            }

            // Add loading state to button
            const submitButton = eventForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
            submitButton.disabled = true;

            try {
                // 使用 FormData 來處理檔案上傳
                const formData = new FormData();
                formData.append('title', title);
                if (link) formData.append('link', link);

                // 添加所有選擇的媒體檔案
                if (fileInput.files && fileInput.files.length > 0) {
                    for (let i = 0; i < fileInput.files.length; i++) {
                        formData.append('media', fileInput.files[i]);
                    }
                }

                const response = await fetch('/api/events', {
                    method: 'POST',
                    body: formData, // 不要設置 Content-Type，讓瀏覽器自動設置
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                await response.json();

                // Show success notification
                showNotification('事件新增成功！');

                // Reset form and refresh event list
                eventForm.reset();
                fileInfo.textContent = '未選擇任何檔案';
                fetchEvents();
            } catch (error) {
                console.error("Failed to submit event:", error);
                showNotification(`提交失敗: ${error.message}`, false);
            } finally {
                // Restore button state
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }

    // Add CSS class for notification and media display
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
            z-index: 1000;
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
        .no-events, .error {
            color: #7f8c8d;
            text-align: center;
            padding: 20px 0;
        }
        .event-date {
            font-size: 0.85em;
            color: #7f8c8d;
        }
        .loading {
            text-align: center;
            padding: 15px;
            color: #7f8c8d;
        }
        .media-preview {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .event-media {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 10px 0;
        }
        .file-info {
            margin-top: 5px;
            font-size: 0.85em;
            color: #7f8c8d;
        }
        .event-title {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 8px;
        }
        .event-link {
            display: inline-block;
            margin: 5px 0;
            color: #3498db;
            text-decoration: none;
        }
        .event-link:hover {
            text-decoration: underline;
        }
        
        /* 媒體容器樣式 */
        .media-container {
            position: relative;
            cursor: pointer;
            border-radius: 4px;
            overflow: hidden;
            width: 200px;
            height: 200px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .media-container:hover {
            transform: scale(1.03);
        }
        .media-container:hover .media-overlay {
            opacity: 1;
        }
        .media-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s;
            transform: none;
        }
        .media-overlay i {
            color: white;
            font-size: 2rem;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
        
        .video-container .media-preview {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* 模態框樣式 */
        .media-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            z-index: 1100;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        }
        .modal-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
        }
        .close-modal {
            position: absolute;
            top: 10px;
            right: 15px;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            z-index: 1110;
            text-shadow: 0 0 5px rgba(0,0,0,0.8);
        }
        .modal-body {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .modal-media {
            max-width: 100%;
            max-height: 90vh;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
        }
        .video-loading {
            display: none;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 1.2em;
            text-align: center;
        }
        .video-loading .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 10px;
        }
        @keyframes spin {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }
    `;
    document.head.appendChild(style);

    // Initial fetch of events
    fetchEvents();
});
