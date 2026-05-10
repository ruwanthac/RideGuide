import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env';
import { HttpError } from '../services/auth.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_SIZE = 5 * 1024 * 1024;

const tmpDir = path.resolve(process.cwd(), env.UPLOAD_DIR, 'tmp-register');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch {
      /* ignore */
    }
    cb(null, tmpDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

export const providerRegisterUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Only JPEG, PNG, WebP, or PDF files are allowed'));
  },
}).fields([
  { name: 'mechanicBrCopy', maxCount: 1 },
  { name: 'mechanicNicCopy', maxCount: 1 },
  { name: 'towCompanyBrCopy', maxCount: 1 },
  { name: 'towTruckRegCopy', maxCount: 1 },
  { name: 'towTruckNicCopy', maxCount: 1 },
]);
