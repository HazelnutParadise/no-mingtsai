document.addEventListener('DOMContentLoaded', () => {
    const adminEventList = document.getElementById('adminEventList');
    const editModal = document.getElementById('editModal');
    const editEventId = document.getElementById('editEventId');
    const editTitle = document.getElementById('editTitle');
    const editLink = document.getElementById('editLink');
    const changePasswordForm = document.getElementById('changePasswordForm');

    async function fetchAdminEvents() {
        try {
            const response = await fetch('/api/events');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            adminEventList.innerHTML = ''; // Clear existing list
            if (result.data) {
                result.data.forEach(event => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `
                        <a href="${event.link}" target="_blank">${event.title}</a>
                        <button onclick="openEditModal(${event.id}, '${event.title}', '${event.link}')">編輯</button>
                        <button onclick="deleteEvent(${event.id})">刪除</button>
                    `;
                    adminEventList.appendChild(listItem);
                });
            }
        } catch (error) {
            console.error("Failed to fetch events for admin:", error);
            adminEventList.innerHTML = '<li>無法載入事件列表。</li>';
        }
    }

    window.openEditModal = (id, title, link) => {
        editEventId.value = id;
        editTitle.value = title;
        editLink.value = link;
        editModal.style.display = 'block';
    };

    window.closeModal = () => {
        editModal.style.display = 'none';
    };

    window.submitEdit = async () => {
        const id = editEventId.value;
        const title = editTitle.value;
        const link = editLink.value;
        const password = prompt("請輸入管理員密碼以儲存變更:");
        if (password === null) return; // User cancelled

        if (!title || !link) {
            alert('標題和連結不能為空。');
            return;
        }

        try {
            const response = await fetch(`/api/events/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, link, password: password }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            closeModal();
            fetchAdminEvents(); // Refresh the list
        } catch (error) {
            console.error("Failed to update event:", error);
            alert(`更新失敗: ${error.message}`);
        }
    };

    window.deleteEvent = async (id) => {
        const password = prompt("請輸入管理員密碼:");
        if (password === null) return; // User cancelled

        try {
            const response = await fetch(`/api/events/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: password })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            fetchAdminEvents(); // Refresh the list
        } catch (error) {
            console.error("Failed to delete event:", error);
            alert(`刪除失敗: ${error.message}`);
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
                alert("新密碼與確認密碼不相符。");
                return;
            }

            if (newPassword.length < 6) {
                alert("新密碼長度至少需要6個字元。");
                return;
            }

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

                alert(result.message || "密碼已成功更改。");
                changePasswordForm.reset();
            } catch (error) {
                console.error("Failed to change password:", error);
                alert(`更改密碼失敗: ${error.message}`);
            }
        });
    }

    fetchAdminEvents();
});
