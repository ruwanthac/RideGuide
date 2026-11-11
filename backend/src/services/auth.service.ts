import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { UserModel, UserRole, effectiveProviderVerificationStatus } from '../models/User';
import { env } from '../config/env';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthResult {
  user: ReturnType<typeof sanitizeForClient>;
  token: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
  /** E.164 or consistent string; optional at signup. */
  phoneNumber?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

function sanitize(u: any) {
  const raw = u.toObject ? u.toObject() : { ...u };
  const { passwordHash, __v, ...rest } = raw;
  const id = rest._id != null ? String(rest._id) : undefined;
  return { ...rest, _id: id, id };
}

/** Strips verification file paths from API responses for clients. */
export function sanitizeForClient(u: any) {
  const s = sanitize(u);
  const { providerVerification: _pv, ...rest } = s;
  return rest;
}

function signToken(userId: string, role: UserRole) {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: '7d' });
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  if (input.role === 'mechanic' || input.role === 'tow') {
    throw new HttpError(400, 'Please use the mechanic or tow provider sign-up form.');
  }
  const exists = await UserModel.findOne({ email: input.email.toLowerCase() }).lean();
  if (exists) throw new HttpError(409, 'An account with this email already exists. Try logging in instead.');
  const passwordHash = await bcrypt.hash(input.password, 10);
  const phone =
    typeof input.phoneNumber === 'string' && input.phoneNumber.trim()
      ? input.phoneNumber.trim()
      : undefined;
  const user = await UserModel.create({
    email: input.email.toLowerCase(),
    passwordHash,
    displayName: input.displayName,
    role: input.role ?? 'owner',
    providerVerificationStatus: 'none',
    ...(phone ? { phoneNumber: phone } : {}),
  });
  return { user: sanitizeForClient(user), token: signToken(String(user._id), user.role) };
}

/** Creates mechanic/tow user already approved (for tests / fixtures). Not exposed via public JSON register. */
export async function registerApprovedProvider(
  input: RegisterInput & { role: 'mechanic' | 'tow' }
): Promise<AuthResult> {
  const exists = await UserModel.findOne({ email: input.email.toLowerCase() }).lean();
  if (exists) throw new HttpError(409, 'An account with this email already exists. Try logging in instead.');
  const passwordHash = await bcrypt.hash(input.password, 10);
  const phone =
    typeof input.phoneNumber === 'string' && input.phoneNumber.trim()
      ? input.phoneNumber.trim()
      : undefined;
  const user = await UserModel.create({
    email: input.email.toLowerCase(),
    passwordHash,
    displayName: input.displayName,
    role: input.role,
    providerVerificationStatus: 'approved',
    ...(phone ? { phoneNumber: phone } : {}),
  });
  return { user: sanitizeForClient(user), token: signToken(String(user._id), user.role) };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (!user) throw new HttpError(401, 'Incorrect email or password. Please try again.');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Incorrect email or password. Please try again.');
  if ((user as { status?: string }).status === 'suspended') {
    throw new HttpError(403, 'Your account has been suspended. Please contact support.');
  }
  const eff = effectiveProviderVerificationStatus(user.role, user.providerVerificationStatus as any);
  if ((user.role === 'mechanic' || user.role === 'tow') && eff === 'pending') {
    throw new HttpError(403, 'Your account is waiting for approval. We\'ll email you as soon as it\'s approved.');
  }
  if ((user.role === 'mechanic' || user.role === 'tow') && eff === 'rejected') {
    throw new HttpError(403, 'Your provider application wasn\'t approved. Please contact support for details.');
  }
  return { user: sanitizeForClient(user), token: signToken(String(user._id), user.role) };
}

export async function changePassword(userId: string, nextPassword: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, 'We couldn\'t find that account.');
  user.passwordHash = await bcrypt.hash(nextPassword, 10);
  (user as any).mustChangePassword = false;
  await user.save();
}

export interface TokenPayload extends JwtPayload {
  userId: string;
  role: UserRole;
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
