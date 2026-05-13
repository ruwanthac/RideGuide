import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { Icon, PrimaryButton } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { createServiceRequest, getTowEstimate } from '../backend/serviceRequestsService';
import { hasMapboxToken, reverseGeocodeMapbox, searchMapboxPlaces, type LocationSuggestion } from '../backend/mapboxService';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../context/VehiclesContext';
import type { TowEstimate } from '../backend/types';

type TripType = 'tow' | 'roadside';

interface TowTruckAssistantScreenProps {
  onBack: () => void;
  onBooked?: (requestId: string, type: TripType) => void;
}

const SUGGESTED_LOCATIONS = [
  { id: '1', name: 'Iskole Handiya', address: 'Homagama, Sri Lanka' },
  { id: '2', name: 'Pettah Bus', address: 'Colombo, Sri Lanka' },
];
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
const MAPBOX_TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`;
const MAPBOX_ATTRIBUTION = '© Mapbox © OpenStreetMap contributors';
const RECENT_DROP_STORAGE_KEY = 'tow_recent_drop_locations_v1';
const MAX_RECENT_DROPS = 5;
const MIN_SCHEDULE_MINUTES = 60;
const MAX_SCHEDULE_DAYS = 7;

/** Reject uninitialized (0,0) or invalid coords so tow jobs store a real pickup for the driver map. */
function usablePickupCoords(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return Math.abs(lat) > 1e-4 || Math.abs(lng) > 1e-4;
}

const getLocalSuggestions = (query: string): LocationSuggestion[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return SUGGESTED_LOCATIONS
    .filter((loc) => loc.name.toLowerCase().includes(needle) || loc.address.toLowerCase().includes(needle))
    .map((item) => ({ ...item, latitude: 0, longitude: 0 }));
};

export const TowTruckAssistantScreen: React.FC<TowTruckAssistantScreenProps> = ({ onBack, onBooked }) => {
  const { user } = useAuth();
  const { selectedVehicle } = useVehicles();
  const [tripType, setTripType] = useState<TripType>('tow');
  const bookingIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    bookingIdempotencyKeyRef.current = null;
  }, [tripType, selectedVehicle?._id]);
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupManuallyEdited, setPickupManuallyEdited] = useState(false);
  const [pickupQuery, setPickupQuery] = useState('');
  const [showPickupSearchResults, setShowPickupSearchResults] = useState(false);
  const [pickupSearchResults, setPickupSearchResults] = useState<LocationSuggestion[]>([]);
  const [isSearchingPickupLocations, setIsSearchingPickupLocations] = useState(false);
  const [dropLocation, setDropLocation] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>(SUGGESTED_LOCATIONS.map((item) => ({
    ...item,
    latitude: 0,
    longitude: 0,
  })));
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [dropLocationCoords, setDropLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [recentDropLocations, setRecentDropLocations] = useState<LocationSuggestion[]>([]);
  const [showDropMapPicker, setShowDropMapPicker] = useState(false);
  const [dropMapDraft, setDropMapDraft] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropMapDraftLabel, setDropMapDraftLabel] = useState('');
  const [dropMapSeed, setDropMapSeed] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showPickupMapPicker, setShowPickupMapPicker] = useState(false);
  const [pickupMapDraft, setPickupMapDraft] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupMapDraftLabel, setPickupMapDraftLabel] = useState('');
  const [pickupMapSeed, setPickupMapSeed] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingType, setBookingType] = useState<'on_demand' | 'scheduled'>('on_demand');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [showIosSchedulePicker, setShowIosSchedulePicker] = useState(false);
  const [iosScheduleDraft, setIosScheduleDraft] = useState<Date>(() => new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000));
  const [estimate, setEstimate] = useState<TowEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const visibleRecentDrops = useMemo(
    () =>
      recentDropLocations.length > 0
        ? recentDropLocations.slice(0, 5)
        : SUGGESTED_LOCATIONS.map((item) => ({ ...item, latitude: 0, longitude: 0 })),
    [recentDropLocations]
  );
  const showTowEstimateCard =
    tripType === 'tow' &&
    !!location &&
    !!dropLocationCoords &&
    !!dropLocation.trim();
  const scrollViewRef = useRef<ScrollView>(null);
  const dropInputRef = useRef<TextInput>(null);
  const pickupMapWebViewRef = useRef<WebView>(null);
  const dropMapWebViewRef = useRef<WebView>(null);
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastSearchIdRef = useRef(0);
  const lastPickupSearchIdRef = useRef(0);
  const { spacing, fontSizes, iconSizes, borderRadius, verticalScale, scale, width } = useResponsive();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const screenHeight = Dimensions.get('window').height;
  const sheetMaxTranslate = Math.max(screenHeight * 0.42, 220);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetStartY = useRef(0);
  const isSheetCollapsedRef = useRef(false);

  const validateScheduledDate = (value: Date | null): string | null => {
    if (!value || Number.isNaN(value.getTime())) return 'Please pick a valid date and time.';
    const now = Date.now();
    const minMs = now + MIN_SCHEDULE_MINUTES * 60 * 1000;
    const maxMs = now + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;
    const target = value.getTime();
    if (target < minMs) return `Scheduled time must be at least ${MIN_SCHEDULE_MINUTES} minutes from now.`;
    if (target > maxMs) return `Scheduled time must be within ${MAX_SCHEDULE_DAYS} days.`;
    return null;
  };

  const scheduledDate = useMemo(() => (scheduledAt ? new Date(scheduledAt) : null), [scheduledAt]);
  const scheduledDisplay = useMemo(() => {
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) return 'No date selected';
    return scheduledDate.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [scheduledDate]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const snapBottomSheet = (collapsed: boolean) => {
    isSheetCollapsedRef.current = collapsed;
    Animated.timing(sheetTranslateY, {
      toValue: collapsed ? sheetMaxTranslate : 0,
      duration: 180,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 12 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 12 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((value: number) => {
          sheetStartY.current = value;
        });
      },
      onPanResponderMove: (_evt, gestureState) => {
        const next = Math.max(0, Math.min(sheetMaxTranslate, sheetStartY.current + gestureState.dy));
        sheetTranslateY.setValue(next);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const end = sheetStartY.current + gestureState.dy;
        const threshold = sheetMaxTranslate * 0.45;
        const shouldCollapse = gestureState.vy > 0.6 || end > threshold;
        snapBottomSheet(shouldCollapse);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        snapBottomSheet(isSheetCollapsedRef.current);
      },
    })
  ).current;

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_DROP_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as LocationSuggestion[];
        if (!Array.isArray(parsed)) return;
        setRecentDropLocations(parsed.filter((item) => item && typeof item.name === 'string').slice(0, MAX_RECENT_DROPS));
      } catch {
        // ignore storage errors
      }
    })();
  }, []);

  const saveRecentDropLocation = (loc: LocationSuggestion) => {
    setRecentDropLocations((prev) => {
      const next = [
        loc,
        ...prev.filter(
          (item) =>
            item.name.toLowerCase() !== loc.name.toLowerCase() ||
            item.address.toLowerCase() !== loc.address.toLowerCase()
        ),
      ].slice(0, MAX_RECENT_DROPS);
      void AsyncStorage.setItem(RECENT_DROP_STORAGE_KEY, JSON.stringify(next)).catch(() => {
        // ignore storage errors
      });
      return next;
    });
  };

  const commitScheduledAt = (nextDate: Date) => {
    const validation = validateScheduledDate(nextDate);
    setScheduleError(validation);
    if (!validation) {
      setScheduledAt(nextDate.toISOString());
    }
  };

  const openWebSchedulePrompt = () => {
    if (typeof window === 'undefined') return;
    const seed = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate : new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
    const dateDefault = seed.toISOString().slice(0, 10);
    const timeDefault = seed.toTimeString().slice(0, 5);
    const dateInput = window.prompt('Enter date (YYYY-MM-DD)', dateDefault);
    if (!dateInput) return;
    const timeInput = window.prompt('Enter time (HH:mm)', timeDefault);
    if (!timeInput) return;
    const candidate = new Date(`${dateInput}T${timeInput}:00`);
    commitScheduledAt(candidate);
  };

  const openAndroidSchedulePicker = () => {
    const seed = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate : new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
    DateTimePickerAndroid.open({
      value: seed,
      mode: 'date',
      minimumDate: new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000),
      maximumDate: new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000),
      onChange: (_event, selectedDate) => {
        if (!selectedDate) return;
        DateTimePickerAndroid.open({
          value: seed,
          mode: 'time',
          is24Hour: false,
          onChange: (_timeEvent, selectedTime) => {
            if (!selectedTime) return;
            const merged = new Date(selectedDate);
            merged.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
            commitScheduledAt(merged);
          },
        });
      },
    });
  };

  const openSchedulePicker = () => {
    const seed = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate : new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
    setScheduleError(null);
    if (Platform.OS === 'android') {
      openAndroidSchedulePicker();
      return;
    }
    if (Platform.OS === 'ios') {
      setIosScheduleDraft(seed);
      setShowIosSchedulePicker(true);
      return;
    }
    openWebSchedulePrompt();
  };

  const getLocationWithTimeout = async (timeoutMs = 12000) => {
    return Promise.race([
      Location.getCurrentPositionAsync({}),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Location request timed out')), timeoutMs)
      ),
    ]);
  };

  const resolveAddressLabel = async (coords: { latitude: number; longitude: number }) => {
    try {
      const mapboxResolved = await reverseGeocodeMapbox(coords.latitude, coords.longitude);
      if (mapboxResolved?.address?.trim()) return mapboxResolved.address;
    } catch {
      // Fall through to Expo reverse geocoding.
    }

    const addresses = await Location.reverseGeocodeAsync(coords);
    if (addresses && addresses.length > 0) {
      const addr = addresses[0];
      const addressParts = [addr.street, addr.district, addr.city, addr.region].filter(Boolean);
      return addressParts.join(', ') || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    }
    return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  };

  const resolveCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Location permission is required to show nearby services.');
        return null;
      }

      let currentLocation: Location.LocationObject | null = null;
      try {
        currentLocation = await getLocationWithTimeout();
      } catch {
        // Fallback when precise location hangs/slow.
        currentLocation = await Location.getLastKnownPositionAsync();
      }

      if (!currentLocation) {
        Alert.alert('Location unavailable', 'Unable to fetch your location. Please try again.');
        return null;
      }

      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);

      try {
        const address = await resolveAddressLabel(coords);
        setCurrentLocationAddress(address);
        setPickupLocation(address);
        setPickupManuallyEdited(false);
      } catch {
        setCurrentLocationAddress('Current Location');
        setPickupLocation('Current Location');
        setPickupManuallyEdited(false);
      }
      return coords;
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location error', 'Unable to fetch location right now. Please try again.');
      return null;
    } finally {
      setLoadingLocation(false);
    }
  };

  useEffect(() => {
    void resolveCurrentLocation();
  }, []);

  const prevTripTypeRef = useRef<TripType>(tripType);
  useEffect(() => {
    if (currentLocationAddress && !pickupManuallyEdited) {
      setPickupLocation(currentLocationAddress);
    }
    if (prevTripTypeRef.current !== 'roadside' && tripType === 'roadside') {
      setDropLocation('');
      setSearchQuery('');
      setShowSearchResults(false);
    }
    prevTripTypeRef.current = tripType;
  }, [tripType, currentLocationAddress, pickupManuallyEdited]);

  useEffect(() => {
    let cancelled = false;
    if (tripType !== 'tow' || !location || !dropLocation.trim()) {
      setEstimate(null);
      return;
    }
    setEstimating(true);
    getTowEstimate({
      pickupLatitude: location.latitude,
      pickupLongitude: location.longitude,
      dropoffLatitude: dropLocationCoords?.latitude,
      dropoffLongitude: dropLocationCoords?.longitude,
      bookingType,
    })
      .then((value) => {
        if (!cancelled) setEstimate(value);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setEstimating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingType, dropLocation, dropLocationCoords?.latitude, dropLocationCoords?.longitude, location, tripType]);

  const escapeJs = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const getLeafletMapHTML = (
    lat: number,
    lng: number,
    serviceType: TripType,
    options?: { pickupLabel?: string; dropLat?: number; dropLng?: number; dropLabel?: string }
  ) => {
    const isTowTruck = serviceType === 'tow';
    const pickupLabel = escapeJs(options?.pickupLabel?.trim() || 'Pickup location');
    const dropLabel = escapeJs(options?.dropLabel?.trim() || 'Drop location');
    const hasDrop =
      typeof options?.dropLat === 'number' &&
      typeof options?.dropLng === 'number' &&
      Number.isFinite(options.dropLat) &&
      Number.isFinite(options.dropLng) &&
      (options.dropLat !== 0 || options.dropLng !== 0);
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body, html { width: 100%; height: 100%; overflow: hidden; }
            #map { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
            var map = L.map('map').setView([${lat}, ${lng}], 14);
            
            L.tileLayer('${hasMapboxToken ? MAPBOX_TILE_URL : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}', {
              attribution: '${hasMapboxToken ? MAPBOX_ATTRIBUTION : '© OpenStreetMap contributors'}',
              maxZoom: 19
            }).addTo(map);
            
            var pickupMarker = L.marker([${lat}, ${lng}], {
              icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background-color: #2563EB; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(map).bindPopup('${pickupLabel}');
            
            ${isTowTruck && hasDrop ? `
            var dropMarker = L.marker([${options?.dropLat}, ${options?.dropLng}], {
              icon: L.divIcon({
                className: 'drop-marker',
                html: '<div style="background-color: #111111; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35);">🏁</div>',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
              })
            }).addTo(map).bindPopup('${dropLabel}');

            async function drawRoute() {
              try {
                ${hasMapboxToken ? `
                const directionsUrl =
                  'https://api.mapbox.com/directions/v5/mapbox/driving/' +
                  '${lng},${lat};${options?.dropLng},${options?.dropLat}' +
                  '?geometries=geojson&overview=full&alternatives=false&access_token=${MAPBOX_TOKEN}';
                const res = await fetch(directionsUrl);
                const data = await res.json();
                const coords = data?.routes?.[0]?.geometry?.coordinates;
                if (Array.isArray(coords) && coords.length > 1) {
                  const latLngs = coords.map(function(c) { return [c[1], c[0]]; });
                  const routeLine = L.polyline(latLngs, { color: '#111111', weight: 5, opacity: 0.95 }).addTo(map);
                  map.fitBounds(routeLine.getBounds(), { padding: [24, 24] });
                  return;
                }
                ` : ''}
                // Fallback to straight line when routed path is unavailable.
                const fallback = L.polyline([[${lat}, ${lng}], [${options?.dropLat}, ${options?.dropLng}]], {
                  color: '#111111',
                  weight: 5,
                  opacity: 0.95
                }).addTo(map);
                map.fitBounds(fallback.getBounds(), { padding: [24, 24] });
              } catch (e) {
                const fallback = L.polyline([[${lat}, ${lng}], [${options?.dropLat}, ${options?.dropLng}]], {
                  color: '#111111',
                  weight: 5,
                  opacity: 0.95
                }).addTo(map);
                map.fitBounds(fallback.getBounds(), { padding: [24, 24] });
              }
            }
            drawRoute();
            ` : `
            // Roadside help locations (mechanics)
            var services = [
              { lat: ${lat + 0.004}, lng: ${lng + 0.006}, name: 'AutoCare Center' },
              { lat: ${lat - 0.002}, lng: ${lng + 0.007}, name: 'QuickFix Mechanics' },
              { lat: ${lat + 0.007}, lng: ${lng - 0.003}, name: 'City Auto Services' }
            ];
            
            services.forEach(function(service) {
              L.marker([service.lat, service.lng], {
                icon: L.divIcon({
                  className: 'mechanic-marker',
                  html: '<div style="background-color: #059669; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🔧</div>',
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
                })
              }).addTo(map).bindPopup(service.name);
            });
            `}
          </script>
        </body>
      </html>
    `;
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setDropLocation(query);
    setDropLocationCoords(null);
    setShowSearchResults(query.length > 0);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setSearchResults([]);
      setIsSearchingLocations(false);
      return;
    }
    const localResults = getLocalSuggestions(trimmed);
    setSearchResults(localResults);
    if (!hasMapboxToken) {
      setIsSearchingLocations(false);
      return;
    }
    setIsSearchingLocations(true);
    const searchId = ++lastSearchIdRef.current;
    void searchMapboxPlaces(trimmed, { limit: 3, country: 'lk' })
      .then((results) => {
        if (lastSearchIdRef.current !== searchId) return;
        setSearchResults(results.length > 0 ? results : localResults);
      })
      .catch(() => {
        if (lastSearchIdRef.current !== searchId) return;
        setSearchResults(localResults);
      })
      .finally(() => {
        if (lastSearchIdRef.current !== searchId) return;
        setIsSearchingLocations(false);
      });

    // Scroll to show search results when typing
    if (query.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleDropInputFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const handlePickupSearch = (query: string) => {
    setPickupQuery(query);
    setPickupLocation(query);
    setPickupManuallyEdited(true);
    setShowPickupSearchResults(query.length > 0);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setPickupSearchResults([]);
      setIsSearchingPickupLocations(false);
      return;
    }
    const localResults = getLocalSuggestions(trimmed);
    setPickupSearchResults(localResults);
    if (!hasMapboxToken) {
      setIsSearchingPickupLocations(false);
      return;
    }

    setIsSearchingPickupLocations(true);
    const searchId = ++lastPickupSearchIdRef.current;
    void searchMapboxPlaces(trimmed, {
      limit: 3,
      country: 'lk',
      proximity: location ?? undefined,
    })
      .then((results) => {
        if (lastPickupSearchIdRef.current !== searchId) return;
        setPickupSearchResults(results.length > 0 ? results : localResults);
      })
      .catch(() => {
        if (lastPickupSearchIdRef.current !== searchId) return;
        setPickupSearchResults(localResults);
      })
      .finally(() => {
        if (lastPickupSearchIdRef.current !== searchId) return;
        setIsSearchingPickupLocations(false);
      });
  };

  const handleSelectPickupLocation = (loc: LocationSuggestion) => {
    setPickupLocation(loc.name);
    if (loc.latitude !== 0 || loc.longitude !== 0) {
      setLocation({ latitude: loc.latitude, longitude: loc.longitude });
    }
    setPickupManuallyEdited(true);
    setPickupQuery('');
    setShowPickupSearchResults(false);
  };

  const getMapPickerHtml = (
    lat: number,
    lng: number,
    markerEmoji: string,
    currentLat?: number,
    currentLng?: number
  ) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=8.0, user-scalable=yes" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html, #map { width: 100%; height: 100%; overflow: hidden; }
          .locate-btn {
            width: 58px;
            height: 58px;
            border: none;
            border-radius: 29px;
            background: #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.22);
            color: #2f3d49;
            font-size: 28px;
            line-height: 58px;
            text-align: center;
            cursor: pointer;
          }
          .locate-wrap {
            margin-right: 16px;
            margin-bottom: 92px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const map = L.map('map', {
            zoomControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            boxZoom: true,
          }).setView([${lat}, ${lng}], 15);
          L.tileLayer('${hasMapboxToken ? MAPBOX_TILE_URL : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}', {
            attribution: '${hasMapboxToken ? MAPBOX_ATTRIBUTION : '© OpenStreetMap contributors'}',
            maxZoom: 19
          }).addTo(map);

          const truckIcon = L.divIcon({
            className: 'pickup-truck-marker',
            html: '<div style="background:#2563EB;color:#fff;border-radius:999px;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.25);">${markerEmoji}</div>',
            iconSize: [42, 42],
            iconAnchor: [21, 21],
          });
          let marker = L.marker([${lat}, ${lng}], { draggable: false, icon: truckIcon }).addTo(map);
          function post(lat, lng) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: lat, longitude: lng }));
          }
          post(${lat}, ${lng});
          window.__moveMarkerTo = function(lat, lng, shouldPost = true) {
            marker.setLatLng([lat, lng]);
            map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true });
            if (shouldPost) post(lat, lng);
          };
          function syncMarkerToCenter(shouldPost) {
            const center = map.getCenter();
            marker.setLatLng(center);
            if (shouldPost) post(center.lat, center.lng);
          }
          map.on('move', function() {
            syncMarkerToCenter(false);
          });
          map.on('moveend', function() {
            syncMarkerToCenter(true);
          });
          map.on('click', function(e) {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            map.setView([lat, lng], map.getZoom(), { animate: true });
            post(lat, lng);
          });

          const LocateControl = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function() {
              const container = L.DomUtil.create('div', 'locate-wrap');
              const btn = L.DomUtil.create('button', 'locate-btn', container);
              btn.type = 'button';
              btn.title = 'Use current location';
              btn.innerHTML = '⌖';
              L.DomEvent.disableClickPropagation(container);
              L.DomEvent.on(btn, 'click', function(e) {
                L.DomEvent.stop(e);
                window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'use_live_location' }));
              });
              return container;
            }
          });
          map.addControl(new LocateControl());
        </script>
      </body>
    </html>
  `;

  const openPickupMapPicker = () => {
    const base = location ?? { latitude: 6.9271, longitude: 79.8612 };
    setPickupMapDraft(base);
    setPickupMapSeed(base);
    setPickupMapDraftLabel(pickupLocation || currentLocationAddress || 'Selected on map');
    setShowPickupMapPicker(true);
  };

  const handlePickupMapMessage = (raw: string) => {
    try {
      const data = JSON.parse(raw) as { action?: string; latitude?: number; longitude?: number };
      if (data.action === 'use_live_location') {
        void useLiveLocationInMap('pickup');
        return;
      }
      if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return;
      const coords = { latitude: data.latitude, longitude: data.longitude };
      setPickupMapDraft(coords);
      void resolveAddressLabel(coords)
        .then((label) => setPickupMapDraftLabel(label))
        .catch(() => setPickupMapDraftLabel(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`));
    } catch {
      // ignore malformed webview payloads
    }
  };

  const confirmPickupFromMap = () => {
    if (!pickupMapDraft) return;
    setLocation(pickupMapDraft);
    setPickupLocation(pickupMapDraftLabel || `${pickupMapDraft.latitude.toFixed(4)}, ${pickupMapDraft.longitude.toFixed(4)}`);
    setPickupManuallyEdited(true);
    setShowPickupMapPicker(false);
  };

  const openDropMapPicker = () => {
    const base = dropLocationCoords ?? location ?? { latitude: 6.9271, longitude: 79.8612 };
    setDropMapDraft(base);
    setDropMapSeed(base);
    setDropMapDraftLabel(dropLocation || 'Selected on map');
    setShowDropMapPicker(true);
  };

  const handleDropMapMessage = (raw: string) => {
    try {
      const data = JSON.parse(raw) as { action?: string; latitude?: number; longitude?: number };
      if (data.action === 'use_live_location') {
        void useLiveLocationInMap('drop');
        return;
      }
      if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return;
      const coords = { latitude: data.latitude, longitude: data.longitude };
      setDropMapDraft(coords);
      void resolveAddressLabel(coords)
        .then((label) => setDropMapDraftLabel(label))
        .catch(() => setDropMapDraftLabel(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`));
    } catch {
      // ignore malformed webview payloads
    }
  };

  const confirmDropFromMap = () => {
    if (!dropMapDraft) return;
    const label = dropMapDraftLabel || `${dropMapDraft.latitude.toFixed(4)}, ${dropMapDraft.longitude.toFixed(4)}`;
    setDropLocation(label);
    setDropLocationCoords(dropMapDraft);
    saveRecentDropLocation({
      id: `recent-map-${Date.now()}`,
      name: label.split(',')[0]?.trim() || label,
      address: label,
      latitude: dropMapDraft.latitude,
      longitude: dropMapDraft.longitude,
    });
    setSearchQuery('');
    setShowSearchResults(false);
    setShowDropMapPicker(false);
    snapBottomSheet(false);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const useLiveLocationInMap = async (target: 'pickup' | 'drop') => {
    try {
      let current = null as Location.LocationObject | null;
      try {
        current = await getLocationWithTimeout();
      } catch {
        current = await Location.getLastKnownPositionAsync();
      }
      if (!current) return;
      const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      const label = await resolveAddressLabel(coords);
      const js = `window.__moveMarkerTo && window.__moveMarkerTo(${coords.latitude}, ${coords.longitude}, true); true;`;
      if (target === 'pickup') {
        setPickupMapDraft(coords);
        setPickupMapDraftLabel(label);
        pickupMapWebViewRef.current?.injectJavaScript(js);
      } else {
        setDropMapDraft(coords);
        setDropMapDraftLabel(label);
        dropMapWebViewRef.current?.injectJavaScript(js);
      }
    } catch {
      // ignore live locate failures in map picker
    }
  };

  const pickupMapSource = useMemo(
    () => ({
      html: getMapPickerHtml(
        pickupMapSeed?.latitude ?? location?.latitude ?? 6.9271,
        pickupMapSeed?.longitude ?? location?.longitude ?? 79.8612,
        '🚗',
        location?.latitude,
        location?.longitude
      ),
    }),
    [pickupMapSeed?.latitude, pickupMapSeed?.longitude, location?.latitude, location?.longitude]
  );

  const dropMapSource = useMemo(
    () => ({
      html: getMapPickerHtml(
        dropMapSeed?.latitude ?? dropLocationCoords?.latitude ?? location?.latitude ?? 6.9271,
        dropMapSeed?.longitude ?? dropLocationCoords?.longitude ?? location?.longitude ?? 79.8612,
        '🚚',
        location?.latitude,
        location?.longitude
      ),
    }),
    [
      dropMapSeed?.latitude,
      dropMapSeed?.longitude,
      dropLocationCoords?.latitude,
      dropLocationCoords?.longitude,
      location?.latitude,
      location?.longitude,
    ]
  );

  const handleSelectDropLocation = (loc: LocationSuggestion) => {
    setDropLocation(loc.name);
    setDropLocationCoords({ latitude: loc.latitude, longitude: loc.longitude });
    saveRecentDropLocation(loc);
    setSearchQuery('');
    setShowSearchResults(false);
    snapBottomSheet(false);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const handleConfirmBooking = async () => {
    if (tripType === 'tow' && !dropLocation.trim()) {
      Alert.alert('Please select a drop location');
      return;
    }
    if (tripType === 'tow' && bookingType === 'scheduled') {
      const picked = scheduledAt ? new Date(scheduledAt) : null;
      const validation = validateScheduledDate(picked);
      setScheduleError(validation);
      if (validation) {
        Alert.alert('Invalid schedule', validation);
        return;
      }
    }
    if (tripType === 'roadside' && !locationRef.current) {
      await resolveCurrentLocation();
      if (!locationRef.current) {
        Alert.alert('Location required', 'Please enable location and try again.');
        return;
      }
    }
    let pickupCoords = tripType === 'tow' ? location : null;
    if (tripType === 'tow') {
      if (!usablePickupCoords(pickupCoords?.latitude, pickupCoords?.longitude)) {
        pickupCoords = await resolveCurrentLocation();
      }
      if (!pickupCoords || !usablePickupCoords(pickupCoords.latitude, pickupCoords.longitude)) {
        Alert.alert(
          'Pickup location needed',
          'Enable location permission so your tow driver can see your pickup point on the map.',
        );
        return;
      }
    }
    if (!user || !selectedVehicle) {
      Alert.alert('Missing info', 'Sign in and select a vehicle first.');
      return;
    }
    if (!user.phoneNumber?.trim()) {
      Alert.alert('Missing phone number', 'Please add your phone number in your profile before booking.');
      return;
    }
    setSubmitting(true);
    try {
      if (!bookingIdempotencyKeyRef.current) {
        const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
        bookingIdempotencyKeyRef.current =
          c?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      }
      const idempotencyKey = bookingIdempotencyKeyRef.current;
      const pickupLatLng =
        tripType === 'tow' && pickupCoords
          ? pickupCoords
          : { latitude: location?.latitude ?? 0, longitude: location?.longitude ?? 0 };
      const created = await createServiceRequest({
        type: tripType,
        vehicle:
          selectedVehicle.makeModel?.trim() ||
          selectedVehicle.label?.trim() ||
          'Vehicle',
        issue: tripType === 'roadside' ? 'Roadside help requested' : 'Tow requested',
        location: pickupLocation || currentLocationAddress || dropLocation,
        latitude: pickupLatLng.latitude,
        longitude: pickupLatLng.longitude,
        phoneNumber: user.phoneNumber,
        vehicleId: selectedVehicle._id,
        pickupAddress: pickupLocation || currentLocationAddress || dropLocation,
        pickupLatitude: pickupLatLng.latitude,
        pickupLongitude: pickupLatLng.longitude,
        dropoffAddress: tripType === 'tow' ? dropLocation : undefined,
        dropoffLatitude: tripType === 'tow' ? dropLocationCoords?.latitude : undefined,
        dropoffLongitude: tripType === 'tow' ? dropLocationCoords?.longitude : undefined,
        bookingType: tripType === 'tow' ? bookingType : 'on_demand',
        scheduledAt: tripType === 'tow' && bookingType === 'scheduled' ? scheduledAt ?? undefined : undefined,
        estimatedAmount: estimate?.estimatedAmount,
        currency: estimate?.currency,
        pricingVersion: estimate?.pricingVersion,
        idempotencyKey,
      });
      bookingIdempotencyKeyRef.current = null;
      Alert.alert(
        'Booked',
        tripType === 'roadside'
          ? 'A mechanic will respond shortly.'
          : 'A tow driver will respond shortly.'
      );
      if (onBooked) onBooked(created._id, tripType);
      else onBack();
    } catch (e) {
      Alert.alert('Booking failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        mapContainer: {
          height: '75%',
          width: '100%',
        },
        mapPlaceholder: {
          height: '75%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.card,
        },
        backButton: {
          position: 'absolute',
          top: spacing.xl + spacing.md,
          left: spacing.lg,
          zIndex: 1000,
          width: scale(40),
          height: scale(40),
          borderRadius: scale(20),
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 4,
        },
        bottomOverlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.card,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
          maxHeight: Platform.OS === 'ios' ? '92%' : '88%',
          transform: [{ translateY: sheetTranslateY }],
        },
        bottomSheetHandleArea: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: spacing.xs,
          paddingBottom: spacing.xs,
        },
        bottomSheetHandle: {
          width: scale(48),
          height: scale(5),
          borderRadius: borderRadius.full,
          backgroundColor: colors.border,
        },
        bottomOverlayContent: {
          padding: spacing.lg,
          // Extra bottom space so last CTA can scroll above tab bar on phones.
          paddingBottom: spacing.xl * 2 + insets.bottom + tabBarHeight + spacing.lg,
        },
        laterButton: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.card,
          borderRadius: borderRadius.full,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.md,
        },
        laterButtonText: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.text,
          marginLeft: spacing.xs,
        },
        tripTypeContainer: {
          flexDirection: 'row',
          marginBottom: spacing.lg,
          backgroundColor: colors.background,
          borderRadius: borderRadius.md,
          padding: spacing.xs,
        },
        tripTypeOption: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.md,
          borderRadius: borderRadius.sm,
        },
        tripTypeOptionSelected: {
          backgroundColor: colors.card,
        },
        tripTypeText: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          marginLeft: spacing.xs,
        },
        tripTypeTextSelected: {
          color: colors.primary,
        },
        bookingTypeContainer: {
          flexDirection: 'row',
          marginBottom: spacing.md,
        },
        bookingChip: {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: scale(999),
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          marginRight: spacing.sm,
        },
        bookingChipActive: {
          borderColor: colors.primary,
          backgroundColor: 'rgba(37,99,235,0.10)',
        },
        bookingChipText: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.textSecondary,
          marginLeft: spacing.xs,
        },
        bookingChipTextActive: {
          color: colors.primary,
        },
        scheduleCard: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          backgroundColor: colors.background,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        scheduleAction: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
        },
        scheduleActionText: {
          marginLeft: spacing.xs,
          color: colors.primary,
          fontSize: fontSizes.sm,
          fontWeight: '700',
        },
        scheduleValue: {
          marginTop: spacing.sm,
          color: colors.text,
          fontSize: fontSizes.sm,
          fontWeight: '600',
        },
        scheduleError: {
          marginTop: spacing.xs,
          color: '#B91C1C',
          fontSize: fontSizes.xs,
          fontWeight: '600',
        },
        estimateCard: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          backgroundColor: colors.background,
        },
        locationField: {
          marginBottom: spacing.md,
        },
        locationLabel: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
          marginBottom: spacing.xs,
          textTransform: 'uppercase',
        },
        pickupLabel: {
          color: colors.primary,
        },
        dropLabel: {
          color: '#F97316',
        },
        locationInputContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        locationInput: {
          flex: 1,
          fontSize: fontSizes.md,
          color: colors.text,
          paddingVertical: spacing.xs,
        },
        locationInputPlaceholder: {
          color: colors.textSecondary,
        },
        locationActionButton: {
          padding: spacing.xs,
        },
        mapPickButton: {
          marginTop: spacing.xs,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 2,
          paddingHorizontal: 2,
        },
        mapPickButtonText: {
          marginLeft: spacing.xs,
          color: '#111111',
          fontSize: fontSizes.xs,
          fontWeight: '600',
        },
        sectionTitle: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.textSecondary,
          marginBottom: spacing.sm,
          textTransform: 'uppercase',
        },
        suggestedContainer: {
          flexDirection: 'row',
          marginTop: spacing.sm,
        },
        suggestedCard: {
          width: scale(180),
          backgroundColor: colors.background,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginRight: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        suggestedCardLast: {
          marginRight: 0,
        },
        suggestedIcon: {
          marginBottom: spacing.xs,
        },
        suggestedName: {
          fontSize: fontSizes.sm,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 2,
        },
        suggestedAddress: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
        },
        searchResultsContainer: {
          marginTop: spacing.sm,
          backgroundColor: colors.card,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          maxHeight: verticalScale(250),
          zIndex: 1000,
        },
        searchResultItem: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        searchResultName: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 2,
        },
        searchResultAddress: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        mapText: {
          fontSize: fontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        mapSubtext: {
          fontSize: fontSizes.xs,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        confirmButtonContainer: {
          marginTop: spacing.lg,
          paddingBottom: spacing.md,
        },
        mapPickerContainer: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'ios' ? spacing.xl + spacing.lg : spacing.lg,
        },
        mapPickerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        },
        mapPickerCancel: {
          color: colors.textSecondary,
          fontSize: fontSizes.sm,
          fontWeight: '600',
        },
        mapPickerTitle: {
          color: colors.text,
          fontSize: fontSizes.md,
          fontWeight: '700',
        },
        mapPickerConfirm: {
          color: colors.primary,
          fontSize: fontSizes.sm,
          fontWeight: '700',
        },
        mapPickerConfirmDisabled: {
          color: colors.textSecondary,
        },
        mapPickerLabelContainer: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: colors.card,
        },
        mapPickerLabelText: {
          color: colors.textSecondary,
          fontSize: fontSizes.sm,
        },
        mapPickerWebView: {
          flex: 1,
        },
        iosScheduleOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'flex-end',
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.sm,
        },
        iosScheduleSheet: {
          backgroundColor: colors.card,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          borderBottomLeftRadius: borderRadius.xl,
          borderBottomRightRadius: borderRadius.xl,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
        },
        iosScheduleHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        iosScheduleHeaderSide: {
          width: scale(76),
        },
        iosScheduleHeaderSideRight: {
          width: scale(76),
          alignItems: 'flex-end',
        },
        iosScheduleHeaderButton: {
          color: colors.primary,
          fontSize: fontSizes.md,
          fontWeight: '700',
        },
        iosScheduleTitle: {
          color: colors.text,
          fontSize: fontSizes.md,
          fontWeight: '700',
          textAlign: 'center',
          flex: 1,
        },
        iosSchedulePickerContainer: {
          paddingHorizontal: 0,
          paddingTop: spacing.xs,
          alignItems: 'center',
        },
      }),
    [spacing, fontSizes, iconSizes, borderRadius, verticalScale, scale, width, insets.bottom, tabBarHeight]
  );

  return (
    <View style={styles.container}>
      {loadingLocation ? (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.mapText, { marginTop: spacing.md }]}>Loading map...</Text>
        </View>
      ) : location ? (
        <WebView
          source={{
            html: getLeafletMapHTML(location.latitude, location.longitude, tripType, {
              pickupLabel: pickupLocation || currentLocationAddress || 'Pickup location',
              dropLat: dropLocationCoords?.latitude,
              dropLng: dropLocationCoords?.longitude,
              dropLabel: dropLocation || 'Drop location',
            }),
          }}
          style={styles.mapContainer}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          nestedScrollEnabled={true}
          renderLoading={() => (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        />
      ) : (
        <View style={styles.mapPlaceholder}>
          <Icon name="map" size={iconSizes.xl} color={colors.primary} />
          <Text style={styles.mapText}>Map View</Text>
          <Text style={styles.mapSubtext}>Enable location to see nearby services</Text>
        </View>
      )}

      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
        <Icon name="close" size={iconSizes.md} color={colors.text} />
      </TouchableOpacity>

      <Animated.View style={styles.bottomOverlay}>
        <View style={styles.bottomSheetHandleArea} {...sheetPanResponder.panHandlers}>
          <View style={styles.bottomSheetHandle} />
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.bottomOverlayContent}
          contentInset={{ bottom: tabBarHeight }}
          scrollIndicatorInsets={{ bottom: tabBarHeight }}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled
          bounces
          overScrollMode="always"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.tripTypeContainer}>
          <TouchableOpacity
            style={[
              styles.tripTypeOption,
              tripType === 'tow' && styles.tripTypeOptionSelected,
            ]}
            onPress={() => setTripType('tow')}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: scale(20),
                height: scale(20),
                borderRadius: scale(10),
                borderWidth: 2,
                borderColor: tripType === 'tow' ? colors.primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.xs,
              }}
            >
              {tripType === 'tow' && (
                <View
                  style={{
                    width: scale(10),
                    height: scale(10),
                    borderRadius: scale(5),
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </View>
            <Text
              style={[
                styles.tripTypeText,
                tripType === 'tow' && styles.tripTypeTextSelected,
              ]}
            >
              Tow Truck
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tripTypeOption,
              tripType === 'roadside' && styles.tripTypeOptionSelected,
            ]}
            onPress={() => setTripType('roadside')}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: scale(20),
                height: scale(20),
                borderRadius: scale(10),
                borderWidth: 2,
                borderColor: tripType === 'roadside' ? colors.primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.xs,
              }}
            >
              {tripType === 'roadside' && (
                <View
                  style={{
                    width: scale(10),
                    height: scale(10),
                    borderRadius: scale(5),
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </View>
            <Text
              style={[
                styles.tripTypeText,
                tripType === 'roadside' && styles.tripTypeTextSelected,
              ]}
            >
              Roadside Help
            </Text>
          </TouchableOpacity>
        </View>
        {tripType === 'tow' && (
          <>
            <View style={styles.bookingTypeContainer}>
              <TouchableOpacity
                style={[styles.bookingChip, bookingType === 'on_demand' && styles.bookingChipActive]}
                onPress={() => {
                  setBookingType('on_demand');
                  setScheduledAt(null);
                  setScheduleError(null);
                }}
                activeOpacity={0.8}
              >
                <Icon
                  name="flash"
                  size={iconSizes.sm}
                  color={bookingType === 'on_demand' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.bookingChipText, bookingType === 'on_demand' && styles.bookingChipTextActive]}>
                  On-demand
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bookingChip, bookingType === 'scheduled' && styles.bookingChipActive]}
                onPress={() => {
                  setBookingType('scheduled');
                  const next = new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
                  setScheduledAt(next.toISOString());
                  setScheduleError(null);
                }}
                activeOpacity={0.8}
              >
                <Icon
                  name="time"
                  size={iconSizes.sm}
                  color={bookingType === 'scheduled' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.bookingChipText, bookingType === 'scheduled' && styles.bookingChipTextActive]}>
                  Scheduled
                </Text>
              </TouchableOpacity>
            </View>
            {bookingType === 'scheduled' && (
              <View style={styles.scheduleCard}>
                <TouchableOpacity style={styles.scheduleAction} onPress={openSchedulePicker} activeOpacity={0.8}>
                  <Icon name="calendar" size={iconSizes.sm} color={colors.primary} />
                  <Text style={styles.scheduleActionText}>Pick date & time</Text>
                </TouchableOpacity>
                <Text style={styles.scheduleValue}>{scheduledDisplay}</Text>
                {!!scheduleError && <Text style={styles.scheduleError}>{scheduleError}</Text>}
              </View>
            )}
            {showTowEstimateCard && (
              <View style={styles.estimateCard}>
                <Text style={styles.sectionTitle}>Estimated hire amount</Text>
                <Text style={styles.mapText}>
                  {estimating
                    ? 'Calculating estimate...'
                    : estimate
                    ? `${estimate.currency ?? 'LKR'} ${Number(estimate.estimatedAmount ?? 0).toFixed(2)}`
                    : 'Unable to calculate estimate right now.'}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.locationField}>
          <Text style={[styles.locationLabel, styles.pickupLabel]}>
            {tripType === 'roadside' ? 'Current Location' : 'PICKUP'}
          </Text>
          <View style={styles.locationInputContainer}>
            <TextInput
              style={styles.locationInput}
              placeholder={loadingLocation ? 'Fetching location...' : 'Enter pickup location'}
              placeholderTextColor={colors.textSecondary}
              value={pickupLocation}
              onChangeText={handlePickupSearch}
              onFocus={() => {
                if (pickupLocation.trim().length > 0) {
                  setShowPickupSearchResults(true);
                }
              }}
              editable
            />
            <TouchableOpacity
              style={styles.locationActionButton}
              activeOpacity={0.7}
              onPress={() => {
                setPickupManuallyEdited(false);
                void resolveCurrentLocation();
              }}
            >
              <Icon
                name="locate"
                size={iconSizes.sm}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
          {showPickupSearchResults && pickupQuery.length > 0 && (
            <View style={styles.searchResultsContainer}>
              {pickupSearchResults.slice(0, 3).map((loc) => (
                <TouchableOpacity
                  key={`pickup-${loc.id}`}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectPickupLocation(loc)}
                  activeOpacity={0.7}
                >
                  <Icon name="navigate" size={iconSizes.sm} color={colors.primary} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{loc.name}</Text>
                    <Text style={styles.searchResultAddress}>{loc.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {isSearchingPickupLocations && (
                <View style={styles.searchResultItem}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.searchResultAddress, { marginLeft: spacing.sm }]}>Searching...</Text>
                </View>
              )}
              {!isSearchingPickupLocations && pickupSearchResults.length === 0 && (
                <View style={styles.searchResultItem}>
                  <Text style={styles.searchResultAddress}>
                    {hasMapboxToken ? 'No results found' : 'Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to search globally'}
                  </Text>
                </View>
              )}
            </View>
          )}
          <TouchableOpacity style={styles.mapPickButton} onPress={openPickupMapPicker} activeOpacity={0.8}>
            <Icon name="location-outline" size={iconSizes.sm} color="#111111" />
            <Text style={styles.mapPickButtonText}>
              {tripType === 'roadside' ? 'Set current location on map' : 'Set location on map'}
            </Text>
          </TouchableOpacity>
          {tripType === 'roadside' && !location && (
            <Text style={[styles.mapSubtext, { marginTop: spacing.xs }]}>
              Location is required to confirm roadside help.
            </Text>
          )}
        </View>

        {tripType === 'tow' && (
          <View style={styles.locationField}>
            <Text style={[styles.locationLabel, styles.dropLabel]}>DROP</Text>
            <View style={styles.locationInputContainer}>
              <TextInput
                ref={dropInputRef}
                style={styles.locationInput}
                placeholder="Search location"
                placeholderTextColor={colors.textSecondary}
                value={dropLocation}
                onChangeText={handleSearch}
                onFocus={handleDropInputFocus}
              />
            </View>
            {showSearchResults && searchQuery.length > 0 && (
              <View style={styles.searchResultsContainer}>
                {searchResults.slice(0, 3).map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                    style={styles.searchResultItem}
                    onPress={() => handleSelectDropLocation(loc)}
                    activeOpacity={0.7}
                  >
                    <Icon name="map" size={iconSizes.sm} color={colors.primary} style={{ marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{loc.name}</Text>
                      <Text style={styles.searchResultAddress}>{loc.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {isSearchingLocations && (
                  <View style={styles.searchResultItem}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.searchResultAddress, { marginLeft: spacing.sm }]}>Searching...</Text>
                  </View>
                )}
                {!isSearchingLocations && searchResults.length === 0 && (
                  <View style={styles.searchResultItem}>
                    <Text style={styles.searchResultAddress}>
                      {hasMapboxToken ? 'No results found' : 'Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to search globally'}
                    </Text>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity style={styles.mapPickButton} onPress={openDropMapPicker} activeOpacity={0.8}>
              <Icon name="location-outline" size={iconSizes.sm} color="#111111" />
              <Text style={styles.mapPickButtonText}>Set location on map</Text>
            </TouchableOpacity>
          </View>
        )}

        {tripType === 'roadside' ? (
          <>
            <View style={styles.confirmButtonContainer}>
              <PrimaryButton
                title={submitting ? 'Booking…' : 'Confirm Roadside Help'}
                onPress={handleConfirmBooking}
                disabled={submitting}
              />
            </View>
          </>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedContainer}
              keyboardShouldPersistTaps="handled"
            >
              {visibleRecentDrops.map((loc, index) => (
                <TouchableOpacity
                  key={loc.id}
                  style={[
                    styles.suggestedCard,
                    index === visibleRecentDrops.length - 1 && styles.suggestedCardLast,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSelectDropLocation(loc)}
                >
                  <Text style={styles.suggestedName} numberOfLines={1}>
                    {loc.name}
                  </Text>
                  <Text style={styles.suggestedAddress} numberOfLines={1}>
                    {loc.address}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.confirmButtonContainer}>
              <PrimaryButton
                title={submitting ? 'Booking…' : 'Confirm Tow Truck Hire'}
                onPress={handleConfirmBooking}
                disabled={!dropLocation.trim() || submitting}
              />
            </View>
          </>
        )}
        </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
      <Modal visible={showPickupMapPicker} animationType="slide" onRequestClose={() => setShowPickupMapPicker(false)}>
        <View style={styles.mapPickerContainer}>
          <View style={styles.mapPickerHeader}>
            <TouchableOpacity onPress={() => setShowPickupMapPicker(false)} activeOpacity={0.8}>
              <Text style={styles.mapPickerCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.mapPickerTitle}>Pick pickup location</Text>
            <TouchableOpacity onPress={confirmPickupFromMap} activeOpacity={0.8} disabled={!pickupMapDraft}>
              <Text style={[styles.mapPickerConfirm, !pickupMapDraft && styles.mapPickerConfirmDisabled]}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mapPickerLabelContainer}>
            <Text numberOfLines={2} style={styles.mapPickerLabelText}>
              {pickupMapDraftLabel || 'Tap map to choose location'}
            </Text>
          </View>
          <WebView
            ref={pickupMapWebViewRef}
            source={pickupMapSource}
            onMessage={(event) => handlePickupMapMessage(event.nativeEvent.data)}
            setBuiltInZoomControls={true}
            setDisplayZoomControls={false}
            style={styles.mapPickerWebView}
          />
        </View>
      </Modal>
      <Modal visible={showDropMapPicker} animationType="slide" onRequestClose={() => setShowDropMapPicker(false)}>
        <View style={styles.mapPickerContainer}>
          <View style={styles.mapPickerHeader}>
            <TouchableOpacity onPress={() => setShowDropMapPicker(false)} activeOpacity={0.8}>
              <Text style={styles.mapPickerCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.mapPickerTitle}>Pick drop location</Text>
            <TouchableOpacity onPress={confirmDropFromMap} activeOpacity={0.8} disabled={!dropMapDraft}>
              <Text style={[styles.mapPickerConfirm, !dropMapDraft && styles.mapPickerConfirmDisabled]}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mapPickerLabelContainer}>
            <Text numberOfLines={2} style={styles.mapPickerLabelText}>
              {dropMapDraftLabel || 'Move map to choose drop location'}
            </Text>
          </View>
          <WebView
            ref={dropMapWebViewRef}
            source={dropMapSource}
            onMessage={(event) => handleDropMapMessage(event.nativeEvent.data)}
            setBuiltInZoomControls={true}
            setDisplayZoomControls={false}
            style={styles.mapPickerWebView}
          />
        </View>
      </Modal>
      <Modal
        visible={showIosSchedulePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIosSchedulePicker(false)}
      >
        <View style={styles.iosScheduleOverlay}>
          <View style={styles.iosScheduleSheet}>
            <View style={styles.iosScheduleHeader}>
              <View style={styles.iosScheduleHeaderSide}>
                <TouchableOpacity onPress={() => setShowIosSchedulePicker(false)} activeOpacity={0.8}>
                  <Text style={styles.iosScheduleHeaderButton}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.iosScheduleTitle}>Pick date & time</Text>
              <View style={styles.iosScheduleHeaderSideRight}>
                <TouchableOpacity
                  onPress={() => {
                    commitScheduledAt(iosScheduleDraft);
                    setShowIosSchedulePicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.iosScheduleHeaderButton}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.iosSchedulePickerContainer}>
              <DateTimePicker
                value={iosScheduleDraft}
                mode="datetime"
                display="default"
                themeVariant="light"
                textColor="#111111"
                style={{ backgroundColor: colors.card, alignSelf: 'center' }}
                minimumDate={new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000)}
                maximumDate={new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000)}
                onChange={(_event, date) => {
                  if (date) setIosScheduleDraft(date);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
