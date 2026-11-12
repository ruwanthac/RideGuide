import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { OwnerHome, ProviderHome } from '../components';
import { useUserRole } from '../context/UserRoleContext';
import { useNavigation } from '@react-navigation/native';
import { useVehicles } from '../context/VehiclesContext';
import { useAuth } from '../context/AuthContext';
import { useOngoingActivity } from '../context/OngoingActivityContext';
import { subscribeServiceRequests, updateServiceRequest } from '../backend/serviceRequestsService';
import type { ServiceRequest } from '../backend/types';
import { extractApiError } from '../backend/apiClient';
import { recordHomeFunctionAccess, type HomeFunctionId } from '../utils/homeLastAccessed';
import { hasSavedProfilePhone } from '../utils/profilePhone';
import { navigateToProfilePrivacy } from '../navigation/historyCrossTabNavigate';
import { fetchDrivingRoute } from '../utils/drivingDistance';

type DrivingRoute = { km: number; minutes: number };

function alertProviderPhoneRequired(navigation: { getParent: () => unknown }) {
  Alert.alert(
    'Phone number required',
    'Add your phone number under Profile → Privacy before accepting a job. Vehicle owners need to call you.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Privacy',
        onPress: () => navigateToProfilePrivacy(navigation),
      },
    ],
  );
}

interface HomeScreenProps {
  onDiagnose: () => void;
  onTowTruckAssistant: () => void;
  /** Opens the same booking screen with roadside help selected */
  onRoadsideHelp?: () => void;
  onChatAssistant: () => void;
  onVideoCallPress?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onDiagnose,
  onTowTruckAssistant,
  onRoadsideHelp,
  onChatAssistant,
  onVideoCallPress,
}) => {
  const { role } = useUserRole();
  const { selectedVehicleId, refresh: refreshVehicles } = useVehicles();
  const { refreshProfile, user } = useAuth();
  const { syncFromServiceRequest } = useOngoingActivity();
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  /** Bumped on pull-to-refresh so the service-request subscription reloads from the API (resets socket listener state). */
  const [requestReloadToken, setRequestReloadToken] = useState(0);
  /** Open-job card chip: road distance and drive time per request; `null` = route API failed. */
  const [drivingRouteByRequestId, setDrivingRouteByRequestId] = useState<Record<string, DrivingRoute | null>>({});

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let alive = true;
    (async () => {
      try {
        if (role === 'tow' && !user?._id) {
          if (alive) setRequests([]);
          return;
        }
        if (role === 'mechanic' && !user?._id) {
          if (alive) setRequests([]);
          return;
        }
        const filter =
          role === 'owner' && selectedVehicleId
            ? { vehicleId: selectedVehicleId }
            : role === 'mechanic' && user?._id
            ? {
                type: 'roadside' as const,
                inboxOnly: true as const,
                providerOpenPoolOnly: true as const,
              }
            : role === 'tow' && user?._id
            ? { type: 'tow' as const, inboxOnly: true as const, providerOpenPoolOnly: true as const }
            : undefined;
        const off = await subscribeServiceRequests((items) => {
          if (!alive) return;
          setRequests(
            items.filter((i) => i.status !== 'completed' && i.status !== 'cancelled'),
          );
        }, filter);
        unsub = off;
      } catch (e) {
        // ignore — server unreachable; list stays empty
      }
    })();
    return () => { alive = false; unsub?.(); };
  }, [role, selectedVehicleId, requestReloadToken, user?._id]);

  /** Home inbox: only the open pending pool — never in-progress or history (same online/offline). */
  const roadsideRequests = useMemo(() => {
    const rows = requests
      .filter((r) => r.type === 'roadside')
      .filter((r) => r.status !== 'completed' && r.status !== 'cancelled');
    if (role !== 'mechanic' || !user?._id) return rows;
    return rows.filter((r) => r.status === 'pending' && !r.acceptedBy);
  }, [requests, role, user?._id]);

  const towRequests = useMemo(() => {
    const rows = requests.filter((r) => r.type === 'tow');
    if (role !== 'tow' || !user?._id) return rows;
    /** Tow home inbox: unclaimed hires only; accepted work is on the activity bubble / active job. */
    return rows.filter((r) => r.status === 'requested' && !r.acceptedBy);
  }, [requests, role, user?._id]);
  const navigation = useNavigation<any>();

  const handleAcceptRequest = async (request: ServiceRequest) => {
    if (!hasSavedProfilePhone(user?.phoneNumber)) {
      alertProviderPhoneRequired(navigation);
      return;
    }
    try {
      const updated = await updateServiceRequest(request._id, 'accepted');
      if (user?.role === 'mechanic') syncFromServiceRequest(updated, user.role);
      navigation.navigate('MechanicActiveJob', { requestId: updated._id });
    } catch (error) {
      Alert.alert('Unable to accept', extractApiError(error, 'Please try again'));
    }
  };

  const handleAcceptTowRequest = async (request: ServiceRequest) => {
    if (!hasSavedProfilePhone(user?.phoneNumber)) {
      alertProviderPhoneRequired(navigation);
      return;
    }
    try {
      let updated: ServiceRequest;
      try {
        updated = await updateServiceRequest(request._id, 'driver_picked_hire');
      } catch {
        // Backward compatibility when backend still supports legacy "accepted" only.
        updated = await updateServiceRequest(request._id, 'accepted');
      }
      if (user?.role === 'tow') syncFromServiceRequest(updated, user.role);
      navigation.navigate('TowDriverActiveJob', { requestId: updated._id });
    } catch (error) {
      Alert.alert('Unable to accept', extractApiError(error, 'Please try again'));
    }
  };

  function resolveOwnerJobPoint(req: ServiceRequest): { lat: number; lng: number } | null {
    const live = req.requesterLiveLocation;
    if (
      live &&
      typeof live.latitude === 'number' &&
      typeof live.longitude === 'number' &&
      Number.isFinite(live.latitude) &&
      Number.isFinite(live.longitude)
    ) {
      return { lat: live.latitude, lng: live.longitude };
    }
    if (
      typeof req.pickupLatitude === 'number' &&
      typeof req.pickupLongitude === 'number' &&
      Number.isFinite(req.pickupLatitude) &&
      Number.isFinite(req.pickupLongitude)
    ) {
      return { lat: req.pickupLatitude, lng: req.pickupLongitude };
    }
    if (typeof req.latitude === 'number' && typeof req.longitude === 'number') {
      return { lat: req.latitude, lng: req.longitude };
    }
    return null;
  }

  function coordsFromUserLocation(u: typeof user): { lat: number; lng: number } | null {
    const c = u?.location?.coordinates;
    if (Array.isArray(c) && c.length >= 2) {
      const [lng, lat] = c;
      if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
    return null;
  }

  const openRequestOnMap = (request: ServiceRequest) => {
    const ownerPt = resolveOwnerJobPoint(request);
    const lat = ownerPt?.lat ?? request.latitude;
    const lng = ownerPt?.lng ?? request.longitude;
    const label =
      request.type === 'tow'
        ? request.pickupAddress?.trim() || request.location
        : request.location;
    navigation.navigate('RequestMap', {
      location: label,
      latitude: lat,
      longitude: lng,
      previewRouteToOwner: true,
      ownerLatitude: lat,
      ownerLongitude: lng,
      customerName: request.userName,
      providerRole: user?.role === 'mechanic' ? 'mechanic' : 'tow',
    });
  };

  const mapboxTokenForRoutes = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';

  const openJobPoolForDriving = useMemo(
    () => (role === 'tow' ? towRequests : role === 'mechanic' ? roadsideRequests : []),
    [role, towRequests, roadsideRequests],
  );

  useEffect(() => {
    const me = coordsFromUserLocation(user);
    const pool = openJobPoolForDriving;
    if (!me || pool.length === 0) {
      setDrivingRouteByRequestId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        pool.map(async (req) => {
          const o = resolveOwnerJobPoint(req);
          if (!o) return [req._id, null] as const;
          const route = await fetchDrivingRoute(me, o, mapboxTokenForRoutes);
          return [req._id, route] as const;
        }),
      );
      if (cancelled) return;
      setDrivingRouteByRequestId(Object.fromEntries(entries) as Record<string, DrivingRoute | null>);
    })();
    return () => {
      cancelled = true;
    };
  }, [openJobPoolForDriving, user?.location, mapboxTokenForRoutes]);


  const recordAndAccess = useCallback(
    (id: HomeFunctionId, fn: () => void) => () => {
      const uid = user?._id;
      if (uid) void recordHomeFunctionAccess(uid, id);
      fn();
    },
    [user?._id]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), refreshVehicles()]);
      setRequestReloadToken((t) => t + 1);
    } catch {
      // non-fatal — individual contexts keep last good state
    } finally {
      setRefreshing(false);
    }
  };

  // Owners get the vehicle dashboard; mechanics and tow drivers get the job feed.
  if (role === 'owner') {
    return (
      <OwnerHome
        onDiagnose={recordAndAccess('diagnose', onDiagnose)}
        onChatAssistant={recordAndAccess('chat', onChatAssistant)}
        onRoadsideHelp={recordAndAccess('tow', onRoadsideHelp ?? onTowTruckAssistant)}
        onTowTruck={recordAndAccess('tow', onTowTruckAssistant)}
        onVideoCall={() => onVideoCallPress?.()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        refreshKey={requestReloadToken}
      />
    );
  }

  return (
    <ProviderHome
      role={role === 'tow' ? 'tow' : 'mechanic'}
      requests={role === 'tow' ? towRequests : roadsideRequests}
      routeFor={(req) => {
        if (!resolveOwnerJobPoint(req) || !coordsFromUserLocation(user)) return null;
        return drivingRouteByRequestId[req._id];
      }}
      onAccept={role === 'tow' ? handleAcceptTowRequest : handleAcceptRequest}
      onOpenMap={openRequestOnMap}
      onDiagnose={onDiagnose}
      onChatAssistant={onChatAssistant}
      onVideoCall={() => onVideoCallPress?.()}
      refreshing={refreshing}
      onRefresh={onRefresh}
      refreshKey={requestReloadToken}
    />
  );
};
