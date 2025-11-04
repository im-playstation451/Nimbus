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

const authenticate = (req, res, next) => {
  const apiKey = req.header('Authorization');
  if (!apiKey || !apiKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(express.json()); 
app.use(`/cdn/others`, authenticate, express.static(path.join(process.env.ROOT_CDN_FOLDER, 'others')));
app.use(`/cdn`, express.static(process.env.ROOT_CDN_FOLDER));

app.post('/update-json', authenticate, (req, res) => {
  const { folder, filename, data, id, profilepicture, updateFields } = req.body;

  if (!folder || !allowedFolders.includes(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  if (!filename || !filename.endsWith('.json')) {
    return res.status(400).json({ error: 'Invalid filename. Must be a .json file.' });
  }

  if (data === undefined && (id === undefined || (profilepicture === undefined && updateFields === undefined))) {
    return res.status(400).json({ error: 'No JSON data or update parameters (id, profilepicture, or updateFields) provided.' });
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

    let existingContent = '[]';
    if (fs.existsSync(resolvedPath)) {
      existingContent = fs.readFileSync(resolvedPath, 'utf8');
    }

    let contentArray = [];
    try {
      const parsedContent = JSON.parse(existingContent);
      if (Array.isArray(parsedContent)) {
        contentArray = parsedContent;
      } else if (typeof parsedContent === 'object' && parsedContent !== null) {
        contentArray = [parsedContent];
      }
    } catch (parseError) {
      console.warn(`Warning: Could not parse existing JSON file at ${resolvedPath}. Initializing as empty array.`);
    }

    let message = '';
    if (id && (profilepicture || updateFields)) {
      let userFound = false;
      contentArray = contentArray.map(userArray => {
        return userArray.map(user => {
          if (user.id === id) {
            if (profilepicture) {
              user.profilepicture = profilepicture;
            }
            if (updateFields) {
              Object.assign(user, updateFields);
            }
            userFound = true;
          }
          return user;
        });
      });
      if (userFound) {
        message = 'User data updated successfully';
      } else {
        message = 'User not found, no data updated';
      }
    } else if (data !== undefined) {
      if (Array.isArray(data)) {
        contentArray = data;
        message = 'Content array replaced successfully';
      } else {
        contentArray.push(data);
        message = 'Data appended successfully';
      }
    } else {
      return res.status(400).json({ error: 'Invalid request. Provide data for new user or id/profilepicture/updateFields for update.' });
    }

    fs.writeFileSync(resolvedPath, JSON.stringify(contentArray, null, 2), 'utf8');
    const fileUrl = `/cdn/${folder}/${cleanFilename}`;
    res.json({ message, fileUrl });
  } catch (err) {
    console.error('Error processing JSON file:', err);
    res.status(500).json({ error: 'Failed to process JSON file' });
  }
});

app.post('/upload', authenticate, upload.single('file'), (req, res) => {
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
