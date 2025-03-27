const express = require('express');
const session = require('express-session');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.static('ConvertedPDF'));
app.use(express.static(path.join(__dirname, '/')));

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const CONVERT_API_SECRET = 'secret_TWpuPgwXJQk7UlzT';

app.get('/', (req, res) => 
{
    res.sendFile(path.join(__dirname, 'Sensor Deploy Interface.html'));
});

//------------------- Database ---------------------------------------------
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs-extra');

app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(session({
    secret: '12345',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // false Local, deploy true
}));

// 测试数据库连接
async function testConnection() {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
        console.error("数据库连接失败：", error.message);
    } else {
        console.log("数据库连接成功！", data);
    }
}
testConnection();


//----------------------- Register/ Login------------------------------------------------------------------------------------
                app.post('/register', async (req, res) => {
                    const { username, password } = req.body;
                    
                    if (!username || !password) {
                        return res.status(400).json({ error: "用户名和密码不能为空" });
                    }

                    // 插入新用户
                    const { data, error } = await supabase
                        .from('users')
                        .insert([{ username, password }])
                        .select();

                    if (error) {
                        return res.status(500).json({ error: "注册失败：" + error.message });
                    }

                    const userId = data[0].user_id;

                    // 创建用户目录
                    const userFolder = path.join(__dirname, 'user', String(userId));
                    const layoutsFolder = path.join(userFolder, 'layouts');

                    try {
                        await fs.ensureDir(userFolder);
                        await fs.ensureDir(layoutsFolder);
                        res.json({ message: "注册成功！", userId });
                    } catch (err) {
                        res.status(500).json({ error: "创建用户文件夹失败：" + err.message });
                    }
                });
                //------------------- Login
                app.post('/login', async (req, res) => {
                    const { username, password } = req.body;

                    if (!username || !password) {
                        return res.status(400).json({ error: "用户名和密码不能为空" });
                    }

                    const { data, error } = await supabase
                        .from('users')
                        .select('user_id')
                        .eq('username', username)
                        .eq('password', password)
                        .single();

                    if (error || !data) {
                        return res.status(401).json({ error: "登录失败，用户名或密码错误" });
                    }

                    // 使用 session 存储 user_id
                    req.session.userId = data.user_id;
                    res.json({ message: "登录成功！", userId: data.user_id });
                });


// -------------------- Ensure Converted Directory Exists ------------------------

const ConvDir = path.join(__dirname, 'ConvertedPDF');
if (!fs.existsSync(ConvDir)) 
{
    fs.mkdirSync(ConvDir);
}

// -------------------- File Conversion Function -------------------------------

app.post('/convert', upload.single('file'), async (req, res) => 
{
    if (!req.file)
    {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).substring(1);

    try 
    {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath), {
            filename: req.file.originalname,
        });

        const response = await axios.post(
            `https://v2.convertapi.com/convert/${fileExtension}/to/pdf?secret=${CONVERT_API_SECRET}&storefile=true`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
            }
        );

        const pdfUrl = response.data.Files[0].Url;

        // download to server
        const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        const pdfPath = path.join(ConvDir, 'converted.pdf');
        fs.writeFileSync(pdfPath, pdfResponse.data);

        // return access url
        res.json({ pdfUrl: `${API_BASE_URL}/converted.pdf` });
    } 
    catch (error) 
    {
        console.error('Conversion error:', error);
        res.status(500).json({ error: 'Conversion failed' });
    } 
    finally 
    {
        if (fs.existsSync(filePath)) 
        {
            fs.unlinkSync(filePath);
        }
    }
});

// -------------------- Save Layout Endpoint ---------------------------------------------------------------------------------
                app.post('/save-layout', async (req, res) => {
                    const { userId, layoutName, rooms, pdfUrl } = req.body;

                    if (!userId || !layoutName) {
                        return res.status(400).json({ error: "userId and layoutName are required" });
                    }

                    try {
                        // 创建布局目录
                        const layoutDir = path.join(__dirname, 'user', userId, 'layouts');
                        await fs.ensureDir(layoutDir);

                        // 生成唯一的layoutId
                        const layoutId = Date.now().toString();

                        // 保存PDF文件
                        const pdfFileName = `${layoutId}.pdf`;
                        const pdfPath = path.join(layoutDir, pdfFileName);
                        
                        if (pdfUrl) {
                            const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
                            await fs.writeFile(pdfPath, pdfResponse.data);
                        }

                        // 保存布局元数据
                        const layoutData = {
                            layoutId,
                            layoutName,
                            rooms,
                            pdfUrl: pdfFileName,
                            createdAt: new Date().toISOString()
                        };

                        const layoutJsonPath = path.join(layoutDir, `${layoutId}.json`);
                        await fs.writeJson(layoutJsonPath, layoutData);

                        res.json({ 
                            message: "Layout saved successfully",
                            layoutId
                        });
                    } catch (error) {
                        console.error('Error saving layout:', error);
                        res.status(500).json({ error: "Failed to save layout" });
                    }
                });

// -------------------- Get User Layouts Endpoint -------------------------
                app.get('/user-layouts/:userId', async (req, res) => {
                    const { userId } = req.params;

                    try {
                        const layoutsDir = path.join(__dirname, 'user', userId, 'layouts');
                        if (!fs.existsSync(layoutsDir)) {
                            return res.json([]);
                        }

                        const files = await fs.readdir(layoutsDir);
                        const jsonFiles = files.filter(file => file.endsWith('.json'));

                        const layouts = [];
                        for (const file of jsonFiles) {
                            const filePath = path.join(layoutsDir, file);
                            const data = await fs.readJson(filePath);
                            layouts.push({
                                layoutId: data.layoutId,
                                layoutName: data.layoutName,
                                createdAt: data.createdAt
                            });
                        }

                        res.json(layouts);
                    } catch (error) {
                        console.error('Error fetching layouts:', error);
                        res.status(500).json({ error: "Failed to fetch layouts" });
                    }
                });

// -------------------- Load Layout Endpoint ------------------------------
                app.get('/load-layout/:userId/:layoutId', async (req, res) => {
                    const { userId, layoutId } = req.params;

                    try {
                        const layoutPath = path.join(__dirname, 'user', userId, 'layouts', `${layoutId}.json`);
                        const layoutData = await fs.readJson(layoutPath);

                        // 获取PDF文件
                        const pdfPath = path.join(__dirname, 'user', userId, 'layouts', layoutData.pdfUrl);
                        if (!fs.existsSync(pdfPath)) {
                            return res.status(404).json({ error: "PDF file not found" });
                        }

                        res.json({
                            ...layoutData,
                            pdfUrl: `${API_BASE_URL}/user/${userId}/layouts/${layoutData.pdfUrl}`
                        });
                    } catch (error) {
                        console.error('Error loading layout:', error);
                        res.status(500).json({ error: "Failed to load layout" });
                    }
                });

                // 添加静态文件服务用于访问用户布局文件
                app.use('/user', express.static(path.join(__dirname, 'user')));

// -------------------- Server Initialization ---------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => 
{
    console.log(`Server is running on port ${PORT}`);
});