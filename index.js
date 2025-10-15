const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
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

app.use(cors());
app.use(express.json()); // Add this line to parse JSON request bodies
app.use(`/cdn`, express.static(process.env.ROOT_CDN_FOLDER));

// Endpoint to handle JSON file updates
app.post('/update-json', (req, res) => {
  const apiKey = req.header('Authorization');

  if (!apiKey || !apiKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { folder, filename, data } = req.body;

  if (!folder || !allowedFolders.includes(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  if (!filename || !filename.endsWith('.json')) {
    return res.status(400).json({ error: 'Invalid filename. Must be a .json file.' });
  }

  if (data === undefined) {
    return res.status(400).json({ error: 'No JSON data provided.' });
  }

  const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const uploadPath = path.join(process.env.ROOT_CDN_FOLDER, folder, cleanFilename);
  const resolvedPath = path.resolve(uploadPath);

  if (!resolvedPath.startsWith(path.resolve(process.env.ROOT_CDN_FOLDER))) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  try {
    const uploadDir = path.dirname(resolvedPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let existingContent = '[]'; // Default to an empty array for user data
    if (fs.existsSync(resolvedPath)) {
      existingContent = fs.readFileSync(resolvedPath, 'utf8');
    }

    let users = [];
    try {
      const parsedContent = JSON.parse(existingContent);
      if (Array.isArray(parsedContent)) {
        users = parsedContent;
      } else if (typeof parsedContent === 'object' && parsedContent !== null) {
        // If the file contains a single object, convert it to an array for new additions
        users = [parsedContent];
      }
    } catch (parseError) {
      // If file is empty or invalid JSON, 'users' remains an empty array
      console.warn(`Warning: Could not parse existing JSON file at ${resolvedPath}. Initializing as empty array.`);
    }

    // Add the new user data to the array
    users.push(data);

    fs.writeFileSync(resolvedPath, JSON.stringify(users, null, 2), 'utf8');
    const fileUrl = `/cdn/${folder}/${cleanFilename}`;
    res.json({ message: 'User added successfully', fileUrl });
  } catch (err) {
    console.error('Error adding user to JSON file:', err);
    res.status(500).json({ error: 'Failed to add user to JSON file' });
  }
});

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

  const userProvidedName = req.body.filename?.trim();
  const baseName = userProvidedName || path.basename(req.file.originalname, ext);
  
  const cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, '');
  const finalName = `${cleanName}${ext}`;

  const uploadPath = path.join(process.env.ROOT_CDN_FOLDER, folder, finalName);
  const resolvedPath = path.resolve(uploadPath);

  if (!resolvedPath.startsWith(path.resolve(process.env.ROOT_CDN_FOLDER))) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  try {
    const uploadDir = path.dirname(resolvedPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, req.file.buffer);
    const fileUrl = `/cdn/${folder}/${finalName}`;
    res.json({ message: 'Uploaded successfully', fileUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save file' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Nimbus is thundering on http://localhost:${port}`);
});