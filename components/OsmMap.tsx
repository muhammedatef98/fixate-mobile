import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';

// react-native-webview ships a native module (RNCWebViewModule). If the
// installed native binary was built before this dependency was added, importing
// it throws at module-eval ("RNCWebViewModule could not be found") — which takes
// down EVERY screen that renders a map (request, order-details, track) and drops
// them from the router. Require it lazily + defensively so those screens keep
// working; the map area shows a clear hint instead of crashing. A native rebuild
// restores the real map.
let WebView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
} catch {
  WebView = null;
}

/**
 * Keyless map built on a WebView + Leaflet + OpenStreetMap tiles.
 *
 * react-native-maps renders through the Google Maps SDK on Android, which
 * hard-crashes without a `com.google.android.geo.API_KEY`. This component
 * needs no API key, no billing, and works identically on iOS and Android.
 *
 * Two modes:
 *  - interactive: a fixed center pin; the map pans under it and emits the
 *    centre coordinate via `onMoveEnd` (the "drag to set location" picker).
 *  - display: renders `markers` only (live tracking / read-only previews).
 */

export interface OsmMarker {
  lat: number;
  lng: number;
  color?: string;
}

export interface OsmMapHandle {
  recenter: (lat: number, lng: number, zoom?: number) => void;
  fitToMarkers: () => void;
}

interface OsmMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  interactive?: boolean;
  onMoveEnd?: (lat: number, lng: number) => void;
  onReady?: () => void;
  markers?: OsmMarker[];
  style?: StyleProp<ViewStyle>;
}

const PIN_SVG = (color: string) =>
  `<svg width="36" height="36" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;

function buildHtml(
  lat: number,
  lng: number,
  zoom: number,
  interactive: boolean,
  markers: OsmMarker[],
): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#e8eef2}
  #pin{position:absolute;top:50%;left:50%;margin-top:-34px;margin-left:-18px;z-index:1200;pointer-events:none}
  #pin svg{filter:drop-shadow(0 3px 3px rgba(0,0,0,.35))}
  .leaflet-control-attribution{font-size:9px}
</style></head><body>
<div id="map"></div>
${interactive ? `<div id="pin">${PIN_SVG('#10b981')}</div>` : ''}
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var INTERACTIVE=${interactive ? 'true' : 'false'};
  var skip=false, markerLayer=[];
  function post(o){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); } }
  var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${lat},${lng}],${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  map.whenReady(function(){ post({type:'ready'}); });
  if(INTERACTIVE){
    map.on('moveend',function(){
      if(skip){ skip=false; return; }
      var c=map.getCenter(); post({type:'moveend',lat:c.lat,lng:c.lng});
    });
    // Tap anywhere to drop/move the pin there. Recenters the map under the
    // fixed centre pin and emits the new coordinate (FEAT-07).
    map.on('click',function(e){
      map.setView(e.latlng, map.getZoom());
      post({type:'moveend',lat:e.latlng.lat,lng:e.latlng.lng});
    });
  }
  function pinIcon(color){ return L.divIcon({className:'',html:'${PIN_SVG('COLORTOKEN').replace(/'/g, "\\'")}'.replace('COLORTOKEN',color||'#10b981'),iconSize:[36,36],iconAnchor:[18,36]}); }
  function setMarkers(list){
    markerLayer.forEach(function(m){ map.removeLayer(m); }); markerLayer=[];
    (list||[]).forEach(function(it){ markerLayer.push(L.marker([it.lat,it.lng],{icon:pinIcon(it.color)}).addTo(map)); });
  }
  function recenter(la,ln,z){ skip=true; map.setView([la,ln], z||map.getZoom()); }
  function fitToMarkers(){
    if(markerLayer.length===0) return;
    if(markerLayer.length===1){ skip=true; map.setView(markerLayer[0].getLatLng(), 15); return; }
    var g=L.featureGroup(markerLayer); skip=true; map.fitBounds(g.getBounds().pad(0.3));
  }
  setMarkers(${JSON.stringify(markers)});
</script></body></html>`;
}

const OsmMap = forwardRef<OsmMapHandle, OsmMapProps>(function OsmMap(
  { latitude, longitude, zoom = 15, interactive = false, onMoveEnd, onReady, markers = [], style },
  ref,
) {
  const webRef = useRef<any>(null);

  // Build the HTML once. Programmatic changes go through injectJavaScript so
  // the WebView never reloads (which would reset the user's pan/zoom).
  const html = useMemo(
    () => buildHtml(latitude, longitude, zoom, interactive, markers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      recenter: (lat, lng, z) => {
        webRef.current?.injectJavaScript(`recenter(${lat},${lng}${z ? `,${z}` : ''});true;`);
      },
      fitToMarkers: () => {
        webRef.current?.injectJavaScript(`fitToMarkers();true;`);
      },
    }),
    [],
  );

  const markersKey = JSON.stringify(markers);
  useEffect(() => {
    webRef.current?.injectJavaScript(`setMarkers(${markersKey});true;`);
  }, [markersKey]);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'ready') onReady?.();
      else if (d.type === 'moveend' && onMoveEnd) onMoveEnd(d.lat, d.lng);
    } catch {
      // ignore malformed messages
    }
  };

  // Native module missing (binary predates react-native-webview). Render a
  // graceful placeholder instead of crashing the whole screen.
  if (!WebView) {
    return (
      <View style={[styles.container, styles.fallback, style]}>
        <Text style={styles.fallbackText}>
          الخريطة غير متاحة في هذا الإصدار{'\n'}Map unavailable in this build
        </Text>
        <Text style={styles.fallbackHint}>
          أعد بناء التطبيق لتفعيل الخريطة · Rebuild the app to enable the map
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scrollEnabled={false}
        bounces={false}
        androidLayerType="hardware"
        style={styles.webview}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8eef2',
    padding: 16,
  },
  fallbackText: { color: '#334155', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  fallbackHint: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 8 },
});

export default OsmMap;
