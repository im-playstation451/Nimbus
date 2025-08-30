const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();

require('dotenv').config();

const allowedFolders = (process.env.SUB_CDN_FOLDERS || '').split(',').map(f => f.trim());

let apiKeys = [];
try {
  const data = fs.readFileSync('api.json', 'utf8');
  apiKeys = JSON.parse(data);
} catch (err) {
  console.error('Error reading API keys:', err.message);
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(`/cdn`, express.static(process.env.ROOT_CDN_FOLDER));

app.post('/upload', upload.single('file'), (req, res) => {
  const apiKey = req.header('Authorization');

  if (!apiKey || !apiKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const folder = req.body.folder?.trim();
  if (!folder || !allowedFolders.includes(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const ext = path.extname(req.file.originalname);
  const uniqueName = `${req.body.folder}-${Date.now()}-${path.basename(req.file.originalname, ext)}${ext}`;
  const uploadPath = path.join(process.env.ROOT_CDN_FOLDER, req.body.folder, uniqueName);

  try {
    const uploadDir = path.dirname(uploadPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(uploadPath, req.file.buffer);

    const fileUrl = `/cdn/${req.body.folder}/${uniqueName}`;
    res.json({ message: 'Uploaded successfully', fileUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save file' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Nimbus is thundering on http://localhost:${port}`);
});