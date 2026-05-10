import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { UserModel, UserRole } from '../models/User';
import { env } from '../config/env';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthResult {
  user: ReturnType<typeof sanitize>;
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

function signToken(userId: string, role: UserRole) {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: '7d' });
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const exists = await UserModel.findOne({ email: input.email.toLowerCase() }).lean();
  if (exists) throw new HttpError(409, 'email already registered');
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
    ...(phone ? { phoneNumber: phone } : {}),
  });
  return { user: sanitize(user), token: signToken(String(user._id), user.role) };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (!user) throw new HttpError(401, 'invalid credentials');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'invalid credentials');
  if ((user as { status?: string }).status === 'suspended') {
    throw new HttpError(403, 'account suspended');
  }
  return { user: sanitize(user), token: signToken(String(user._id), user.role) };
}

export interface TokenPayload extends JwtPayload {
  userId: string;
  role: UserRole;
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
