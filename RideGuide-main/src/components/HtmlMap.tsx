import React from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Shows a self-contained Leaflet map page: in a WebView on phones, or in an iframe on web
 * (react-native-webview has no web support). Only for display maps that don't post messages back.
 */
export const HtmlMap: React.FC<{ html: string; mapKey?: string; scrollEnabled?: boolean }> = ({ html, mapKey, scrollEnabled = false }) => {
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      key: mapKey,
      srcDoc: html,
      title: 'Map',
      style: { border: 0, width: '100%', height: '100%', display: 'block' },
    });
  }
  return (
    <WebView
      key={mapKey}
      source={{ html }}
      style={{ flex: 1 }}
      scrollEnabled={scrollEnabled}
      originWhitelist={['*']}
      androidLayerType="hardware"
    />
  );
};
