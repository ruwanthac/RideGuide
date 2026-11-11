import { Request, Response, NextFunction } from 'express';
import { VehicleModel } from '../models/Vehicle';
import { DiagnosisHistoryModel } from '../models/DiagnosisHistory';
import { ServiceRequestModel } from '../models/ServiceRequest';
import { HttpError } from '../services/auth.service';

export async function vehicleRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id;
    const v = await VehicleModel.findById(id).lean();
    if (!v) throw new HttpError(404, 'We couldn\'t find that vehicle. It may have been removed.');
    if (String(v.ownerId) !== userId) throw new HttpError(403, 'You don\'t have permission to do that.');
    const [diagnoses, requests] = await Promise.all([
      DiagnosisHistoryModel.find({ vehicleId: id }).sort({ createdAt: -1 }).lean(),
      ServiceRequestModel.find({ vehicleId: id }).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ vehicle: v, diagnoses, requests });
  } catch (e) { next(e); }
}
