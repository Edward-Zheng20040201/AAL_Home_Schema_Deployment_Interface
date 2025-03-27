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

//-------------------- Register ---------------------------------------------------------------------------------------------
function showLoginModal() {
    document.getElementById("login-modal").style.display = "flex";
    document.getElementById("register-modal").style.display = "none"; // 确保注册模态框隐藏
}

function showRegisterModal() {
    document.getElementById("register-modal").style.display = "flex";
    document.getElementById("login-modal").style.display = "none"; // 确保登录模态框隐藏
}

// 关闭模态框
function closeLoginModal() {
    document.getElementById("login-modal").style.display = "none";
}
function closeRegisterModal() {
    document.getElementById("register-modal").style.display = "none";
}

// 检查是否已登录
function checkLogin(action) {
    const userId = localStorage.getItem("userId");
    if (!userId) {
        showLoginModal();
    } else {
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


// -------------------- Schema Functions ----------------------------------------------------------------------------------------------------------

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
        throw error; // 抛出错误以便上层函数捕获
    }
}

function centerPDF() {
    const rect = SchemaContainer.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    offsetX = (window.innerWidth - containerWidth) / 2;
    offsetY = (window.innerHeight - containerHeight) / 2;

    SchemaContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${transformScale})`;
    
    // 确保房间元素也应用相同的变换
    rooms.forEach(room => {
        if (room.element) {
            room.element.style.transform = `scale(${1/transformScale})`;
        }
    });
}

function showPDFInstructions() 
{
    const instructions = `How to interact with the Schema:\n1. Use the mouse wheel to zoom in and out.\n2. Press the middle mouse button (or scroll wheel) and drag to move the Schema.`;
    alert(instructions);
}

// -------------------- Workspace Functions -------------------------------------------------------------------------------------------------------------

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

// -------------------- Sidebar Functions --------------------------------------------------------

function toggleSidebar() 
{
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('visible');
}

// -------------------- Room Creation Functions ---------------------------------------------------------------------------------------------
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

// -------------------- Save Layout Function ---------------------------------------------------------------------------------
                    async function saveLayout() {
                        if (!currentUserId) {
                            alert("Please login first");
                            return;
                        }

                        if (!currentPdfUrl) {
                            alert("Please upload a PDF first");
                            return;
                        }

                        const layoutName = prompt("Enter a name for this layout:");
                        if (!layoutName) return;

                        try {
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
                                    pdfUrl: currentPdfUrl
                                })
                            });

                            const result = await response.json();
                            if (response.ok) {
                                alert(`Layout "${layoutName}" saved successfully!`);
                            } else {
                                throw new Error(result.error || 'Failed to save layout');
                            }
                        } catch (error) {
                            console.error('Save layout error:', error);
                            alert(error.message);
                        }
                    }

// -------------------- Load Layout Function ------------------------------
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
                
                        // 清除当前工作区
                        SchemaContainer.innerHTML = '';
                        rooms = [];
                
                        // 加载PDF - 修改这里确保与renderPDF联动
                        currentPdfUrl = layoutData.pdfUrl;
                        
                        // 直接调用renderPDF函数并等待完成
                        await renderPDF(layoutData.pdfUrl);
                
                        // 加载房间 - 等待PDF渲染完成后再添加房间
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
                            
                            // 确保房间在正确的位置显示
                            centerPDF();
                        }
                
                        alert(`Layout "${layoutData.layoutName}" loaded successfully!`);
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

//--------------------- SENSOR MODAL 








//-------------------- RIGHT CLICK
SchemaContainer.addEventListener('contextmenu', (event) => 
    {
        event.preventDefault();
    
        const targetRoom = event.target.dataset.roomId;
        if (targetRoom) 
        {
            const room = rooms.find(r => r.id == targetRoom);
            if (room) 
            {
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