import { Types } from 'mongoose';
import { VehicleModel } from '../models/Vehicle';
import { DiagnosisHistoryModel } from '../models/DiagnosisHistory';
import { analyzeDiagnosis } from './gemini.client';
import { HttpError } from './auth.service';

export async function runDiagnosis(userId: string, input: { symptoms: string; obdCode: string; vehicleId: string }) {
  const vehicle = await VehicleModel.findById(input.vehicleId);
  if (!vehicle || String(vehicle.ownerId) !== userId) throw new HttpError(404, 'vehicle not found');
  const ai = await analyzeDiagnosis({
    symptoms: input.symptoms,
    obdCode: input.obdCode,
    vehicleMakeModel: vehicle.makeModel,
  });
  const doc = await DiagnosisHistoryModel.create({
    userId: new Types.ObjectId(userId),
    vehicleId: vehicle._id,
    vehicleLabel: vehicle.label,
    symptoms: input.symptoms,
    obdCode: input.obdCode,
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
