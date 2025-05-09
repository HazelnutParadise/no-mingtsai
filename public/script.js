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
            if (result.data) {
                result.data.forEach(event => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `<a href="${event.link}" target="_blank">${event.title}</a>`;
                    eventList.appendChild(listItem);
                });
            }
        } catch (error) {
            console.error("Failed to fetch events:", error);
            eventList.innerHTML = '<li>無法載入事件列表。</li>';
        }
    }

    // Handle form submission
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('title').value;
            const link = document.getElementById('link').value;

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
                fetchEvents(); // Refresh the list
                eventForm.reset(); // Reset the form
            } catch (error) {
                console.error("Failed to submit event:", error);
                alert(`提交失敗: ${error.message}`);
            }
        });
    }

    // Initial fetch of events
    fetchEvents();
});
