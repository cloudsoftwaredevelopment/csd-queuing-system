        const socket = io(); // auto-connects to same host

            // Listen for real-time updates from server
            socket.on("queue_state", (data) => {
            queueSystem = data;
            updateEmployeeView();
            updatePublicDisplay();
            updateStats();
            updateCategoryDisplay();
        });

        function saveToServer() {
            socket.emit("update_queue", queueSystem);
        }

// System state
        let queueSystem = {
            queues: [],
            activeServices: [],
            nextQueueNumbers: {},
            totalServed: 0,
            categories: ['Cashier', 'Registrar']
        };

        // Initialize system when page loads
        document.addEventListener('DOMContentLoaded', function() {
            console.log('System initializing...');
            initializeSystem();
        });

        function initializeSystem() {
            // Initialize queue numbers for categories
            queueSystem.categories.forEach(category => {
                queueSystem.nextQueueNumbers[category] = 1;
            });
            
            // Set up event listeners
            setupEventListeners();
            
            // Update all displays
            updateServiceButtons();
            updateCategoryDisplay();
            updateStats();
            updateEmployeeView();
            
            // Start timer for elapsed time updates
            setInterval(updateElapsedTimes, 1000);
            
            console.log('System initialized successfully');
        }

        function setupEventListeners() {
            // Window selector change
            document.getElementById('windowSelect').addEventListener('change', updateEmployeeView);
            
            // Accept button
            document.getElementById('acceptBtn').addEventListener('click', acceptNextQueue);
            
            // Complete button
            document.getElementById('completeBtn').addEventListener('click', completeCurrentService);
            
            // Add category button
            document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
            
            // Enter key in category input
            document.getElementById('categoryInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory();
                }
            });
        }

        function addCategory() {
            console.log('Add category function called');
            
            const input = document.getElementById('categoryInput');
            const categoryName = input.value.trim();
            
            if (!categoryName) {
                alert('Please enter a category name');
                return;
            }

            if (queueSystem.categories.length >= 6) {
                alert('Maximum 6 categories allowed');
                return;
            }

            if (queueSystem.categories.includes(categoryName)) {
                alert('Category already exists');
                return;
            }

            // Add the category
            queueSystem.categories.push(categoryName);
            queueSystem.nextQueueNumbers[categoryName] = 1;

            // Clear input
            input.value = '';

            // Update displays
            updateServiceButtons();
            updateCategoryDisplay();
            showNotification(`Category "${categoryName}" added successfully`);

            // ✅ Sync changes to server
            saveToServer();
        }

        function updateServiceButtons() {
            const serviceButtons = document.getElementById('serviceButtons');
            const serviceIcons = {
                'Cashier': '💰',
                'Registrar': '📝',
                'Information': 'ℹ️',
                'Service': '🛠️',
                'Support': '🎧',
                'Registration': '📋',
                'Default': '🏢'
            };

            serviceButtons.innerHTML = queueSystem.categories.map(category => {
                const icon = serviceIcons[category] || serviceIcons['Default'];
                return `
                    <div class="service-btn" onclick="generateQueueNumber('${category}')">
                        <span class="service-icon">${icon}</span>
                        ${category} Service
                    </div>
                `;
            }).join('');
        }

        function updateCategoryDisplay() {
            const container = document.getElementById('categoryList');
            if (!container) return;
            
            container.innerHTML = queueSystem.categories.map(category => 
                `<span class="category-pill">${category} (Next: ${String(queueSystem.nextQueueNumbers[category]).padStart(3, '0')})</span>`
            ).join('');
        }

        function switchTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab
            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');

            // Update displays when switching to public display
            if (tabName === 'display') {
                updatePublicDisplay();
            }
        }

        function generateQueueNumber(service) {
            if (!queueSystem.nextQueueNumbers[service]) {
                queueSystem.nextQueueNumbers[service] = 1;
            }

            const queueNumber = queueSystem.nextQueueNumbers[service]++;
            const formattedNumber = `${service} ${String(queueNumber).padStart(3, '0')}`;
            
            const queue = {
                number: queueNumber,
                formattedNumber: formattedNumber,
                service: service,
                timestamp: new Date(),
                status: 'waiting'
            };

            queueSystem.queues.push(queue);

            // Show customer their number
            document.getElementById('customerNumber').textContent = formattedNumber;
            document.getElementById('customerService').textContent = `Service: ${service}`;
            document.getElementById('customerQueue').style.display = 'block';

            showNotification(`Queue number ${formattedNumber} generated`);

            updateStats();
            updateEmployeeView();
            updatePublicDisplay();
            updateCategoryDisplay();

            // ✅ Sync changes to server
            saveToServer();
        }

        function acceptNextQueue() {
            const selectedWindow = document.getElementById('windowSelect').value;
            if (!selectedWindow) {
                alert('Please select a window first');
                return;
            }

            const nextQueue = queueSystem.queues.find(q => q.status === 'waiting');
            if (!nextQueue) {
                alert('No queues waiting');
                return;
            }

            const existingService = queueSystem.activeServices.find(s => s.window === selectedWindow);
            if (existingService) {
                alert('This window is already serving a customer. Complete current service first.');
                return;
            }

            nextQueue.status = 'serving';
            const service = {
                queueNumber: nextQueue.formattedNumber,
                service: nextQueue.service,
                window: selectedWindow,
                startTime: new Date(),
                employee: 'Current User'
            };

            queueSystem.activeServices.push(service);

            announceQueue(nextQueue.formattedNumber, selectedWindow);
            showNotification(`Queue ${nextQueue.formattedNumber} called to ${selectedWindow}`);

            updateEmployeeView();
            updatePublicDisplay();
            updateStats();

            // ✅ Sync changes to server
            saveToServer();
        }

        function completeCurrentService() {
            const selectedWindow = document.getElementById('windowSelect').value;
            if (!selectedWindow) return;

            const serviceIndex = queueSystem.activeServices.findIndex(s => s.window === selectedWindow);
            if (serviceIndex === -1) {
                alert('No active service for this window');
                return;
            }

            const service = queueSystem.activeServices[serviceIndex];
            
            queueSystem.activeServices.splice(serviceIndex, 1);

            const queueIndex = queueSystem.queues.findIndex(q => q.formattedNumber === service.queueNumber);
            if (queueIndex !== -1) {
                queueSystem.queues.splice(queueIndex, 1);
            }

            queueSystem.totalServed++;

            showNotification(`Service completed for queue ${service.queueNumber}`);

            updateEmployeeView();
            updatePublicDisplay();
            updateStats();

            // ✅ Sync changes to server
            saveToServer();
        }

        function announceQueue(formattedNumber, windowName) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(
                    `Queue number ${formattedNumber}, please proceed to ${windowName}`
                );
                utterance.rate = 0.8;
                utterance.pitch = 1;
                speechSynthesis.speak(utterance);
            }
        }

        function updateEmployeeView() {
            const selectedWindow = document.getElementById('windowSelect').value;
            const acceptBtn = document.getElementById('acceptBtn');
            const completeBtn = document.getElementById('completeBtn');
            const currentServing = document.getElementById('currentServing');

            if (selectedWindow) {
                acceptBtn.style.opacity = '1';
                acceptBtn.style.cursor = 'pointer';
                
                const currentService = queueSystem.activeServices.find(s => s.window === selectedWindow);
                if (currentService) {
                    completeBtn.style.opacity = '1';
                    completeBtn.style.cursor = 'pointer';
                    acceptBtn.style.opacity = '0.5';
                    acceptBtn.style.cursor = 'not-allowed';
                    
                    document.getElementById('servingNumber').textContent = currentService.queueNumber;
                    document.getElementById('servingService').textContent = currentService.service;
                    document.getElementById('servingTime').textContent = currentService.startTime.toLocaleTimeString();
                    currentServing.style.display = 'block';
                } else {
                    completeBtn.style.opacity = '0.5';
                    completeBtn.style.cursor = 'not-allowed';
                    currentServing.style.display = 'none';
                }
            } else {
                acceptBtn.style.opacity = '0.5';
                acceptBtn.style.cursor = 'not-allowed';
                completeBtn.style.opacity = '0.5';
                completeBtn.style.cursor = 'not-allowed';
                currentServing.style.display = 'none';
            }

            updatePendingQueues();
        }

        function updatePendingQueues() {
            const pendingList = document.getElementById('pendingList');
            const waitingQueues = queueSystem.queues.filter(q => q.status === 'waiting');

            if (waitingQueues.length === 0) {
                pendingList.innerHTML = '<p>No pending queues</p>';
                return;
            }

            pendingList.innerHTML = waitingQueues.map(queue => `
                <div class="queue-item">
                    <strong>Queue ${queue.formattedNumber}</strong> - ${queue.service}<br>
                    <small>Waiting since: ${queue.timestamp.toLocaleTimeString()}</small>
                </div>
            `).join('');
        }

        function updatePublicDisplay() {
            const tableBody = document.getElementById('displayTableBody');

            if (queueSystem.activeServices.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">No active services</td></tr>';
                return;
            }

            tableBody.innerHTML = queueSystem.activeServices.map(service => {
                const elapsedTime = getElapsedTime(service.startTime);
                return `
                    <tr>
                        <td><span class="status-indicator"></span>${service.window}</td>
                        <td><strong>${service.queueNumber}</strong></td>
                        <td>${elapsedTime}</td>
                    </tr>
                `;
            }).join('');
        }

        function updateElapsedTimes() {
            if (document.getElementById('display').classList.contains('active')) {
                updatePublicDisplay();
            }
        }

        function getElapsedTime(startTime) {
            const now = new Date();
            const elapsed = Math.floor((now - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        function updateStats() {
            const waitingCount = queueSystem.queues.filter(q => q.status === 'waiting').length;
            const avgWaitTime = calculateAverageWaitTime();

            document.getElementById('totalWaiting').textContent = waitingCount;
            document.getElementById('avgWaitTime').textContent = avgWaitTime;
            document.getElementById('servedToday').textContent = queueSystem.totalServed;
        }

        function calculateAverageWaitTime() {
            const waitingQueues = queueSystem.queues.filter(q => q.status === 'waiting');
            if (waitingQueues.length === 0) return 0;

            const totalWaitMinutes = waitingQueues.reduce((sum, queue) => {
                return sum + Math.floor((new Date() - queue.timestamp) / (1000 * 60));
            }, 0);

            return Math.floor(totalWaitMinutes / waitingQueues.length);
        }

        function showNotification(message) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.classList.add('show');

            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }