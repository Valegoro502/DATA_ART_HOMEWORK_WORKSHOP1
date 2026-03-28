import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Ensure upload dir exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // preserve extension and give a unique prefix
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Configure limits and types
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max overall
  },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    
    // Explicit limit check since total limit is 20MB, but images restrict to 3MB
    // Actually multer fileFilter doesn't have access to total size before uploading stream
    // We will validate image size in error catching or by trusting general 20MB and doing a manual check in handler if we need to.
    cb(null, true);
  }
});

router.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Check image 3MB limit specifically
  if (req.file.mimetype.startsWith('image/') && req.file.size > 3 * 1024 * 1024) {
    // Delete the file because it exceeded 3MB for images
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Image size exceeds 3MB limit' });
  }

  res.json({
    url: `/uploads/${req.file.filename}`,
    filename: req.file.originalname,
    mimetype: req.file.mimetype
  });
});

export default router;
