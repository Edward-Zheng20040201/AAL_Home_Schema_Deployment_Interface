let scale = 1;
let currentPdfUrl = null;
let SchemaContainer = document.getElementById('Schema-Container');
let isDragging = false;
let startX, startY;
let offsetX = 0, offsetY = 0;
let transformScale = 1.5;
let currentUserId = null;

const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : 'https://home-schema-deploy.onrender.com';

//----Register ---------------------------------------------------------------------------------------------
                        function showLoginModal() 
                        {
                            document.getElementById("login-modal").style.display = "flex";
                            document.getElementById("register-modal").style.display = "none"; // 确保注册模态框隐藏
                        }

                        function showRegisterModal() 
                        {
                            document.getElementById("register-modal").style.display = "flex";
                            document.getElementById("login-modal").style.display = "none"; // 确保登录模态框隐藏
                        }

                        // 关闭模态框
                        function closeLoginModal() 
                        {
                            document.getElementById("login-modal").style.display = "none";
                        }
                        function closeRegisterModal() 
                        {
                            document.getElementById("register-modal").style.display = "none";
                        }

                        // 检查是否已登录
                        function checkLogin(action) 
                        {
                            const userId = localStorage.getItem("userId");
                            if (!userId) 
                            {
                                showLoginModal();
                            } 
                            else 
                            {
                                action();
                            }
                        }

                        // 登录逻辑
                        async function login() 
                        {
                            console.log("Login function called");
                            const username = document.getElementById('username').value;
                            const password = document.getElementById('password').value;
                            console.log("Attempting login with:", username, password);

                            const response = await fetch(`${API_BASE_URL}/login`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username, password })
                            });

                            const result = await response.json();
                            if (response.ok) {
                                alert("Login successful!");
                                localStorage.setItem("userId", result.userId);
                                updateUI();
                                closeLoginModal();
                            } else {
                                alert(result.error);
                            }
                        }

                        // 
                        async function register() {
                            const username = document.getElementById('reg-username').value;
                            const password = document.getElementById('reg-password').value;

                            const response = await fetch(`${API_BASE_URL}/register`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username, password })
                            });

                            const result = await response.json();
                            if (response.ok) {
                                alert("Registration successful! Please login.");
                                closeRegisterModal();
                                showLoginModal();
                            } else {
                                alert(result.error);
                            }
                        }

                        function logout() {
                            localStorage.removeItem("userId");
                            alert("Logged out successfully!");
                            updateUI();
                        }

                        function updateUI() {
                            const userId = localStorage.getItem("userId");
                            currentUserId = userId;
                            document.getElementById("sign-out-btn").style.display = userId ? "block" : "none";
                        }

                        // 页面加载时检查是否已登录
                        window.onload = updateUI;


// --- Schema Functions ----------------------------------------------------------------------------------------------------------

                            SchemaContainer.style.overflow = 'hidden';
                            SchemaContainer.style.position = 'absolute';

                            async function uploadAndConvert() 
                            {
                                const fileInput = document.createElement('input');
                                fileInput.type = 'file';
                                fileInput.accept = '.dwg,.dxf';
                                fileInput.onchange = async (event) => 
                                {
                                    const file = event.target.files[0];
                                    if (!file) 
                                    {
                                        alert('Please select a DWG or DXF file.');
                                        return;
                                    }

                                    let formData = new FormData();
                                    formData.append("file", file);

                                    try 
                                    {
                                        let response = await fetch(`${API_BASE_URL}/convert`, 
                                        {
                                            method: 'POST',
                                            body: formData
                                        });

                                        if (!response.ok) 
                                        {
                                            let errorData = await response.json();
                                            throw new Error(errorData.error || 'Conversion failed');
                                        }

                                        let result = await response.json();

                                        if (result.pdfUrl) 
                                        {
                                            currentPdfUrl = result.pdfUrl;
                                            renderPDF(currentPdfUrl);
                                        } 
                                        else 
                                        {
                                            alert('Conversion failed. Please try again.');
                                        }
                                    } 
                                    catch (error) 
                                    {
                                        console.error('Upload error:', error);
                                        alert(error.message || 'Error uploading file.');
                                    }
                                };
                                fileInput.click();
                            }

                            async function renderPDF(pdfUrl) {
                                SchemaContainer.innerHTML = '';

                                try {
                                    const loadingTask = pdfjsLib.getDocument(pdfUrl);
                                    const pdf = await loadingTask.promise;

                                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                                        const page = await pdf.getPage(pageNum);
                                        const viewport = page.getViewport({ scale: scale * 3 });

                                        const canvas = document.createElement('canvas');
                                        const context = canvas.getContext('2d');

                                        canvas.width = viewport.width * 2;
                                        canvas.height = viewport.height * 2;
                                        canvas.style.width = `${viewport.width}px`;
                                        canvas.style.height = `${viewport.height}px`;

                                        SchemaContainer.appendChild(canvas);

                                        context.scale(2, 2);

                                        await page.render({
                                            canvasContext: context,
                                            viewport: viewport
                                        }).promise;
                                    }

                                    centerPDF();
                                } catch (error) {
                                    console.error('Error rendering PDF:', error);
                                    throw error; 
                                }
                            }

                            function centerPDF() {
                                const rect = SchemaContainer.getBoundingClientRect();
                                const containerWidth = rect.width;
                                const containerHeight = rect.height;

                                offsetX = (window.innerWidth - containerWidth) / 2;
                                offsetY = (window.innerHeight - containerHeight) / 2;

                                SchemaContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${transformScale})`;
                                
                                rooms.forEach(room => {
                                    if (room.element) {
                                        room.element.style.transform = `scale(${1/transformScale})`;//8888888888888888888888888888888
                                    }
                                });
                            }

                            function showPDFInstructions() 
                            {
                                const instructions = `How to interact with the Schema:\n1. Use the mouse wheel to zoom in and out.\n2. Press the middle mouse button (or scroll wheel) and drag to move the Schema.`;
                                alert(instructions);
                            }

// ---- Workspace Functions -------------------------------------------------------------------------------------------------------------

                            SchemaContainer.addEventListener('wheel', (event) => 
                            {
                                event.preventDefault();

                                const scaleStep = 0.05;
                                transformScale += event.deltaY > 0 ? -scaleStep : scaleStep;
                                transformScale = Math.min(Math.max(0.5, transformScale), 3);

                                SchemaContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${transformScale})`;
                            });

                            SchemaContainer.addEventListener('mousedown', (event) => 
                            {
                                if (event.button === 1) 
                                {
                                    event.preventDefault();
                                    isDragging = true;
                                    startX = event.clientX;
                                    startY = event.clientY;
                                }
                            });

                            SchemaContainer.addEventListener('mousemove', (event) => 
                            {
                                if (isDragging) 
                                {
                                    offsetX += event.clientX - startX;
                                    offsetY += event.clientY - startY;
                                    startX = event.clientX;
                                    startY = event.clientY;

                                    SchemaContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${transformScale})`;
                                }
                            });

                            SchemaContainer.addEventListener('mouseup', () => 
                            {
                                isDragging = false;
                            });

                            SchemaContainer.addEventListener('mouseleave', () => 
                            {
                                isDragging = false;
                            });

// --- Sidebar Functions --------------------------------------------------------

                            function toggleSidebar() 
                            {
                                const sidebar = document.querySelector('.sidebar');
                                sidebar.classList.toggle('visible');
                            }

//----- Room Creation Functions ---------------------------------------------------------------------------------------------
                            let rooms = [];
                            let isCreatingRoom = false;
                            let currentRoom = null;

                            class Room 
                            {
                                constructor(x, y, width, height, name) 
                                {
                                    this.id = rooms.length + 1;
                                    this.x = x;
                                    this.y = y;
                                    this.width = width;
                                    this.height = height;
                                    this.name = name || `Room ${this.id}`;
                                    this.element = null;
                                }

                                createElement() 
                                {
                                    const div = document.createElement('div');
                                    div.style.position = 'absolute';
                                    div.style.left = `${this.x}px`;
                                    div.style.top = `${this.y}px`;
                                    div.style.width = `${this.width}px`;
                                    div.style.height = `${this.height}px`;
                                    div.style.border = '2px solid blue';
                                    div.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
                                    div.style.pointerEvents = 'auto';
                                    div.dataset.roomId = this.id;
                                    this.element = div;
                                    SchemaContainer.appendChild(div);
                                }

                                updateName(newName) 
                                {
                                    this.name = newName;
                                    if (this.element) 
                                    {
                                        this.element.textContent = newName;
                                    }
                                }
                            }

                            function startCreateRoom() 
                            {
                                isCreatingRoom = true;
                            }

                            SchemaContainer.addEventListener('mousedown', (event) => 
                            {
                                if (isCreatingRoom && event.button === 0) 
                                {
                                    event.preventDefault();
                                    const rect = SchemaContainer.getBoundingClientRect();
                                    
                                    startX = (event.clientX - rect.left) / transformScale;
                                    startY = (event.clientY - rect.top) / transformScale;

                                    currentRoom = new Room(startX, startY, 0, 0);
                                    currentRoom.createElement();
                                }
                            });

                            SchemaContainer.addEventListener('mousemove', (event) => 
                            {
                                if (isCreatingRoom && currentRoom) 
                                {
                                    const rect = SchemaContainer.getBoundingClientRect();
                                    
                                    const endX = (event.clientX - rect.left) / transformScale;
                                    const endY = (event.clientY - rect.top) / transformScale;

                                    const width = Math.abs(endX - startX);
                                    const height = Math.abs(endY - startY);

                                    currentRoom.x = Math.min(startX, endX);
                                    currentRoom.y = Math.min(startY, endY);
                                    currentRoom.width = width;
                                    currentRoom.height = height;

                                    currentRoom.element.style.left = `${currentRoom.x}px`;
                                    currentRoom.element.style.top = `${currentRoom.y}px`;
                                    currentRoom.element.style.width = `${currentRoom.width}px`;
                                    currentRoom.element.style.height = `${currentRoom.height}px`;
                                }
                            });

                            SchemaContainer.addEventListener('mouseup', (event) => 
                            {
                                if (isCreatingRoom && currentRoom && event.button === 0) 
                                {
                                    isCreatingRoom = false;
                                    rooms.push(currentRoom);
                                    currentRoom = null;
                                }
                            });
//-- Sensor Functions -----------------------------------------------------------------------
                            let sensors = [];
                            let isDraggingSensor = false;
                            let draggedSensor = null;

                            class Sensor {
                                constructor(type, x, y, deployedRoom = null) {
                                    this.id = sensors.length + Date.now(); 
                                    this.type = type;
                                    this.x = x;
                                    this.y = y;
                                    this.deployedRoom = deployedRoom;
                                    this.sensorML = null; 
                                    this.element = null;
                                }

                                createElement() {
                                    const img = document.createElement('img');
                                    img.src = './icons/sensor_icons/default.png';
                                    img.className = 'sensor-icon';
                                    img.style.left = `${this.x}px`;
                                    img.style.top = `${this.y}px`;
                                    img.dataset.sensorId = this.id;
                                    this.element = img;
                                    SchemaContainer.appendChild(img);
                                }

                                updatePosition(x, y) {
                                    this.x = x;
                                    this.y = y;
                                    if (this.element) {
                                        this.element.style.left = `${this.x}px`;
                                        this.element.style.top = `${this.y}px`;
                                    }
                                }

                                updateDeployedRoom(roomName) {
                                    this.deployedRoom = roomName;
                                }

                                removeElement() {
                                    if (this.element) {
                                        this.element.remove();
                                    }
                                }
                            }

                            // Sensor Drag-and-Drop from Sidebar
                            document.querySelectorAll('.sensor-item').forEach(sensorItem => {
                                sensorItem.addEventListener('dragstart', (event) => {
                                    const sensorType = event.target.dataset.sensorType;
                                    event.dataTransfer.setData('sensorType', sensorType);
                                    draggedSensor = null;
                                    isDraggingSensor = true;

                                    // Show icon during drag
                                    const img = new Image();
                                    img.src = './icons/sensor_icons/default.png'; // Updated path
                                    event.dataTransfer.setDragImage(img, 12, 12);
                                });
                            });

                            // Handle drag over SchemaContainer
                            SchemaContainer.addEventListener('dragover', (event) => {
                                event.preventDefault();
                            });

                            // Handle drop on SchemaContainer
                            SchemaContainer.addEventListener('drop', (event) => {
                                event.preventDefault();
                                if (!isDraggingSensor) return;

                                const rect = SchemaContainer.getBoundingClientRect();
                                const dropX = (event.clientX - rect.left) / transformScale;
                                const dropY = (event.clientY - rect.top) / transformScale;

                                // Check if drop is within a room
                                const targetRoom = rooms.find(room => 
                                    dropX >= room.x && dropX <= room.x + room.width &&
                                    dropY >= room.y && dropY <= room.y + room.height
                                );

                                if (!targetRoom) {
                                    alert('Sensors can only be deployed within a room.');
                                    isDraggingSensor = false;
                                    draggedSensor = null;
                                    return;
                                }

                                if (draggedSensor) {
                                    // Moving an existing sensor
                                    draggedSensor.updatePosition(dropX, dropY);
                                    draggedSensor.updateDeployedRoom(targetRoom.name);
                                } else {
                                    // Creating a new sensor
                                    const sensorType = event.dataTransfer.getData('sensorType');
                                    const newSensor = new Sensor(sensorType, dropX, dropY, targetRoom.name);
                                    newSensor.createElement();
                                    sensors.push(newSensor);
                                }

                                isDraggingSensor = false;
                                draggedSensor = null;
                            });

                            // Handle dragging existing sensors
                            SchemaContainer.addEventListener('dragstart', (event) => {
                                const sensorId = event.target.dataset.sensorId;
                                if (sensorId) {
                                    draggedSensor = sensors.find(s => s.id == sensorId);
                                    if (draggedSensor) {
                                        isDraggingSensor = true;
                                        event.dataTransfer.setDragImage(draggedSensor.element, 12, 12);
                                    }
                                }
                            });
// - Save Layout Function ---------------------------------------------------------------------------------
                            let currentLayoutId = null; // 添加全局变量跟踪当前布局ID

                            async function saveLayout() {
                                if (!currentUserId) {
                                    alert("Please login first");
                                    return;
                                }

                                if (!currentPdfUrl) {
                                    alert("Please upload a PDF first");
                                    return;
                                }

                                // 如果没有当前布局ID，则执行另存为
                                if (!currentLayoutId) {
                                    saveLayoutAs();
                                    return;
                                }

                                try {
                                    const response = await fetch(`${API_BASE_URL}/update-layout/${currentUserId}/${currentLayoutId}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            rooms: rooms.map(room => ({
                                                id: room.id,
                                                x: room.x,
                                                y: room.y,
                                                width: room.width,
                                                height: room.height,
                                                name: room.name
                                            })),
                                            sensors: sensors.map(sensor => ({
                                                id: sensor.id,
                                                type: sensor.type,
                                                x: sensor.x,
                                                y: sensor.y,
                                                deployedRoom: sensor.deployedRoom
                                            })),
                                            pdfUrl: currentPdfUrl
                                        })
                                    });

                                    const result = await response.json();
                                    if (response.ok) {
                                        alert(`Layout updated successfully!`);
                                    } else {
                                        throw new Error(result.error || 'Failed to save layout');
                                    }
                                } catch (error) {
                                    console.error('Save layout error:', error);
                                    alert(error.message);
                                }
                            }

                            async function saveLayoutAs() {
                                if (!currentUserId) {
                                    alert("Please login first");
                                    return;
                                }

                                if (!currentPdfUrl) {
                                    alert("Please upload a PDF first");
                                    return;
                                }

                                let layoutName = prompt("Enter a name for this layout:");
                                if (!layoutName) return;

                                // 检查布局是否已存在
                                try {
                                    const checkResponse = await fetch(`${API_BASE_URL}/check-layout/${currentUserId}/${layoutName}`);
                                    const checkResult = await checkResponse.json();

                                    if (checkResult.exists) {
                                        const confirmOverwrite = confirm(`Layout "${layoutName}" already exists. Do you want to overwrite it?`);
                                        if (!confirmOverwrite) {
                                            return saveLayoutAs(); // 递归调用让用户重新输入名称
                                        }
                                        currentLayoutId = checkResult.layoutId;
                                        return saveLayout(); // 调用保存函数
                                    }

                                    // 创建新布局
                                    const response = await fetch(`${API_BASE_URL}/save-layout`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            userId: currentUserId,
                                            layoutName,
                                            rooms: rooms.map(room => ({
                                                id: room.id,
                                                x: room.x,
                                                y: room.y,
                                                width: room.width,
                                                height: room.height,
                                                name: room.name
                                            })),
                                            sensors: sensors.map(sensor => ({
                                                id: sensor.id,
                                                type: sensor.type,
                                                x: sensor.x,
                                                y: sensor.y,
                                                deployedRoom: sensor.deployedRoom
                                            })),
                                            pdfUrl: currentPdfUrl
                                        })
                                    });

                                    const result = await response.json();
                                    if (response.ok) {
                                        currentLayoutId = result.layoutId;
                                        alert(`Layout "${layoutName}" saved successfully!`);
                                    } else {
                                        throw new Error(result.error || 'Failed to save layout');
                                    }
                                } catch (error) {
                                    console.error('Save layout error:', error);
                                    alert(error.message);
                                }
                            }
//- Load Layout Function ------------------------------
                            async function loadLayout() {
                                if (!currentUserId) {
                                    alert("Please login first");
                                    return;
                                }

                                // 创建加载布局的模态框
                                const loadModal = document.createElement('div');
                                loadModal.style.position = 'fixed';
                                loadModal.style.top = '50%';
                                loadModal.style.left = '50%';
                                loadModal.style.transform = 'translate(-50%, -50%)';
                                loadModal.style.backgroundColor = 'white';
                                loadModal.style.padding = '20px';
                                loadModal.style.zIndex = '10000';
                                loadModal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                                loadModal.style.width = '400px';
                                loadModal.style.maxHeight = '80vh';
                                loadModal.style.overflowY = 'auto';
                                
                                loadModal.innerHTML = `
                                    <h2>Select a Layout to Load</h2>
                                    <div id="layouts-list" style="margin: 10px 0;"></div>
                                    <button onclick="document.body.removeChild(this.parentNode)">Cancel</button>
                                `;
                                
                                document.body.appendChild(loadModal);

                                try {
                                    // 获取用户布局列表
                                    const response = await fetch(`${API_BASE_URL}/user-layouts/${currentUserId}`);
                                    const layouts = await response.json();

                                    const layoutsList = document.getElementById('layouts-list');
                                    if (layouts.length === 0) {
                                        layoutsList.innerHTML = '<p>No saved layouts found</p>';
                                        return;
                                    }

                                    layouts.forEach(layout => {
                                        const layoutDiv = document.createElement('div');
                                        layoutDiv.style.padding = '10px';
                                        layoutDiv.style.borderBottom = '1px solid #eee';
                                        layoutDiv.style.cursor = 'pointer';
                                        
                                        layoutDiv.innerHTML = `
                                            <h3>${layout.layoutName}</h3>
                                            <p>Created: ${new Date(layout.createdAt).toLocaleString()}</p>
                                        `;
                                        
                                        layoutDiv.addEventListener('click', async () => {
                                            await loadSpecificLayout(layout.layoutId);
                                            document.body.removeChild(loadModal);
                                        });
                                        
                                        layoutsList.appendChild(layoutDiv);
                                    });
                                } catch (error) {
                                    console.error('Error loading layouts:', error);
                                    alert('Failed to load layouts');
                                }
                            }

                            async function loadSpecificLayout(layoutId) {
                                try {
                                    const response = await fetch(`${API_BASE_URL}/load-layout/${currentUserId}/${layoutId}`);
                                    const layoutData = await response.json();
                            
                                    if (!response.ok) {
                                        throw new Error(layoutData.error || 'Failed to load layout');
                                    }
                            
                                    // 设置当前布局ID
                                    currentLayoutId = layoutId;

                                    // Clear current workspace
                                    SchemaContainer.innerHTML = '';
                                    rooms = [];
                                    sensors = [];

                                    // Load PDF
                                    currentPdfUrl = layoutData.pdfUrl;
                                    await renderPDF(layoutData.pdfUrl);

                                    // Load rooms
                                    if (layoutData.rooms && layoutData.rooms.length > 0) {
                                        layoutData.rooms.forEach(roomData => {
                                            const room = new Room(
                                                roomData.x,
                                                roomData.y,
                                                roomData.width,
                                                roomData.height,
                                                roomData.name
                                            );
                                            room.id = roomData.id;
                                            room.createElement();
                                            rooms.push(room);
                                        });
                                    }

                                    // Load sensors
                                    if (layoutData.sensors && layoutData.sensors.length > 0) {
                                        layoutData.sensors.forEach(sensorData => {
                                            const sensor = new Sensor(
                                                sensorData.type,
                                                sensorData.x,
                                                sensorData.y,
                                                sensorData.deployedRoom
                                            );
                                            sensor.id = sensorData.id;
                                            sensor.createElement();
                                            sensors.push(sensor);
                                        });
                                    }

                                    // Center everything
                                    centerPDF();

                                } catch (error) {
                                    console.error('Error loading specific layout:', error);
                                    alert(error.message);
                                }
                            }

//------------------------ Modals ------------------------------------------------------------------------------------------------
                            const overlay = document.createElement('div');
                            overlay.style.display = 'none';
                            overlay.style.position = 'fixed';
                            overlay.style.top = '0';
                            overlay.style.left = '0';
                            overlay.style.width = '100%';
                            overlay.style.height = '100%';
                            overlay.style.backgroundColor = 'rgba(80, 66, 66, 0.5)';
                            overlay.style.zIndex = '9999';
                            document.body.appendChild(overlay);

                            //--------------- ROOM MODAL
                            const roomModal = document.createElement('div');
                            roomModal.style.display = 'none';
                            roomModal.style.position = 'fixed';
                            roomModal.style.top = '50%';
                            roomModal.style.left = '50%';
                            roomModal.style.transform = 'translate(-50%, -50%)';
                            roomModal.style.backgroundColor = 'white';
                            roomModal.style.padding = '20px';
                            roomModal.style.zIndex = '10000';
                            roomModal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                            roomModal.innerHTML = `
                                <input type="text" id="roomNameInput" placeholder="Enter room name">
                                <button id="saveRoomName">Save</button>
                                <button id="deleteRoom">Delete</button>
                                <button id="closeroomModal">Close</button>
                            `;
                            document.body.appendChild(roomModal);

                            function showroomModal(room) 
                            {
                                roomModal.style.display = 'block';
                                overlay.style.display = 'block';
                                document.getElementById('roomNameInput').value = room.name;

                                document.getElementById('saveRoomName').onclick = () => 
                                {
                                    const newName = document.getElementById('roomNameInput').value;
                                    if (newName) 
                                    {
                                        room.updateName(newName);
                                    }
                                    hideroomModal();
                                };

                                document.getElementById('deleteRoom').onclick = () => 
                                {
                                    room.element.remove();
                                    rooms = rooms.filter(r => r.id !== room.id);
                                    hideroomModal();
                                };

                                document.getElementById('closeroomModal').onclick = hideroomModal;
                            }

                            function hideroomModal() 
                            {
                                roomModal.style.display = 'none';
                                overlay.style.display = 'none';
                            }

                            //----- SENSOR MODAL 
                            const sensorModal = document.createElement('div');
                            sensorModal.style.display = 'none';
                            sensorModal.style.position = 'fixed';
                            sensorModal.style.top = '50%';
                            sensorModal.style.left = '50%';
                            sensorModal.style.transform = 'translate(-50%, -50%)';
                            sensorModal.style.backgroundColor = 'white';
                            sensorModal.style.padding = '20px';
                            sensorModal.style.zIndex = '10000';
                            sensorModal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                            sensorModal.style.width = '600px';
                            sensorModal.style.maxHeight = '80vh';
                            sensorModal.style.overflow = 'auto';
                            sensorModal.innerHTML = `
                                <h3>Sensor Details</h3>
                                <p>Type: <span id="sensorType"></span></p>
                                <p>Deployed Room: <span id="sensorRoom"></span></p>
                                <div style="margin: 15px 0;">
                                    <h4>SensorML Configuration</h4>
                                    <textarea id="sensorMLContent" style="width: 100%; height: 200px; font-family: monospace;"></textarea>
                                    <div style="margin-top: 10px;">
                                        <button id="loadSampleSensorML">Load Sample</button>
                                        <button id="saveSensorML">Save Configuration</button>
                                    </div>
                                </div>
                                <div style="margin-top: 15px;">
                                    <button id="deleteSensor">Delete</button>
                                    <button id="closeSensorModal">Close</button>
                                </div>
                            `;
                            document.body.appendChild(sensorModal);

                            let currentSensor = null;

                            function showSensorModal(sensor) {
                                currentSensor = sensor;
                                sensorModal.style.display = 'block';
                                overlay.style.display = 'block';
                                document.getElementById('sensorType').textContent = sensor.type;
                                document.getElementById('sensorRoom').textContent = sensor.deployedRoom || 'None';
                                
                                // Load existing SensorML or empty template
                                loadSensorMLContent(sensor.id);

                                document.getElementById('loadSampleSensorML').onclick = () => {
                                    // Load the sample SensorML content
                                    fetch('physicalSystemInstance_standardConform.xml')
                                        .then(response => response.text())
                                        .then(data => {
                                            document.getElementById('sensorMLContent').value = data;
                                        })
                                        .catch(error => {
                                            console.error('Error loading sample SensorML:', error);
                                            alert('Failed to load sample SensorML');
                                        });
                                };

                                document.getElementById('saveSensorML').onclick = async () => {
                                    const sensorMLContent = document.getElementById('sensorMLContent').value;
                                    if (!sensorMLContent) {
                                        alert('SensorML content cannot be empty');
                                        return;
                                    }

                                    try {
                                        const response = await fetch(`${API_BASE_URL}/update-sensor-ml/${sensor.id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ 
                                                sensor_ml: sensorMLContent,
                                                layout_id: currentLayoutId
                                            })
                                        });

                                        const result = await response.json();
                                        if (response.ok) {
                                            alert('SensorML saved successfully!');
                                        } else {
                                            throw new Error(result.error || 'Failed to save SensorML');
                                        }
                                    } catch (error) {
                                        console.error('Error saving SensorML:', error);
                                        alert(error.message);
                                    }
                                };

                                document.getElementById('deleteSensor').onclick = () => {
                                    if (confirm('Are you sure you want to delete this sensor?')) {
                                        sensor.removeElement();
                                        sensors = sensors.filter(s => s.id !== sensor.id);
                                        hideSensorModal();
                                        
                                        // Also delete from Supabase if needed
                                        deleteSensorML(sensor.id);
                                    }
                                };

                                document.getElementById('closeSensorModal').onclick = hideSensorModal;
                            }

                            async function loadSensorMLContent(sensorId) {
                                try {
                                    const response = await fetch(`${API_BASE_URL}/get-sensor-ml/${sensorId}`);
                                    const result = await response.json();
                                    
                                    if (response.ok && result.sensor_ml) {
                                        document.getElementById('sensorMLContent').value = result.sensor_ml;
                                    } else {
                                        // Load empty template if no SensorML exists
                                        document.getElementById('sensorMLContent').value = 
                                            '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Add your SensorML configuration here -->';
                                    }
                                } catch (error) {
                                    console.error('Error loading SensorML:', error);
                                    document.getElementById('sensorMLContent').value = 
                                        '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Error loading SensorML -->';
                                }
                            }

                            async function deleteSensorML(sensorId) {
                                try {
                                    await fetch(`${API_BASE_URL}/delete-sensor-ml/${sensorId}`, {
                                        method: 'DELETE'
                                    });
                                } catch (error) {
                                    console.error('Error deleting SensorML:', error);
                                }
                            }

                            function hideSensorModal() {
                                sensorModal.style.display = 'none';
                                overlay.style.display = 'none';
                                currentSensor = null;
                            }



//-------------------- RIGHT CLICK
                            SchemaContainer.addEventListener('contextmenu', (event) => {
                                event.preventDefault();

                                const targetSensor = event.target.dataset.sensorId;
                                const targetRoom = event.target.dataset.roomId;

                                if (targetSensor) {
                                    const sensor = sensors.find(s => s.id == targetSensor);
                                    if (sensor) {
                                        showSensorModal(sensor);
                                    }
                                } else if (targetRoom) {
                                    const room = rooms.find(r => r.id == targetRoom);
                                    if (room) {
                                        showroomModal(room);
                                    }
                                }
                            });


//----------------- Hover Message -----------------------------------------------------------------
                            const hoverTargets = document.querySelectorAll('.hover-target');
                            const hoverMessage = document.getElementById('hoverMessage');

                            hoverTargets.forEach(target => {
                                target.addEventListener('mouseenter', (e) => {
                                const message = e.target.getAttribute('data-hover-message');
                                hoverMessage.textContent = message;

                                // Position the hover message near the hovered element
                                const rect = e.target.getBoundingClientRect();

                                hoverMessage.style.display = 'block';
                                });

                                target.addEventListener('mouseleave', () => {
                                hoverMessage.style.display = 'none';
                                });
                            });