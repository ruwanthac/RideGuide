import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { updateUserProfile } from '../backend/userProfileService';

const PATCH_MIN_MS = 45_000;

/**
 * While a tow driver is online, share their GPS position with the server (at most every 45 s)
 * so owners booking a tow can see trucks nearby. Going offline clears the stored position.
 */
export function useTowLiveLocation(enabled: boolean, online: boolean) {
  const lastPatchAt = useRef(0);
  const sentOnce = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let watch: Location.LocationSubscription | null = null;

    const send = async (lat: number, lng: number) => {
      const now = Date.now();
      if (sentOnce.current && now - lastPatchAt.current < PATCH_MIN_MS) return;
      sentOnce.current = true;
      lastPatchAt.current = now;
      try {
        await updateUserProfile({ location: { lat, lng } });
      } catch {
        // Non-fatal: the next position update tries again.
      }
    };

    void (async () => {
      if (!online) {
        sentOnce.current = false;
        lastPatchAt.current = 0;
        try {
          await updateUserProfile({ location: null });
        } catch {
          /* ignore */
        }
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 40 },
          (pos) => {
            if (!cancelled) void send(pos.coords.latitude, pos.coords.longitude);
          }
        );
        if (cancelled) sub.remove();
        else watch = sub;
      } catch {
        /* GPS unavailable; nothing to share */
      }
    })();

    return () => {
      cancelled = true;
      watch?.remove();
    };
  }, [enabled, online]);
}
