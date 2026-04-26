import { VehicleModel } from '../models/Vehicle';
import { getOrEnrichVehicleKnowledge } from './vehicle-cache.service';

export interface VehicleCallContext {
  vehicleId: string | null;
  canonicalVehicleKey: string;
  profileSummary: string;
  knowledge: {
    fuseBoxLocation: string;
    batteryLocation: string;
    obdPortLocation: string;
    jackPoints: string;
    commonIssues: string[];
    maintenanceSpecs: Record<string, string | number | boolean>;
    safetyWarnings: string[];
    notes: string;
  };
}

function buildVehicleDisplayName(vehicle: {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  trim?: string | null;
  makeModel?: string | null;
}): string {
  const composed = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(' ')
    .trim();
  return composed || vehicle.makeModel || 'Unknown vehicle';
}

export async function buildVehicleContextForCall(params: {
  userId: string;
  vehicleId?: string | null;
}): Promise<VehicleCallContext> {
  const vehicleDoc = params.vehicleId
    ? await VehicleModel.findOne({ _id: params.vehicleId, ownerId: params.userId }).lean()
    : await VehicleModel.findOne({ ownerId: params.userId }).sort({ createdAt: 1 }).lean();

  if (!vehicleDoc) {
    return {
      vehicleId: null,
      canonicalVehicleKey: 'unknown_vehicle',
      profileSummary: 'Vehicle context unavailable. Ask clarifying questions before advising.',
      knowledge: {
        fuseBoxLocation: 'Unknown',
        batteryLocation: 'Unknown',
        obdPortLocation: 'Unknown',
        jackPoints: 'Unknown',
        commonIssues: [],
        maintenanceSpecs: {},
        safetyWarnings: ['Vehicle details missing. Ask for make/model/year before critical guidance.'],
        notes: 'No vehicle found for user.',
      },
    };
  }

  const enriched = await getOrEnrichVehicleKnowledge({
    make: vehicleDoc.make,
    model: vehicleDoc.model,
    year: vehicleDoc.year,
    trim: vehicleDoc.trim,
    engine: vehicleDoc.engine,
    makeModel: vehicleDoc.makeModel,
  });

  const displayName = buildVehicleDisplayName(vehicleDoc);
  const commonIssuesSummary = enriched.enrichedData.commonIssues.slice(0, 5).join('; ') || 'None';

  const profileSummary = [
    `Vehicle: ${displayName}`,
    `Fuse box: ${enriched.enrichedData.fuseBoxLocation}`,
    `Battery: ${enriched.enrichedData.batteryLocation}`,
    `OBD Port: ${enriched.enrichedData.obdPortLocation}`,
    `Common Issues: ${commonIssuesSummary}`,
    `Safety Warnings: ${enriched.enrichedData.safetyWarnings.join('; ') || 'General workshop precautions.'}`,
    `Notes: ${enriched.enrichedData.notes || 'No additional notes.'}`,
  ].join('\n');

  return {
    vehicleId: String(vehicleDoc._id),
    canonicalVehicleKey: enriched.canonicalVehicleKey,
    profileSummary,
    knowledge: enriched.enrichedData,
  };
}

