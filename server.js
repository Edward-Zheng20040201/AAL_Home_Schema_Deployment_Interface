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
app.use('/icons', express.static(path.join(__dirname, 'icons')));

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const CONVERT_API_SECRET = 'secret_TWpuPgwXJQk7UlzT';

app.get('/', (req, res) => 
{
    res.sendFile(path.join(__dirname, 'Sensor Deploy Interface.html'));
});

//--- Database ---------------------------------------------
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


//-- Register/ Login------------------------------------------------------------------------------------
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

// -- File Conversion Function -------------------------------
                            const ConvDir = path.join(__dirname, 'ConvertedPDF');//check exist
                            if (!fs.existsSync(ConvDir)) 
                            {
                                fs.mkdirSync(ConvDir);
                            }

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

// -- Save Layout Endpoint ---------------------------------------------------------------------------------
                            app.post('/save-layout', async (req, res) => {
                                const { userId, layoutName, rooms, sensors, pdfUrl } = req.body;

                                if (!userId || !layoutName) {
                                    return res.status(400).json({ error: "userId and layoutName are required" });
                                }

                                try {
                                    const layoutDir = path.join(__dirname, 'user', userId, 'layouts');
                                    await fs.ensureDir(layoutDir);

                                    const layoutId = Date.now().toString();
                                    const pdfFileName = `${layoutId}.pdf`;
                                    const pdfPath = path.join(layoutDir, pdfFileName);

                                    if (pdfUrl) {
                                        const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
                                        await fs.writeFile(pdfPath, pdfResponse.data);
                                    }

                                    const layoutData = {
                                        layoutId,
                                        layoutName,
                                        rooms,
                                        sensors: sensors.map(sensor => ({
                                            id: sensor.id,
                                            type: sensor.type,
                                            x: sensor.x,
                                            y: sensor.y,
                                            deployedRoom: sensor.deployedRoom
                                        })),
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

// -- Get User Layouts Endpoint -------------------------
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

// - Check Layout Exists -------------------------
                            app.get('/check-layout/:userId/:layoutName', async (req, res) => {
                                const { userId, layoutName } = req.params;

                                try {
                                    const layoutsDir = path.join(__dirname, 'user', userId, 'layouts');
                                    if (!fs.existsSync(layoutsDir)) {
                                        return res.json({ exists: false });
                                    }

                                    const files = await fs.readdir(layoutsDir);
                                    const jsonFiles = files.filter(file => file.endsWith('.json'));

                                    for (const file of jsonFiles) {
                                        const filePath = path.join(layoutsDir, file);
                                        const data = await fs.readJson(filePath);
                                        if (data.layoutName === layoutName) {
                                            return res.json({ 
                                                exists: true,
                                                layoutId: data.layoutId
                                            });
                                        }
                                    }

                                    res.json({ exists: false });
                                } catch (error) {
                                    console.error('Error checking layout:', error);
                                    res.status(500).json({ error: "Failed to check layout" });
                                }
                            });

                            // -------------------- Update Layout -------------------------
                            app.put('/update-layout/:userId/:layoutId', async (req, res) => {
                                const { userId, layoutId } = req.params;
                                const { rooms, sensors, pdfUrl } = req.body;

                                try {
                                    const layoutDir = path.join(__dirname, 'user', userId, 'layouts');
                                    const layoutPath = path.join(layoutDir, `${layoutId}.json`);
                                    const existingData = await fs.readJson(layoutPath);

                                    // 更新PDF文件
                                    if (pdfUrl && pdfUrl !== existingData.pdfUrl) {
                                        const pdfFileName = `${layoutId}.pdf`;
                                        const pdfPath = path.join(layoutDir, pdfFileName);
                                        const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
                                        await fs.writeFile(pdfPath, pdfResponse.data);
                                        existingData.pdfUrl = pdfFileName;
                                    }

                                    // 更新房间和传感器数据
                                    existingData.rooms = rooms;
                                    existingData.sensors = sensors.map(sensor => ({
                                        id: sensor.id,
                                        type: sensor.type,
                                        x: sensor.x,
                                        y: sensor.y,
                                        deployedRoom: sensor.deployedRoom
                                    }));

                                    await fs.writeJson(layoutPath, existingData);

                                    res.json({ 
                                        message: "Layout updated successfully",
                                        layoutId
                                    });
                                } catch (error) {
                                    console.error('Error updating layout:', error);
                                    res.status(500).json({ error: "Failed to update layout" });
                                }
                            });

// - Load Layout Endpoint ------------------------------
                            app.get('/load-layout/:userId/:layoutId', async (req, res) => {
                                const { userId, layoutId } = req.params;

                                try {
                                    const layoutPath = path.join(__dirname, 'user', userId, 'layouts', `${layoutId}.json`);
                                    const layoutData = await fs.readJson(layoutPath);

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
// -- SensorML -------------------------------------------------------
                            // 创建 SensorML
                            app.post('/create-sensor-ml', async (req, res) => {
                                const { sensor_id, layout_id, sensor_ml } = req.body;

                                if (!sensor_id || !layout_id || !sensor_ml) {
                                    return res.status(400).json({ error: "sensor_id, layout_id, and sensor_ml are required" });
                                }

                                try {
                                    const { data, error } = await supabase
                                        .from('sensors')
                                        .insert([{ sensor_id, layout_id, sensor_ml }]);

                                    if (error) {
                                        throw error;
                                    }

                                    res.json({ message: "SensorML created successfully", data });
                                } catch (error) {
                                    console.error('Error creating SensorML:', error);
                                    res.status(500).json({ error: "Failed to create SensorML" });
                                }
                            });

                            // 更新 SensorML ****************check on this！！！！！！！！！！！！！！！！！！！！！！！！！！
                            app.put('/update-sensor-ml/:sensor_id', async (req, res) => {
                                const { sensor_id } = req.params;
                                const { sensor_ml } = req.body;

                                if (!sensor_ml) {
                                    return res.status(400).json({ error: "sensor_ml is required" });
                                }

                                try {
                                    const { data, error } = await supabase
                                        .from('sensors')
                                        .update({ sensor_ml })
                                        .eq('sensor_id', sensor_id);

                                    if (error) {
                                        throw error;
                                    }

                                    res.json({ message: "SensorML updated successfully", data });
                                } catch (error) {
                                    console.error('Error updating SensorML:', error);
                                    res.status(500).json({ error: "Failed to update SensorML" });
                                }
                            });
                            