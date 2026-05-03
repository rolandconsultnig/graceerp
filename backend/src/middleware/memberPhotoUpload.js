const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '../../uploads/members');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = `avatar-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`.slice(0, 200);
    cb(null, safe);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    if (!ok) return cb(new Error('Only JPEG, PNG, GIF, or WebP images are allowed'));
    cb(null, true);
  },
});
