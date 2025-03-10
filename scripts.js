let scale = 1;
let currentPdfUrl = null;
let SchemaContainer = document.getElementById('Schema-Container');
let isDragging = false;
let startX, startY;
let offsetX = 0, offsetY = 0;
let transformScale = 1.5;

const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : 'https://home-schema-deploy.onrender.com';

// -------------------- Schema Functions ----------------------------------------------------------------------------------------------------------

SchemaContainer.style.overflow = 'hidden';
SchemaContainer.style.position = 'absolute';

async function uploadAndConvert() 
{
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) 
    {
        alert('Please select a DWG or DXF file.');/////******************************** Edit Later  */
        return;
    }

    let file = fileInput.files[0];
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
}

async function renderPDF(pdfUrl) //////////////////////**************** Note: Diff  Side render fix ****8*/
{
    SchemaContainer.innerHTML = '';

    if (!pdfUrl.startsWith('http')) 
    {
        if (window.location.protocol === 'file:') 
        {
            pdfUrl = 'http://localhost:3000' + pdfUrl;
        } 
        else 
        {
            pdfUrl = window.location.origin + pdfUrl;
        }
    }

    try 
    {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) 
        {
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
        showPDFInstructions();
    } 
    catch (error) 
    {
        console.error('Error rendering PDF:', error);
        alert('Failed to load PDF. Please check the file.');
    }
}

function centerPDF() 
{
    const rect = SchemaContainer.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    offsetX = (window.innerWidth - containerWidth) / 2;
    offsetY = (window.innerHeight - containerHeight) / 2;

    SchemaContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${transformScale})`;
}

function showPDFInstructions() 
{
    const instructions = `
        How to interact with the Schema:
        1. Use the mouse wheel to zoom in and out.
        2. Press the middle mouse button (or scroll wheel) and drag to move the Schema.
    `;
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

// -------------------- Room Creation Functions ----------------------------------------------------------------------------

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
    const room_instructions = `
        1. Click and drag to draw a room.
        2. Right click to name a room.
    `;
    alert(room_instructions);
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

SchemaContainer.addEventListener('contextmenu', (event) => 
{
    event.preventDefault();

    const targetRoom = event.target.dataset.roomId;
    if (targetRoom) 
    {
        const room = rooms.find(r => r.id == targetRoom);
        if (room) 
        {
            const newName = prompt('Enter room name:', room.name);
            if (newName) 
            {
                room.updateName(newName);
            }
        }
    }
});