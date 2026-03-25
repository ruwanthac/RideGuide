import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import type { HomeStackParamList } from '../types/navigation';

function buildLeafletHtml(lat: number, lng: number, locationLabel: string): string {
  const escapedLabel = locationLabel
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    var marker = L.marker([${lat}, ${lng}]).addTo(map);
    marker.bindPopup('<b>${escapedLabel}</b><br>Help request location').openPopup();
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
  const { location, latitude, longitude } = route.params;

  const html = useMemo(
    () => buildLeafletHtml(latitude, longitude, location),
    [latitude, longitude, location]
  );

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
        mapWrapper: {
          flex: 1,
          width,
          height: height - 120,
        },
      }),
    [spacing, fontSizes, width, height]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{location}</Text>
      </View>
      <View style={styles.mapWrapper}>
        <WebView
          source={{ html }}
          style={{ flex: 1 }}
          scrollEnabled={true}
          bounces={false}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </View>
  );
};
