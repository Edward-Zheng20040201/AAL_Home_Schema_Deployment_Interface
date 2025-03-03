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
app.use(express.static('public'));

const CONVERT_API_SECRET = 'secret_TWpuPgwXJQk7UlzT'; //访问的ConvertAPI 密匙

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
        formData.append('file', fs.createReadStream(filePath), 
        {
            filename: req.file.originalname, 
        });

        const response = await axios.post(
            `https://v2.convertapi.com/convert/${fileExtension}/to/pdf?secret=${CONVERT_API_SECRET}&storefile=true`,
            formData,
            {
                headers: 
                {
                    ...formData.getHeaders(), 
                },
            }
        );

        const pdfUrl = response.data.Files[0].Url;
        res.json({ pdfUrl });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => 
{
    console.log(`Server is running on port ${PORT}`);
});