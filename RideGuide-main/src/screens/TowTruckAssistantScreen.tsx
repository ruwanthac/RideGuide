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
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Icon, PrimaryButton } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { createServiceRequest } from '../backend/serviceRequestsService';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../context/VehiclesContext';

type TripType = 'tow' | 'roadside';

interface TowTruckAssistantScreenProps {
  onBack: () => void;
}

const SUGGESTED_LOCATIONS = [
  { id: '1', name: 'Iskole Handiya', address: 'Homagama, Sri Lanka' },
  { id: '2', name: 'Pettah Bus', address: 'Colombo, Sri Lanka' },
];

const RECENT_GARAGES = [
  { id: 'g1', name: 'AutoCare Garage', address: 'Homagama, Sri Lanka' },
  { id: 'g2', name: 'Quick Fix Motors', address: 'Colombo 03, Sri Lanka' },
  { id: 'g3', name: 'City Auto Service', address: 'Pettah, Colombo, Sri Lanka' },
  { id: 'g4', name: 'Roadside Pro Garage', address: 'Kotte, Sri Lanka' },
];

export const TowTruckAssistantScreen: React.FC<TowTruckAssistantScreenProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { selectedVehicle } = useVehicles();
  const [tripType, setTripType] = useState<TripType>('tow');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = useState<string>('');
  const [isPickupFavorite, setIsPickupFavorite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const dropInputRef = useRef<TextInput>(null);
  const { spacing, fontSizes, iconSizes, borderRadius, verticalScale, scale, width } = useResponsive();

  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission',
            'Location permission is required to show nearby services.'
          );
          setLoadingLocation(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
        setLocation(coords);

        // Reverse geocode to get address
        try {
          const addresses = await Location.reverseGeocodeAsync(coords);
          if (addresses && addresses.length > 0) {
            const addr = addresses[0];
            const addressParts = [
              addr.street,
              addr.district,
              addr.city,
              addr.region,
            ].filter(Boolean);
            const address = addressParts.join(', ') || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
            setCurrentLocationAddress(address);
            setPickupLocation(address);
          } else {
            const address = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
            setCurrentLocationAddress(address);
            setPickupLocation('Current Location');
          }
        } catch {
          setCurrentLocationAddress('Current Location');
          setPickupLocation('Current Location');
        }

        setLoadingLocation(false);
      } catch (error) {
        console.error('Error getting location:', error);
        setLoadingLocation(false);
      }
    };

    getLocation();
  }, []);

  const prevTripTypeRef = useRef<TripType>(tripType);
  useEffect(() => {
    if (currentLocationAddress) {
      setPickupLocation(currentLocationAddress);
    }
    if (prevTripTypeRef.current !== 'roadside' && tripType === 'roadside') {
      setDropLocation('');
      setSearchQuery('');
      setShowSearchResults(false);
    }
    prevTripTypeRef.current = tripType;
  }, [tripType, currentLocationAddress]);

  const getLeafletMapHTML = (lat: number, lng: number, serviceType: TripType) => {
    const isTowTruck = serviceType === 'tow';
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
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors',
              maxZoom: 19
            }).addTo(map);
            
            var userMarker = L.marker([${lat}, ${lng}], {
              icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background-color: #2563EB; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(map).bindPopup('Your Location');
            
            ${isTowTruck ? `
            // Tow truck locations
            var services = [
              { lat: ${lat + 0.005}, lng: ${lng + 0.005}, name: 'Quick Tow 24/7' },
              { lat: ${lat - 0.003}, lng: ${lng + 0.008}, name: 'City Tow Services' },
              { lat: ${lat + 0.008}, lng: ${lng - 0.004}, name: 'Highway Rescue' }
            ];
            
            services.forEach(function(service) {
              L.marker([service.lat, service.lng], {
                icon: L.divIcon({
                  className: 'tow-truck-marker',
                  html: '<div style="background-color: #2563EB; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚛</div>',
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
                })
              }).addTo(map).bindPopup(service.name);
            });
            ` : `
            // Roadside help locations (mechanics)
            var services = [
              { lat: ${lat + 0.004}, lng: ${lng + 0.006}, name: 'AutoCare Center' },
              { lat: ${lat - 0.002}, lng: ${lng + 0.007}, name: 'QuickFix Garage' },
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
    setShowSearchResults(query.length > 0);
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

  const handleSelectDropLocation = (name: string, address: string) => {
    setDropLocation(name);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleConfirmBooking = async () => {
    if (!dropLocation.trim()) {
      Alert.alert('Please select a drop location');
      return;
    }
    if (!user || !selectedVehicle) {
      Alert.alert('Missing info', 'Sign in and select a vehicle first.');
      return;
    }
    setSubmitting(true);
    try {
      await createServiceRequest({
        type: tripType,
        vehicle: `${selectedVehicle.label} — ${selectedVehicle.makeModel}`,
        issue: 'Tow requested',
        location: dropLocation,
        latitude: location?.latitude ?? 0,
        longitude: location?.longitude ?? 0,
        phoneNumber: user.phoneNumber ?? '',
        vehicleId: selectedVehicle._id,
      });
      Alert.alert('Booked', 'A tow driver will respond shortly.');
      onBack();
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
          maxHeight: '70%',
        },
        bottomOverlayContent: {
          padding: spacing.lg,
          paddingBottom: spacing.xl,
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
          flex: 1,
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
      }),
    [spacing, fontSizes, iconSizes, borderRadius, verticalScale, scale, width]
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
            html: getLeafletMapHTML(location.latitude, location.longitude, tripType),
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

      <KeyboardAvoidingView
        style={styles.bottomOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.bottomOverlayContent}
          showsVerticalScrollIndicator={true}
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

        <View style={styles.locationField}>
          <Text style={[styles.locationLabel, styles.pickupLabel]}>
            {tripType === 'roadside' ? 'Current Location' : 'PICKUP'}
          </Text>
          <View style={styles.locationInputContainer}>
            <TextInput
              style={styles.locationInput}
              placeholder={loadingLocation ? 'Fetching location...' : 'Enter pickup location'}
              placeholderTextColor={colors.textSecondary}
              value={pickupLocation || currentLocationAddress || ''}
              onChangeText={setPickupLocation}
              editable={true}
            />
            <TouchableOpacity
              style={styles.locationActionButton}
              activeOpacity={0.7}
              onPress={() => setIsPickupFavorite(!isPickupFavorite)}
            >
              <Icon
                name="star"
                size={iconSizes.sm}
                color={isPickupFavorite ? '#FBBF24' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.locationField}>
          <Text style={[styles.locationLabel, styles.dropLabel]}>
            {tripType === 'roadside' ? 'GARAGE LOCATION' : 'DROP'}
          </Text>
          <View style={styles.locationInputContainer}>
            <TextInput
              ref={dropInputRef}
              style={styles.locationInput}
              placeholder={tripType === 'roadside' ? 'Search garage location' : 'Search location'}
              placeholderTextColor={colors.textSecondary}
              value={dropLocation}
              onChangeText={handleSearch}
              onFocus={handleDropInputFocus}
            />
          </View>
          {showSearchResults && searchQuery.length > 0 && (
            <View style={styles.searchResultsContainer}>
              {(tripType === 'roadside' ? RECENT_GARAGES : SUGGESTED_LOCATIONS)
                .filter(
                  (loc) =>
                    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    loc.address.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                    style={styles.searchResultItem}
                    onPress={() => handleSelectDropLocation(loc.name, loc.address)}
                    activeOpacity={0.7}
                  >
                    <Icon name="map" size={iconSizes.sm} color={colors.primary} style={{ marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{loc.name}</Text>
                      <Text style={styles.searchResultAddress}>{loc.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              {(tripType === 'roadside' ? RECENT_GARAGES : SUGGESTED_LOCATIONS).filter(
                (loc) =>
                  loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  loc.address.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <View style={styles.searchResultItem}>
                  <Text style={styles.searchResultAddress}>No results found</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {tripType === 'roadside' ? (
          <>
            <Text style={styles.sectionTitle}>Recent garage locations</Text>
            <View style={styles.suggestedContainer}>
              {RECENT_GARAGES.map((loc, index) => (
                <TouchableOpacity
                  key={loc.id}
                  style={[
                    styles.suggestedCard,
                    index === RECENT_GARAGES.length - 1 && styles.suggestedCardLast,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDropLocation(loc.name);
                    setShowSearchResults(false);
                  }}
                >
                  <Icon name="construct" size={iconSizes.sm} color={colors.primary} style={styles.suggestedIcon} />
                  <Text style={styles.suggestedName} numberOfLines={1}>
                    {loc.name}
                  </Text>
                  <Text style={styles.suggestedAddress} numberOfLines={1}>
                    {loc.address}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.confirmButtonContainer}>
              <PrimaryButton
                title={submitting ? 'Booking…' : 'Confirm Garage Location'}
                onPress={handleConfirmBooking}
                disabled={!dropLocation.trim() || submitting}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.suggestedContainer}>
              {SUGGESTED_LOCATIONS.map((loc, index) => (
                <TouchableOpacity
                  key={loc.id}
                  style={[
                    styles.suggestedCard,
                    index === SUGGESTED_LOCATIONS.length - 1 && styles.suggestedCardLast,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setDropLocation(loc.name)}
                >
                  <Icon name="map" size={iconSizes.sm} color={colors.primary} style={styles.suggestedIcon} />
                  <Text style={styles.suggestedName} numberOfLines={1}>
                    {loc.name}
                  </Text>
                  <Text style={styles.suggestedAddress} numberOfLines={1}>
                    {loc.address}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
    </View>
  );
};
