import { VehicleKnowledgeCacheModel } from '../models/VehicleKnowledgeCache';
import {
  VehicleEnrichedData,
  VehicleEnrichmentInput,
  enrichVehicleKnowledge,
} from './vehicle-enrichment.service';

const KEY_SEGMENT_SANITIZER = /[^a-z0-9]+/g;

function normalizePart(value?: string | number | null): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(KEY_SEGMENT_SANITIZER, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildCanonicalVehicleKey(input: VehicleEnrichmentInput): string {
  const make = normalizePart(input.make);
  const model = normalizePart(input.model);
  const year = normalizePart(input.year ?? undefined);
  const trim = normalizePart(input.trim);
  const engine = normalizePart(input.engine);

  const fromSplit = [make, model, year, trim, engine].filter(Boolean).join('_');
  if (fromSplit) return fromSplit;

  const fromMakeModel = normalizePart(input.makeModel);
  return fromMakeModel || 'unknown_vehicle';
}

export async function getCachedVehicleKnowledge(canonicalVehicleKey: string) {
  return VehicleKnowledgeCacheModel.findOne({ canonicalVehicleKey }).lean();
}

export async function getOrEnrichVehicleKnowledge(
  input: VehicleEnrichmentInput
): Promise<{
  canonicalVehicleKey: string;
  enrichedData: VehicleEnrichedData;
  source: 'ai_generated' | 'manual';
  verified: boolean;
}> {
  const canonicalVehicleKey = buildCanonicalVehicleKey(input);
  const cached = await getCachedVehicleKnowledge(canonicalVehicleKey);
  if (cached?.enrichedData) {
    return {
      canonicalVehicleKey,
      enrichedData: cached.enrichedData as VehicleEnrichedData,
      source: cached.source,
      verified: cached.verified,
    };
  }

  const enrichedData = await enrichVehicleKnowledge(input);
  const saved = await VehicleKnowledgeCacheModel.findOneAndUpdate(
    { canonicalVehicleKey },
    {
      canonicalVehicleKey,
      enrichedData,
      source: 'ai_generated',
      verified: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    canonicalVehicleKey,
    enrichedData: (saved?.enrichedData ?? enrichedData) as VehicleEnrichedData,
    source: saved!.source,
    verified: saved!.verified,
  };
}

