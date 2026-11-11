import { Types } from 'mongoose';
import { VehicleModel } from '../models/Vehicle';
import { UserModel } from '../models/User';
import { DiagnosisHistoryModel } from '../models/DiagnosisHistory';
import { analyzeDiagnosis } from './gemini.client';
import { HttpError } from './auth.service';

export type RunDiagnosisInput = {
  symptoms: string;
  obdCode: string;
  vehicleId?: string;
  vehicleMakeModel?: string;
  vehicleVin?: string;
};

/** One or more OBD-II codes, e.g. "P0420" or "P0171, P0174" (P/C/B/U, then 4 characters). */
const OBD_CODES = /^[PCBU][0-3][0-9A-F]{3}([\s,;/]+[PCBU][0-3][0-9A-F]{3})*$/i;
/**
 * A VIN (17 chars) or a Japanese-style chassis number such as "NZE141-1234567", common on
 * Sri Lankan imports; just rule out text that can't be either.
 */
const VIN_OR_CHASSIS = /^(?=.*\d)[A-Z0-9][A-Z0-9-]{4,19}$/i;

export async function runDiagnosis(userId: string, input: RunDiagnosisInput) {
  const symptoms = (input.symptoms ?? '').trim();
  const obdCode = (input.obdCode ?? '').trim().toUpperCase();

  if (!symptoms && !obdCode) {
    throw new HttpError(400, 'Please describe the problem or enter an OBD code.');
  }
  if (obdCode && !OBD_CODES.test(obdCode)) {
    throw new HttpError(400, "That doesn't look like an OBD code. Codes look like P0420 or C1234.");
  }

  const account = await UserModel.findById(userId).select('displayName').lean();
  const userName = (account?.displayName ?? '').trim();

  let makeModel: string;
  let vin: string;
  let vehicleLabel: string;
  let vehicleId: Types.ObjectId | undefined;

  if (input.vehicleId && input.vehicleId.trim().length > 0) {
    const vehicle = await VehicleModel.findById(input.vehicleId.trim());
    if (!vehicle || String(vehicle.ownerId) !== userId) throw new HttpError(404, 'We couldn\'t find that vehicle. It may have been removed.');
    makeModel = vehicle.makeModel;
    vin = vehicle.vin;
    vehicleLabel = vehicle.label;
    vehicleId = vehicle._id as Types.ObjectId;
  } else {
    const mm = (input.vehicleMakeModel ?? '').trim();
    if (!mm) throw new HttpError(400, 'Please choose a vehicle or enter its make and model.');
    makeModel = mm;
    vin = (input.vehicleVin ?? '').trim() || '—';
    if (vin !== '—' && !VIN_OR_CHASSIS.test(vin)) {
      throw new HttpError(400, "That doesn't look like a VIN or chassis number. Please check it, or leave it empty.");
    }
    vehicleLabel = mm;
    vehicleId = undefined;
  }

  const ai = await analyzeDiagnosis({
    symptoms,
    obdCode,
    vehicleMakeModel: makeModel,
    vehicleVin: vin,
  });

  const doc = await DiagnosisHistoryModel.create({
    userId: new Types.ObjectId(userId),
    userName,
    ...(vehicleId ? { vehicleId } : {}),
    vehicleLabel,
    symptoms,
    obdCode,
    diagnosis: ai.diagnosis,
    severity: ai.severity,
    likelyCauses: ai.likelyCauses,
    steps: ai.steps,
  });
  return doc.toObject();
}

export async function listHistory(userId: string, vehicleId?: string) {
  const filter: Record<string, unknown> = { userId };
  if (vehicleId) filter.vehicleId = vehicleId;
  return DiagnosisHistoryModel.find(filter).sort({ createdAt: -1 }).limit(50).lean();
}
