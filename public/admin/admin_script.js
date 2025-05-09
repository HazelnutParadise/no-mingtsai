document.addEventListener('DOMContentLoaded', () => {
    const adminEventList = document.getElementById('adminEventList');
    const editModal = document.getElementById('editModal');
    const editEventId = document.getElementById('editEventId');
    const editTitle = document.getElementById('editTitle');
    const editLink = document.getElementById('editLink');
    const changePasswordForm = document.getElementById('changePasswordForm');

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
                    listItem.innerHTML = `
                        <div class="event-title">
                            <a href="${event.link}" target="_blank">
                                <i class="fas fa-external-link-alt"></i> ${event.title}
                            </a>
                        </div>
                        <div class="event-date">${formatDate(event.timestamp)}</div>
                        <div class="admin-controls">
                            <button class="edit-btn" onclick="openEditModal(${event.id}, '${escapeString(event.title)}', '${escapeString(event.link)}')">
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

    // Function to open the edit modal
    window.openEditModal = (id, title, link) => {
        editEventId.value = id;
        editTitle.value = title;
        editLink.value = link;
        editModal.classList.add('active');
    };

    // Function to close the edit modal
    window.closeModal = () => {
        editModal.classList.remove('active');
    };

    // Function to submit the edited event
    window.submitEdit = async () => {
        const id = editEventId.value;
        const title = editTitle.value;
        const link = editLink.value;

        if (!title || !link) {
            showNotification('標題和連結不能為空。', false);
            return;
        }

        const password = prompt("請輸入管理員密碼以儲存變更:");
        if (password === null) return; // User cancelled

        try {
            const response = await fetch(`/api/events/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, link, password }),
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

    // Add CSS for notification
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
    `;
    document.head.appendChild(style);

    // Handle ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editModal.classList.contains('active')) {
            closeModal();
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
