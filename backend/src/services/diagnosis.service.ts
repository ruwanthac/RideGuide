import { Types } from 'mongoose';
import { VehicleModel } from '../models/Vehicle';
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

export async function runDiagnosis(userId: string, input: RunDiagnosisInput) {
  const symptoms = input.symptoms ?? '';
  const obdCode = input.obdCode ?? '';

  let makeModel: string;
  let vin: string;
  let vehicleLabel: string;
  let vehicleId: Types.ObjectId | undefined;

  if (input.vehicleId && input.vehicleId.trim().length > 0) {
    const vehicle = await VehicleModel.findById(input.vehicleId.trim());
    if (!vehicle || String(vehicle.ownerId) !== userId) throw new HttpError(404, 'vehicle not found');
    makeModel = vehicle.makeModel;
    vin = vehicle.vin;
    vehicleLabel = vehicle.label;
    vehicleId = vehicle._id as Types.ObjectId;
  } else {
    const mm = (input.vehicleMakeModel ?? '').trim();
    if (!mm) throw new HttpError(400, 'vehicleMakeModel is required without vehicleId');
    makeModel = mm;
    vin = (input.vehicleVin ?? '').trim() || '—';
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
