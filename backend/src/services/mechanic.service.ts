import { UserModel } from '../models/User';

export async function findNearby(params: { lat: number; lng: number; radiusKm: number; role: 'mechanic' | 'tow' }) {
  const radiusMeters = params.radiusKm * 1000;
  return UserModel.find({
    role: params.role,
    location: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [params.lng, params.lat] },
        $maxDistance: radiusMeters,
      },
    },
  }).select('-passwordHash').limit(50).lean();
}
