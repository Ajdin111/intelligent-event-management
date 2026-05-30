import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { checkinApi, eventsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
type ScanState = 'scanning' | 'loading' | 'success' | 'denied' | 'error';

interface ScanResult {
  attendeeName?: string;
  ticketTier?: string;
  eventTitle?: string;
  message?: string;
}

// ─── Corner reticle ───────────────────────────────────────────────────────────
function Reticle({ state }: { state: ScanState }) {
  const color = state === 'success'
    ? Colors.success
    : state === 'denied' || state === 'error'
    ? Colors.error
    : '#ffffff';

  const corners = [
    { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
    { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
    { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
    { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
  ];

  return (
    <View style={styles.reticle}>
      {/* Outer dim border */}
      <View style={[styles.reticleBorder, { borderColor: 'rgba(255,255,255,0.12)' }]} />
      {/* Corner brackets */}
      {corners.map((style, i) => (
        <View
          key={i}
          style={[styles.corner, style, { borderColor: color }]}
        />
      ))}
    </View>
  );
}

// ─── Scan line animation ──────────────────────────────────────────────────────
function ScanLine() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, RETICLE_SIZE - 2],
  });

  return (
    <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
  );
}

// ─── Result overlay ───────────────────────────────────────────────────────────
function ResultOverlay({
  state,
  result,
  onDismiss,
}: {
  state: ScanState;
  result: ScanResult;
  onDismiss: () => void;
}) {
  const isSuccess = state === 'success';

  return (
    <View style={styles.overlay}>
      <View style={[styles.overlayIcon, { backgroundColor: isSuccess ? '#ffffff' : Colors.error }]}>
        <Ionicons
          name={isSuccess ? 'checkmark' : 'close'}
          size={36}
          color={isSuccess ? '#000000' : '#ffffff'}
        />
      </View>
      <Text style={styles.overlayTitle}>
        {isSuccess
          ? result.attendeeName ? `Welcome, ${result.attendeeName}` : 'Check-in successful'
          : state === 'denied'
          ? 'Already checked in'
          : 'Check-in failed'}
      </Text>
      {result.ticketTier && (
        <Text style={styles.overlaySub}>{result.ticketTier}</Text>
      )}
      {result.message && (
        <Text style={styles.overlaySub}>{result.message}</Text>
      )}
      <TouchableOpacity
        style={styles.overlayBtn}
        onPress={onDismiss}
        activeOpacity={0.85}
      >
        <Text style={styles.overlayBtnText}>Scan next</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [result, setResult] = useState<ScanResult>({});
  const [torch, setTorch] = useState(false);
  const [checkinCount, setCheckinCount] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventPickerVisible, setEventPickerVisible] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const lastScanned = useRef<string | null>(null);
  const scanCooldown = useRef(false);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Load organizer's events on mount
  useEffect(() => {
    eventsApi.myEvents()
      .then(res => {
        const raw = res.data as any;
        const all: Event[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
        const published = all.filter(e => e.status === 'published');
        setEvents(published);
        if (published.length > 0) setSelectedEventId(published[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    // Prevent duplicate scans
    if (scanCooldown.current || scanState !== 'scanning') return;
    if (data === lastScanned.current) return;

    lastScanned.current = data;
    scanCooldown.current = true;
    setScanState('loading');

    if (!selectedEventId) {
      setResult({ message: 'Please select an event first.' });
      setScanState('error');
      return;
    }

    try {
      await checkinApi.scanQR(data, selectedEventId);
      setCheckinCount(c => c + 1);
      setResult({
        eventTitle: selectedEvent?.title,
      });
      setScanState('success');
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail ?? '';

      if (status === 409 || detail.toLowerCase().includes('already')) {
        setResult({ message: 'This ticket was already used.' });
        setScanState('denied');
      } else if (status === 404) {
        setResult({ message: 'Ticket not found or invalid.' });
        setScanState('error');
      } else if (status === 400) {
        setResult({ message: typeof detail === 'string' ? detail : 'Invalid QR code.' });
        setScanState('error');
      } else {
        setResult({ message: 'Could not connect. Check your connection.' });
        setScanState('error');
      }
    }
  };

  const handleDismiss = () => {
    lastScanned.current = null;
    setResult({});
    setScanState('scanning');
    setTimeout(() => { scanCooldown.current = false; }, 300);
  };

  // ─── Permission states ────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.permissionScreen}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.4)" />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionSub}>
          TeqEvent needs camera access to scan attendee QR codes.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permissionBtnText}>Grant access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />

      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanState === 'scanning' ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark vignette overlay */}
      <View style={styles.vignette} pointerEvents="none" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Check-in scanner</Text>
        <TouchableOpacity
          style={[styles.topBtn, torch && styles.topBtnActive]}
          onPress={() => setTorch(t => !t)}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Center — reticle */}
      <View style={styles.center} pointerEvents="none">
        <View style={styles.reticleContainer}>
          <Reticle state={scanState} />
          {scanState === 'scanning' && <ScanLine />}
        </View>
        {scanState === 'loading' && (
          <ActivityIndicator color="#ffffff" style={{ marginTop: 24 }} />
        )}
        <Text style={styles.hint}>
          {scanState === 'scanning'
            ? "Align the attendee's QR code within the frame"
            : ''}
        </Text>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Event selector */}
        <TouchableOpacity
          style={styles.eventSelector}
          onPress={() => setEventPickerVisible(v => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.eventSelectorText}>
            <Text style={styles.eventSelectorLabel}>EVENT</Text>
            <Text style={styles.eventSelectorName} numberOfLines={1}>
              {loadingEvents
                ? 'Loading…'
                : selectedEvent?.title ?? 'Select event'}
            </Text>
          </View>
          <View style={styles.countWrap}>
            <Text style={styles.countNum}>{checkinCount}</Text>
            <Text style={styles.countLabel}>checked in</Text>
          </View>
          <TouchableOpacity
            style={styles.statsBtn}
            onPress={() => router.push('/(organizer)/scan-stats' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.statsBtnText}>Stats</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Event picker dropdown */}
        {eventPickerVisible && events.length > 0 && (
          <View style={styles.eventPicker}>
            {events.map(e => (
              <TouchableOpacity
                key={e.id}
                style={[styles.eventPickerItem, selectedEventId === e.id && styles.eventPickerItemActive]}
                onPress={() => {
                  setSelectedEventId(e.id);
                  setCheckinCount(0);
                  setEventPickerVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.eventPickerItemText} numberOfLines={1}>{e.title}</Text>
                {selectedEventId === e.id && (
                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Result overlay */}
      {(scanState === 'success' || scanState === 'denied' || scanState === 'error') && (
        <ResultOverlay
          state={scanState}
          result={result}
          onDismiss={handleDismiss}
        />
      )}
    </View>
  );
}

const RETICLE_SIZE = 240;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },

  // Permission
  permissionScreen: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  permissionTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: '#ffffff', marginTop: 8 },
  permissionSub: {
    fontSize: 13.5, fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20,
  },
  permissionBtn: {
    marginTop: 8, height: 46, paddingHorizontal: 28,
    borderRadius: Radius.md, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  permissionBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: '#000' },

  // Vignette
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    shadowColor: '#000',
  },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  topBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  topTitle: { fontSize: 14, fontFamily: FontFamily.semiBold, color: '#ffffff' },

  // Center
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  reticle: {
    width: RETICLE_SIZE, height: RETICLE_SIZE,
    position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  reticleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2, borderRadius: 24,
  },
  corner: {
    position: 'absolute',
    width: 36, height: 36,
  },
  reticleContainer: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: 'transparent',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
  },
  hint: {
    marginTop: 28, fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', maxWidth: 280,
    fontFamily: FontFamily.regular,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 14, paddingBottom: 32,
  },
  eventSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  eventSelectorText: { flex: 1 },
  eventSelectorLabel: {
    fontSize: 10.5, fontFamily: FontFamily.semiBold,
    color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5,
  },
  eventSelectorName: {
    fontSize: 14, fontFamily: FontFamily.bold,
    color: '#ffffff', marginTop: 2,
  },
  countWrap: { alignItems: 'center' },
  countNum: { fontSize: 20, fontFamily: FontFamily.bold, color: '#ffffff' },
  countLabel: { fontSize: 10, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.45)' },
  statsBtn: {
    height: 36, paddingHorizontal: 14,
    borderRadius: Radius.sm,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  statsBtnText: { fontSize: 12, fontFamily: FontFamily.semiBold, color: '#000000' },

  // Event picker
  eventPicker: {
    marginTop: 8,
    backgroundColor: 'rgba(30,35,38,0.95)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  eventPickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  eventPickerItemActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  eventPickerItemText: { fontSize: 13.5, fontFamily: FontFamily.medium, color: '#ffffff', flex: 1 },

  // Result overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
    padding: 32,
  },
  overlayIcon: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
  },
  overlayTitle: {
    fontSize: 22, fontFamily: FontFamily.bold,
    color: '#ffffff', marginBottom: 8, textAlign: 'center',
  },
  overlaySub: {
    fontSize: 13.5, fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center', marginBottom: 4,
  },
  overlayBtn: {
    marginTop: 28, height: 48, paddingHorizontal: 36,
    borderRadius: Radius.md, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  overlayBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: '#000000' },
});
