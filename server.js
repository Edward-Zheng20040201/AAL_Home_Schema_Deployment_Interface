const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.static('ConvertedPDF'));

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const CONVERT_API_SECRET = 'secret_TWpuPgwXJQk7UlzT';

app.get('/', (req, res) => 
{
    res.sendFile(path.join(__dirname, 'Sensor Deploy Interface.html'));
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

// -------------------- Server Initialization ---------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => 
{
    console.log(`Server is running on port ${PORT}`);
});