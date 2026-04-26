import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { env } from '../config/env';
import { VEHICLE_ENRICHMENT_PROMPT_TEMPLATE } from './vehicle-enrichment.prompt';

const enrichmentSchema = z.object({
  fuseBoxLocation: z.string().default('Not available'),
  batteryLocation: z.string().default('Not available'),
  obdPortLocation: z.string().default('Not available'),
  jackPoints: z.string().default('Not available'),
  commonIssues: z.array(z.string()).default([]),
  maintenanceSpecs: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
  safetyWarnings: z.array(z.string()).default([]),
  notes: z.string().default(''),
});

export type VehicleEnrichedData = z.infer<typeof enrichmentSchema>;

export interface VehicleEnrichmentInput {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  trim?: string | null;
  engine?: string | null;
  makeModel?: string | null;
}

function getClient(): GoogleGenerativeAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

function fallbackEnrichment(vehicle: VehicleEnrichmentInput): VehicleEnrichedData {
  const descriptor =
    vehicle.makeModel ||
    [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ') ||
    'vehicle';
  return {
    fuseBoxLocation: 'Refer to owner manual fuse diagram.',
    batteryLocation: 'Refer to owner manual battery section.',
    obdPortLocation: 'Usually under steering column near driver footwell.',
    jackPoints: 'Use manufacturer-recommended reinforced jack points only.',
    commonIssues: [`No AI enrichment available right now for ${descriptor}.`],
    maintenanceSpecs: {},
    safetyWarnings: [
      'Always turn off engine and engage parking brake before inspection.',
      'Use protective gear when checking battery or electrical components.',
    ],
    notes: 'AI enrichment fallback generated locally.',
  };
}

export async function enrichVehicleKnowledge(
  input: VehicleEnrichmentInput
): Promise<VehicleEnrichedData> {
  try {
    const model = getClient().getGenerativeModel({
      model: env.GEMINI_MODEL_CHEAP,
      generationConfig: { responseMimeType: 'application/json' },
      systemInstruction: VEHICLE_ENRICHMENT_PROMPT_TEMPLATE,
    });

    const promptPayload = {
      make: input.make ?? null,
      model: input.model ?? null,
      year: input.year ?? null,
      trim: input.trim ?? null,
      engine: input.engine ?? null,
      makeModel: input.makeModel ?? null,
    };

    const response = await model.generateContent(JSON.stringify(promptPayload));
    const text = response.response.text();
    return enrichmentSchema.parse(JSON.parse(text));
  } catch (error) {
    console.warn('[vehicle-enrichment] using fallback enrichment:', error);
    return fallbackEnrichment(input);
  }
}

