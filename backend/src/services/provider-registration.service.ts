import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserModel } from '../models/User';
import { HttpError } from './auth.service';
import { env } from '../config/env';

const MECHANIC_FIELDS = ['mechanicBrCopy', 'mechanicNicCopy'] as const;
const TOW_FIELDS = [
  'towCompanyBrCopy',
  'towTruckRegCopy',
  'towTruckNicCopy',
] as const;

function filesToMap(files: Express.Multer.File[]): Map<string, Express.Multer.File> {
  const m = new Map<string, Express.Multer.File>();
  for (const f of files) {
    if (!m.has(f.fieldname)) m.set(f.fieldname, f);
  }
  return m;
}

export async function registerPendingProvider(params: {
  email: string;
  displayName: string;
  phoneNumber?: string | null;
  role: 'mechanic' | 'tow';
  businessName: string;
  businessAddress?: string;
  truckName?: string;
  plateNumber?: string;
  files: Express.Multer.File[];
}) {
  const exists = await UserModel.findOne({ email: params.email.toLowerCase() }).lean();
  if (exists) throw new HttpError(409, 'email already registered');

  const expected = params.role === 'mechanic' ? MECHANIC_FIELDS : TOW_FIELDS;
  const byField = filesToMap(params.files);
  for (const f of expected) {
    if (!byField.has(f)) throw new HttpError(400, `missing file: ${f}`);
  }

  if (params.role === 'mechanic') {
    if (!params.businessAddress?.trim()) throw new HttpError(400, 'businessAddress required');
  } else {
    if (!params.truckName?.trim() || !params.plateNumber?.trim()) {
      throw new HttpError(400, 'truckName and plateNumber required');
    }
  }

  const placeholderPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const phone = params.phoneNumber?.trim() || undefined;

  const user = await UserModel.create({
    email: params.email.toLowerCase(),
    passwordHash: placeholderPasswordHash,
    displayName: params.displayName.trim(),
    role: params.role,
    ...(phone ? { phoneNumber: phone } : {}),
    businessName: params.businessName.trim(),
    businessAddress: params.role === 'mechanic' ? params.businessAddress!.trim() : null,
    truckName: params.role === 'tow' ? params.truckName!.trim() : null,
    plateNumber: params.role === 'tow' ? params.plateNumber!.trim() : null,
    providerVerificationStatus: 'pending',
    providerVerificationSubmittedAt: new Date(),
    providerVerification: {},
  });

  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const destDir = path.join(uploadRoot, 'provider-verification', String(user._id));
  await fs.mkdir(destDir, { recursive: true });

  const pv: Record<string, string> = {};
  for (const field of expected) {
    const file = byField.get(field)!;
    const ext =
      path.extname(file.originalname) ||
      (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    const safeName = `${field}${ext}`;
    const finalAbs = path.join(destDir, safeName);
    await fs.rename(file.path, finalAbs);
    pv[field] = path.join('provider-verification', String(user._id), safeName).replace(/\\/g, '/');
  }

  await UserModel.updateOne({ _id: user._id }, { $set: { providerVerification: pv } });

  const fresh = await UserModel.findById(user._id).lean();
  if (!fresh) throw new HttpError(500, 'user create failed');
  return fresh;
}
