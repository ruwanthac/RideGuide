import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { UserModel } from '../models/User';
import { VehicleModel } from '../models/Vehicle';
import { ServiceRequestModel } from '../models/ServiceRequest';
import { PricingConfigModel } from '../models/PricingConfig';
import { DiagnosisHistoryModel } from '../models/DiagnosisHistory';
import { AdminAuditLogModel } from '../models/AdminAuditLog';
import { HttpError, registerUser } from './auth.service';
import { sendEmail } from './email.service';
import { env } from '../config/env';
import { parsePagination, paginated, PaginatedPayload } from '../utils/pagination';
import { mapWithId, withId } from '../utils/mongoJson';

const SERVICE_STATUSES = [
  'pending',
  'accepted',
  'attending_to_location',
  'requested',
  'driver_picked_hire',
  'driver_on_the_way',
  'driver_arrived',
  'vehicle_in_tow',
  'completed',
  'cancelled',
] as const;

export async function recordAudit(params: {
  adminId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await AdminAuditLogModel.create({
      action: params.action,
      adminId: new Types.ObjectId(params.adminId),
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      meta: params.meta ?? {},
    });
  } catch (e) {
    console.warn('[admin-audit] failed to write log:', e);
  }
}

export async function getStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [
    userCount,
    vehicleCount,
    requestCount,
    pendingCount,
    requestsToday,
    activeMechanics,
    activeTowDrivers,
  ] = await Promise.all([
    UserModel.countDocuments(),
    VehicleModel.countDocuments(),
    ServiceRequestModel.countDocuments(),
    ServiceRequestModel.countDocuments({ status: 'pending' }),
    ServiceRequestModel.countDocuments({ createdAt: { $gte: startOfDay } }),
    UserModel.countDocuments({ role: 'mechanic', mechanicAvailable: true }),
    UserModel.countDocuments({ role: 'tow' }),
  ]);
  return {
    userCount,
    vehicleCount,
    requestCount,
    pendingCount,
    requestsToday,
    activeMechanics,
    activeTowDrivers,
  };
}

export type UserPatch = Partial<{
  role: string;
  displayName: string;
  phoneNumber: string | null;
  mechanicAvailable: boolean;
  businessName: string | null;
  businessAddress: string | null;
  truckName: string | null;
  plateNumber: string | null;
  status: 'active' | 'suspended';
}>;

export async function listUsersPaginated(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const pendingProviders =
    query.pendingProviders === 'true' || query.pendingProviders === '1' || query.pendingProviders === true;
  if (pendingProviders) {
    filter.role = { $in: ['mechanic', 'tow'] };
    filter.providerVerificationStatus = 'pending';
  } else {
    const role = typeof query.role === 'string' && query.role ? query.role : undefined;
    if (role) filter.role = role;
  }
  const status = typeof query.status === 'string' ? query.status.trim() : '';
  if (status === 'active' || status === 'suspended') filter.status = status;
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ email: rx }, { displayName: rx }, { phoneNumber: rx }];
  }
  const pvs = typeof query.providerVerificationStatus === 'string' ? query.providerVerificationStatus.trim() : '';
  if (pvs === 'pending' || pvs === 'approved' || pvs === 'rejected' || pvs === 'none') {
    filter.providerVerificationStatus = pvs;
  }
  const [items, total] = await Promise.all([
    UserModel.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserModel.countDocuments(filter),
  ]);
  return paginated(mapWithId(items), total, page, limit);
}

const VERIFICATION_FILE_FIELDS = new Set([
  'mechanicBrCopy',
  'mechanicNicCopy',
  'towCompanyBrCopy',
  'towCompanyNicCopy',
  'towTruckRegCopy',
  'towTruckNicCopy',
]);

function generateProviderOtp(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

export async function getUserByIdForAdmin(id: string): Promise<Record<string, unknown>> {
  const u = await UserModel.findById(id).select('-passwordHash').lean();
  if (!u) throw new HttpError(404, 'user not found');
  return withId(u);
}

export async function verifyProviderApplication(userId: string, adminId: string): Promise<{ ok: boolean }> {
  const u = await UserModel.findById(userId);
  if (!u) throw new HttpError(404, 'user not found');
  if (u.role !== 'mechanic' && u.role !== 'tow') throw new HttpError(400, 'user is not a mechanic or tow provider');
  if (u.providerVerificationStatus !== 'pending') {
    throw new HttpError(409, 'user is not awaiting verification');
  }
  const otp = generateProviderOtp();
  u.passwordHash = await bcrypt.hash(otp, 10);
  (u as any).mustChangePassword = true;
  u.providerVerificationStatus = 'approved';
  u.providerVerificationReviewedAt = new Date();
  await u.save();
  const emailResult = await sendEmail({
    to: u.email,
    subject: 'Your RideGuide account is approved',
    html: `<p>Hi ${u.displayName},</p><p>Your provider application has been approved.</p><p><strong>Sign-in password (one-time):</strong> <code style="font-size:16px">${otp}</code></p><p>Use this password with your email on the app login screen. You can change it later from your profile if that option is available.</p>`,
    text: `Your RideGuide account is approved. One-time sign-in password: ${otp}`,
  });
  if (!emailResult.ok) {
    console.warn('[admin] verify-provider: email skipped or failed; user still approved');
  }
  await recordAudit({
    adminId,
    action: 'PROVIDER_VERIFY',
    targetType: 'user',
    targetId: userId,
    meta: { emailSent: emailResult.ok },
  });
  return { ok: true };
}

export async function rejectProviderApplication(userId: string, adminId: string): Promise<{ ok: boolean }> {
  const u = await UserModel.findById(userId);
  if (!u) throw new HttpError(404, 'user not found');
  if (u.role !== 'mechanic' && u.role !== 'tow') throw new HttpError(400, 'user is not a mechanic or tow provider');
  if (u.providerVerificationStatus !== 'pending') {
    throw new HttpError(409, 'user is not awaiting verification');
  }
  u.providerVerificationStatus = 'rejected';
  u.providerVerificationReviewedAt = new Date();
  await u.save();
  await recordAudit({
    adminId,
    action: 'PROVIDER_REJECT',
    targetType: 'user',
    targetId: userId,
    meta: {},
  });
  return { ok: true };
}

export async function getVerificationFileAbsolutePath(userId: string, field: string): Promise<string> {
  if (!VERIFICATION_FILE_FIELDS.has(field)) throw new HttpError(400, 'invalid file field');
  const u = await UserModel.findById(userId).lean();
  if (!u) throw new HttpError(404, 'user not found');
  const rel = (u as { providerVerification?: Record<string, string> }).providerVerification?.[field];
  if (!rel || typeof rel !== 'string') throw new HttpError(404, 'file not found');
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const abs = path.resolve(uploadRoot, rel);
  const prefix = path.resolve(uploadRoot, 'provider-verification');
  if (!abs.startsWith(prefix)) throw new HttpError(403, 'invalid path');
  if (!fs.existsSync(abs)) throw new HttpError(404, 'file not found');
  return abs;
}

export async function updateUser(
  id: string,
  patch: UserPatch,
  adminId: string
): Promise<Record<string, unknown>> {
  const allowed: UserPatch = {};
  if (patch.role !== undefined) allowed.role = patch.role;
  if (patch.displayName !== undefined) allowed.displayName = patch.displayName;
  if (patch.phoneNumber !== undefined) allowed.phoneNumber = patch.phoneNumber;
  if (patch.mechanicAvailable !== undefined) allowed.mechanicAvailable = patch.mechanicAvailable;
  if (patch.businessName !== undefined) allowed.businessName = patch.businessName;
  if (patch.businessAddress !== undefined) allowed.businessAddress = patch.businessAddress;
  if (patch.truckName !== undefined) allowed.truckName = patch.truckName;
  if (patch.plateNumber !== undefined) allowed.plateNumber = patch.plateNumber;
  if (patch.status !== undefined) allowed.status = patch.status;
  if (Object.keys(allowed).length === 0) throw new HttpError(400, 'no valid fields to update');
  const u = await UserModel.findByIdAndUpdate(id, { $set: allowed }, { new: true }).select('-passwordHash').lean();
  if (!u) throw new HttpError(404, 'user not found');
  await recordAudit({
    adminId,
    action: 'USER_UPDATE',
    targetType: 'user',
    targetId: id,
    meta: { fields: Object.keys(allowed) },
  });
  return withId(u);
}

export async function deleteRequest(id: string, adminId: string) {
  const r = await ServiceRequestModel.findByIdAndDelete(id).lean();
  if (!r) throw new HttpError(404, 'request not found');
  await recordAudit({
    adminId,
    action: 'REQUEST_DELETE',
    targetType: 'serviceRequest',
    targetId: id,
    meta: {},
  });
}

export async function getTowPricing() {
  const doc =
    (await PricingConfigModel.findOne({ key: 'tow' }).lean()) ??
    (await PricingConfigModel.create({ key: 'tow', towPerKmLkr: 320 }));
  return { towPerKmLkr: Number(doc.towPerKmLkr ?? 320) };
}

export async function updateTowPricing(patch: { towPerKmLkr?: number }, adminId: string) {
  const nextTowPerKm = patch.towPerKmLkr;
  const update: { towPerKmLkr?: number } = {};
  if (typeof nextTowPerKm === 'number') {
    if (!Number.isFinite(nextTowPerKm) || nextTowPerKm < 0) throw new HttpError(400, 'invalid towPerKmLkr');
    update.towPerKmLkr = Math.round(nextTowPerKm);
  }
  const doc = await PricingConfigModel.findOneAndUpdate(
    { key: 'tow' },
    { $set: update, $setOnInsert: { key: 'tow' } },
    { upsert: true, new: true }
  ).lean();
  const out = { towPerKmLkr: Number(doc?.towPerKmLkr ?? 320) };
  await recordAudit({
    adminId,
    action: 'PRICING_UPDATE',
    targetType: 'pricingConfig',
    targetId: 'tow',
    meta: { towPerKmLkr: out.towPerKmLkr },
  });
  return out;
}

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listServiceRequests(query: Record<string, unknown>): Promise<PaginatedPayload<Record<string, unknown>>> {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const type = typeof query.type === 'string' ? query.type : undefined;
  if (type === 'roadside' || type === 'tow') filter.type = type;
  const status = typeof query.status === 'string' ? query.status : undefined;
  if (status && (SERVICE_STATUSES as readonly string[]).includes(status)) filter.status = status;
  const from = typeof query.from === 'string' ? new Date(query.from) : null;
  const to = typeof query.to === 'string' ? new Date(query.to) : null;
  const createdAt: Record<string, Date> = {};
  if (from && !Number.isNaN(from.getTime())) createdAt.$gte = from;
  if (to && !Number.isNaN(to.getTime())) createdAt.$lte = to;
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const rx = new RegExp(escapeRx(search), 'i');
    filter.$or = [{ userName: rx }, { vehicle: rx }, { issue: rx }, { location: rx }, { pickupAddress: rx }];
  }
  const [items, total] = await Promise.all([
    ServiceRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ServiceRequestModel.countDocuments(filter),
  ]);
  return paginated(mapWithId(items), total, page, limit);
}

export async function getServiceRequestById(id: string) {
  const doc = await ServiceRequestModel.findById(id).lean();
  if (!doc) throw new HttpError(404, 'request not found');
  return withId(doc);
}

export async function listVehicles(query: Record<string, unknown>): Promise<PaginatedPayload<Record<string, unknown>>> {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const ownerId = typeof query.ownerId === 'string' && Types.ObjectId.isValid(query.ownerId) ? query.ownerId : undefined;
  if (ownerId) filter.ownerId = new Types.ObjectId(ownerId);
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const rx = new RegExp(escapeRx(search), 'i');
    filter.$or = [{ makeModel: rx }, { vin: rx }, { label: rx }, { ownerName: rx }];
  }
  const [items, total] = await Promise.all([
    VehicleModel.find(filter)
      .populate('ownerId', 'email displayName phoneNumber role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    VehicleModel.countDocuments(filter),
  ]);
  return paginated(mapWithId(items), total, page, limit);
}

export async function listDiagnoses(query: Record<string, unknown>): Promise<PaginatedPayload<Record<string, unknown>>> {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  const from = typeof query.from === 'string' ? new Date(query.from) : null;
  const to = typeof query.to === 'string' ? new Date(query.to) : null;
  const createdAt: Record<string, Date> = {};
  if (from && !Number.isNaN(from.getTime())) createdAt.$gte = from;
  if (to && !Number.isNaN(to.getTime())) createdAt.$lte = to;
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const rx = new RegExp(escapeRx(search), 'i');
    filter.$or = [{ diagnosis: rx }, { symptoms: rx }, { obdCode: rx }, { vehicleLabel: rx }, { userName: rx }];
  }
  const [items, total] = await Promise.all([
    DiagnosisHistoryModel.find(filter)
      .populate('userId', 'email displayName phoneNumber role')
      .populate('vehicleId', 'label makeModel vin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DiagnosisHistoryModel.countDocuments(filter),
  ]);
  return paginated(mapWithId(items), total, page, limit);
}

export async function getAnalytics(query: Record<string, unknown>) {
  const daysRaw = parseInt(String(query.days ?? '90'), 10);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 366 ? daysRaw : 90;
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const [byType, byStatus, dailySeries, completedInRange, diagnosisCount] = await Promise.all([
    ServiceRequestModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    ServiceRequestModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ServiceRequestModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ServiceRequestModel.countDocuments({
      status: 'completed',
      createdAt: { $gte: since },
    }),
    DiagnosisHistoryModel.countDocuments({ createdAt: { $gte: since } }),
  ]);

  const estimatedRevenueLkr = await ServiceRequestModel.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: since },
        finalAmount: { $ne: null },
      },
    },
    { $group: { _id: null, total: { $sum: '$finalAmount' } } },
  ]);
  const revenueSum = estimatedRevenueLkr[0]?.total ?? 0;

  return {
    range: { days, since: since.toISOString() },
    requestsByType: byType.map((r) => ({ type: r._id, count: r.count })),
    requestsByStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    requestsPerDay: dailySeries.map((r) => ({ date: r._id, count: r.count })),
    completedRequestsInRange: completedInRange,
    diagnosesInRange: diagnosisCount,
    /** Sum of `finalAmount` on completed requests in range (cash_manual model; not card payments). */
    estimatedRevenueLkr: Math.round(Number(revenueSum) || 0),
    meta: {
      assumptions: [
        'Diagnosis flows use DiagnosisHistory, not ServiceRequest.type=diagnosis.',
        'activeMechanics = users with role mechanic and mechanicAvailable true; activeTow = count of users with role tow.',
        'Revenue is derived from completed ServiceRequest.finalAmount only.',
      ],
    },
  };
}

export async function listAuditLogs(query: Record<string, unknown>): Promise<PaginatedPayload<Record<string, unknown>>> {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    AdminAuditLogModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminId', 'email displayName role')
      .lean(),
    AdminAuditLogModel.countDocuments({}),
  ]);
  return paginated(mapWithId(items), total, page, limit);
}

function seedAllowed(): boolean {
  return (
    process.env.ALLOW_ADMIN_SEED === 'true' ||
    process.env.ALLOW_ADMIN_SEED === '1' ||
    env.ALLOW_ADMIN_SEED === 'true'
  );
}

function seedClearAllowed(): boolean {
  return (
    process.env.ADMIN_SEED_CLEAR === 'true' ||
    process.env.ADMIN_SEED_CLEAR === '1' ||
    env.ADMIN_SEED_CLEAR === 'true'
  );
}

export async function seedDemo(adminId: string) {
  if (!seedAllowed()) {
    throw new HttpError(403, 'Admin seeding is disabled. Set ALLOW_ADMIN_SEED=true to enable.');
  }
  if (env.NODE_ENV === 'production') {
    throw new HttpError(403, 'Seed demo is not allowed in production.');
  }

  if (seedClearAllowed()) {
    const adminIds = await UserModel.find({ role: 'admin' }).distinct('_id');
    await ServiceRequestModel.deleteMany({});
    await VehicleModel.deleteMany({});
    await DiagnosisHistoryModel.deleteMany({});
    await AdminAuditLogModel.deleteMany({});
    await UserModel.deleteMany({ _id: { $nin: adminIds } });
  }

  const ownerA = await registerUser({
    email: `demo.owner.a.${Date.now()}@example.com`,
    password: 'DemoOwner12',
    displayName: 'Demo Owner A',
    role: 'owner',
  });
  const ownerB = await registerUser({
    email: `demo.owner.b.${Date.now()}@example.com`,
    password: 'DemoOwner12',
    displayName: 'Demo Owner B',
    role: 'owner',
  });

  const vA = await VehicleModel.create({
    ownerId: ownerA.user._id,
    label: 'Daily',
    makeModel: '2019 Honda Civic',
    vin: '1HGBH41JXMN109186',
  });
  await VehicleModel.create({
    ownerId: ownerB.user._id,
    label: 'Work',
    makeModel: '2020 Toyota Camry',
    vin: '2T1B11HK5JC123456',
  });

  await ServiceRequestModel.create({
    requesterId: ownerA.user._id,
    type: 'roadside',
    status: 'pending',
    userName: ownerA.user.displayName,
    vehicle: vA.makeModel,
    issue: 'Flat tire near downtown',
    pickupAddress: '123 Main St',
    pickupLatitude: 6.9271,
    pickupLongitude: 79.8612,
    dropoffAddress: '',
    dropoffLatitude: null,
    dropoffLongitude: null,
    location: '123 Main St, Colombo',
    latitude: 6.9271,
    longitude: 79.8612,
    phoneNumber: '+94771234567',
    vehicleId: vA._id,
  });

  await ServiceRequestModel.create({
    requesterId: ownerB.user._id,
    type: 'tow',
    status: 'completed',
    userName: ownerB.user.displayName,
    vehicle: '2020 Toyota Camry',
    issue: 'Tow to service center',
    pickupAddress: 'Galle Rd',
    pickupLatitude: 6.9,
    pickupLongitude: 79.85,
    dropoffAddress: 'Dehiwala',
    dropoffLatitude: 6.85,
    dropoffLongitude: 79.88,
    location: 'Galle Rd',
    latitude: 6.9,
    longitude: 79.85,
    phoneNumber: '+94777654321',
    finalAmount: 4500,
    paymentState: 'paid_offline',
  });

  await DiagnosisHistoryModel.create({
    userId: ownerA.user._id,
    vehicleId: vA._id,
    vehicleLabel: vA.makeModel,
    symptoms: 'Rough idle when cold',
    obdCode: 'P0301',
    diagnosis: 'Possible misfire on cylinder 1; inspect spark plug and coil.',
    severity: 'moderate',
    likelyCauses: ['Worn spark plug', 'Ignition coil'],
    steps: ['Scan live data', 'Swap coil with adjacent cylinder'],
  });

  await recordAudit({
    adminId,
    action: 'SEED_DEMO',
    targetType: 'system',
    targetId: null,
    meta: { cleared: seedClearAllowed() },
  });

  return {
    ok: true,
    created: { owners: 2, vehicles: 2, serviceRequests: 2, diagnoses: 1 },
    cleared: seedClearAllowed(),
  };
}
