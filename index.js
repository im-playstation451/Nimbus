const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const mode = process.argv[2];

const getValidKey = () => {
    try {
        return fs.readFileSync(path.join(__dirname, 'nimbus.key'), 'utf8').trim();
    } catch (err) {
        return null;
    }
};

if (mode === 'os') {
    const app = express();
    const PORT = process.env.PORT_OS || 3000;

    const authorize = (req, res, next) => {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || apiKey !== getValidKey()) return res.status(401).json({ error: 'Unauthorized' });
        next();
    };

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const targetDir = path.join(__dirname, 'storage', req.query.dir || 'uploads');
            fs.mkdirSync(targetDir, { recursive: true });
            cb(null, targetDir);
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    });

    const upload = multer({ storage });

    app.use(cors());
    app.use(express.json());

    app.post('/upload', authorize, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file' });
        const relativePath = path.relative(path.join(__dirname, 'storage'), req.file.path).replace(/\\/g, '/');
        res.status(201).json({
            success: true,
            cdn_url: `http://localhost:${process.env.PORT_CDN || 4000}/${relativePath}`,
            key: relativePath
        });
    });

    app.listen(PORT, () => console.log(`Nimbus Object Storage active on ${PORT}`));

} else if (mode === 'cdn') {
    const app = express();
    const PORT = process.env.PORT_CDN || 4000;
    const STORAGE_PATH = path.join(__dirname, 'storage');

    app.use(cors({ origin: process.env.ALLOWED_DOMAINS || '*' }));

    app.get('/{*path}', (req, res) => {
        const filePath = path.join(STORAGE_PATH, req.params.path || '');
        if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isDirectory()) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.set({
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
            'X-Powered-By': 'Nimbus-CDN',
            'Access-Control-Allow-Origin': '*'
        });
        res.sendFile(filePath);
    });

    app.listen(PORT, () => console.log(`Nimbus CDN active on ${PORT}`));

} else {
    console.log('Please specify a mode: npm run os OR npm run cdn');
}