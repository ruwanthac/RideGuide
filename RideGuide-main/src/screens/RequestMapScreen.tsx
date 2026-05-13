import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { HomeStackParamList } from '../types/navigation';
import { haversineKm } from '../utils/geoDistance';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
const MAP_TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = MAPBOX_TOKEN
  ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function escapeForJsSingleQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function buildLeafletHtml(lat: number, lng: number, locationLabel: string): string {
  const escapedLabel = escapeForJsSingleQuoted(locationLabel);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-popup-content-wrapper { border-radius: 8px; }
    .leaflet-popup-content { margin: 10px 14px; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${lat}, ${lng}], 15);
    L.tileLayer('${MAP_TILE_URL}', {
      attribution: '${MAP_ATTRIBUTION}'
    }).addTo(map);
    var marker = L.marker([${lat}, ${lng}]).addTo(map);
    marker.bindPopup('<b>${escapedLabel}</b><br>Request location').openPopup();
  </script>
</body>
</html>
  `.trim();
}

/**
 * Two markers + black road-following route (Mapbox Directions if token set, else OSRM, else straight line).
 */
function buildProviderPreviewHtml(
  ownerLat: number,
  ownerLng: number,
  meLat: number,
  meLng: number,
  mapboxToken: string,
  ownerPopup: string,
  mePopup: string,
): string {
  const oPop = escapeForJsSingleQuoted(ownerPopup);
  const mPop = escapeForJsSingleQuoted(mePopup);
  const tokenJs = escapeForJsSingleQuoted(mapboxToken);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    #banner {
      position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1000;
      background: rgba(255,255,255,0.95); padding: 10px 12px; border-radius: 10px;
      font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.12); line-height: 1.35;
    }
    #banner b { color: #111; }
  </style>
</head>
<body>
  <div id="banner">Loading route…</div>
  <div id="map"></div>
  <script>
    var owner = [${ownerLat}, ${ownerLng}];
    var me = [${meLat}, ${meLng}];
    var map = L.map('map').setView(owner, 13);
    L.tileLayer('${MAP_TILE_URL}', { attribution: '${MAP_ATTRIBUTION}' }).addTo(map);
    var ownerIcon = L.divIcon({ className: 'owner-pin', html: '<div style="width:14px;height:14px;border-radius:50%;background:#0d9488;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>', iconSize: [14,14], iconAnchor: [7,7] });
    var meIcon = L.divIcon({ className: 'me-pin', html: '<div style="width:14px;height:14px;border-radius:50%;background:#1d4ed8;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>', iconSize: [14,14], iconAnchor: [7,7] });
    L.marker(owner, { icon: ownerIcon }).addTo(map).bindPopup('<b>${oPop}</b><br>Vehicle owner (pickup / live)');
    L.marker(me, { icon: meIcon }).addTo(map).bindPopup('<b>${mPop}</b><br>Your position');
    var banner = document.getElementById('banner');
    function straightKm() {
      var R = 6371, toR = Math.PI/180;
      var dLat = toR * (owner[0] - me[0]), dLon = toR * (owner[1] - me[1]);
      var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toR*me[0])*Math.cos(toR*owner[0])*Math.sin(dLon/2)*Math.sin(dLon/2);
      return (2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }
    function drawLine(latlngs, distLabel, note) {
      L.polyline(latlngs, { color: '#111111', weight: 5, opacity: 0.92 }).addTo(map);
      map.fitBounds(L.latLngBounds(latlngs), { padding: [36, 36] });
      var sk = straightKm();
      banner.innerHTML = '<b>' + distLabel + '</b>' + (note ? '<br><span style="color:#555;font-size:12px">' + note + '</span>' : '') +
        '<br><span style="color:#666;font-size:12px">Straight line ≈ ' + sk.toFixed(1) + ' km</span>';
    }
    var token = '${tokenJs}';
    function tryMapbox() {
      if (!token || token.length < 10) return Promise.reject();
      var url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' + me[1] + ',' + me[0] + ';' + owner[1] + ',' + owner[0] +
        '?geometries=geojson&overview=full&access_token=' + encodeURIComponent(token);
      return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
        if (!data.routes || !data.routes[0]) throw new Error('no route');
        var coords = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
        var km = (data.routes[0].distance / 1000).toFixed(1);
        drawLine(coords, 'Driving distance ≈ ' + km + ' km', 'Route via Mapbox (roads).');
      });
    }
    function tryOsrm() {
      var url = 'https://router.project-osrm.org/route/v1/driving/' + me[1] + ',' + me[0] + ';' + owner[1] + ',' + owner[0] + '?overview=full&geometries=geojson';
      return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
        if (!data.routes || !data.routes[0]) throw new Error('no route');
        var coords = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
        var km = (data.routes[0].distance / 1000).toFixed(1);
        drawLine(coords, 'Driving distance ≈ ' + km + ' km', 'Route via OSRM (OpenStreetMap roads).');
      });
    }
    tryMapbox().catch(function() {
      return tryOsrm();
    }).catch(function() {
      drawLine([me, owner], 'Road route unavailable', 'Showing straight line between you and the owner.');
    });
  </script>
</body>
</html>
  `.trim();
}

type RequestMapRouteProp = RouteProp<HomeStackParamList, 'RequestMap'>;

interface RequestMapScreenProps {
  onBack: () => void;
}

export const RequestMapScreen: React.FC<RequestMapScreenProps> = ({ onBack }) => {
  const route = useRoute<RequestMapRouteProp>();
  const { spacing, fontSizes } = useResponsive();
  const { width, height } = useWindowDimensions();
  const {
    location,
    latitude,
    longitude,
    previewRouteToOwner,
    ownerLatitude,
    ownerLongitude,
    customerName,
  } = route.params;

  const ownerLat = typeof ownerLatitude === 'number' ? ownerLatitude : latitude;
  const ownerLng = typeof ownerLongitude === 'number' ? ownerLongitude : longitude;
  const preview = previewRouteToOwner === true;

  const [meCoords, setMeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'loading' | 'ok' | 'denied' | 'idle'>(
    preview ? 'loading' : 'idle',
  );

  const loadMyLocation = useCallback(async () => {
    if (!preview) return;
    setLocStatus('loading');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocStatus('denied');
        setMeCoords(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMeCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocStatus('ok');
    } catch {
      setLocStatus('denied');
      setMeCoords(null);
    }
  }, [preview]);

  useEffect(() => {
    void loadMyLocation();
  }, [loadMyLocation]);

  const straightKm =
    meCoords && preview
      ? haversineKm(meCoords.lat, meCoords.lng, ownerLat, ownerLng)
      : null;

  const html = useMemo(() => {
    if (preview && meCoords) {
      return buildProviderPreviewHtml(
        ownerLat,
        ownerLng,
        meCoords.lat,
        meCoords.lng,
        MAPBOX_TOKEN,
        customerName?.trim() || 'Vehicle owner',
        'You',
      );
    }
    return buildLeafletHtml(latitude, longitude, location);
  }, [preview, meCoords, ownerLat, ownerLng, latitude, longitude, location, customerName]);

  const webKey = preview && meCoords ? `route-${meCoords.lat}-${meCoords.lng}-${ownerLat}-${ownerLng}` : `pin-${latitude}-${longitude}`;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          paddingTop: spacing.xl * 2 + spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        },
        backButton: {
          padding: spacing.sm,
          marginRight: spacing.sm,
        },
        headerTitle: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: colors.text,
          flex: 1,
        },
        subBanner: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: colors.card,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        subBannerText: {
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
        },
        mapWrapper: {
          flex: 1,
          width,
          height: height - 120,
        },
        centerBox: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        },
      }),
    [spacing, fontSizes, width, height],
  );

  const headerRight = preview ? (
        <TouchableOpacity onPress={() => void loadMyLocation()} style={{ padding: spacing.sm }} hitSlop={12}>
          <Icon name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {preview ? 'Owner location & route' : location}
        </Text>
        {headerRight}
      </View>
      {preview ? (
        <View style={styles.subBanner}>
          {locStatus === 'loading' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.subBannerText, { marginLeft: 8 }]}>
                Getting your position for distance and route…
              </Text>
            </View>
          ) : locStatus === 'denied' || !meCoords ? (
            <Text style={styles.subBannerText}>
              Location disabled — map shows the vehicle owner only. Enable location to see driving distance and a black
              route on roads to the owner.
            </Text>
          ) : (
            <Text style={styles.subBannerText}>
              {customerName ? `${customerName} · ` : ''}
              Straight line ≈ {straightKm != null ? `${straightKm.toFixed(1)} km` : '—'} to vehicle owner
              {typeof ownerLatitude === 'number' && typeof ownerLongitude === 'number' ? ' (live or pickup pin)' : ''}
            </Text>
          )}
        </View>
      ) : null}
      <View style={styles.mapWrapper}>
        {preview && locStatus === 'loading' ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <WebView
            key={webKey}
            source={{ html }}
            style={{ flex: 1 }}
            scrollEnabled
            bounces={false}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
          />
        )}
      </View>
    </View>
  );
};
