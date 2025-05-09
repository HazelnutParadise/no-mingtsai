document.addEventListener('DOMContentLoaded', () => {
    const eventForm = document.getElementById('eventForm');
    const eventList = document.getElementById('eventList');

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
                    listItem.innerHTML = `
                        <a href="${event.link}" target="_blank">
                            <i class="fas fa-external-link-alt"></i> ${event.title}
                        </a>
                        <div class="event-date">${formatDate(event.timestamp)}</div>
                    `;
                    eventList.appendChild(listItem);
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

            // Add loading state to button
            const submitButton = eventForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
            submitButton.disabled = true;

            try {
                const response = await fetch('/api/events', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ title, link }),
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

    // Add CSS class for notification
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
    `;
    document.head.appendChild(style);

    // Initial fetch of events
    fetchEvents();
});
