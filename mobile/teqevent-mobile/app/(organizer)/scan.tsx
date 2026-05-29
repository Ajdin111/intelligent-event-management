import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  AppState,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { checkinApi, eventsApi, Event, OfflineCheckInItem } from '@/services/api';
import { Colors, FontFamily, Radius } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────
const OFFLINE_QUEUE_KEY = 'teqevent_checkin_queue';

// ─── Types ───────────────────────────────────────────────────────────────────
type ScanState = 'scanning' | 'loading' | 'success' | 'denied' | 'error';
type ConnState = 'online' | 'offline' | 'syncing';

interface ScanResult {
  attendeeName?: string;
  ticketTier?: string;
  eventTitle?: string;
  message?: string;
  wasOffline?: boolean;
}

// ─── Offline queue helpers ────────────────────────────────────────────────────
async function loadQueue(): Promise<OfflineCheckInItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: OfflineCheckInItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

async function addToQueue(item: OfflineCheckInItem): Promise<void> {
  const queue = await loadQueue();
  queue.push(item);
  await saveQueue(queue);
}

async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
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
      <View style={[styles.reticleBorder, { borderColor: 'rgba(255,255,255,0.12)' }]} />
      {corners.map((style, i) => (
        <View key={i} style={[styles.corner, style, { borderColor: color }]} />
      ))}
    </View>
  );
}

// ─── Scan line ────────────────────────────────────────────────────────────────
function ScanLine() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, RETICLE_SIZE - 2] });

  return <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />;
}

// ─── Result overlay ───────────────────────────────────────────────────────────
function ResultOverlay({
  state, result, onDismiss,
}: {
  state: ScanState; result: ScanResult; onDismiss: () => void;
}) {
  const isSuccess = state === 'success';

  return (
    <View style={styles.overlay}>
      <View style={[styles.overlayIcon, { backgroundColor: isSuccess ? '#ffffff' : Colors.error }]}>
        <Ionicons name={isSuccess ? 'checkmark' : 'close'} size={36} color={isSuccess ? '#000000' : '#ffffff'} />
      </View>
      <Text style={styles.overlayTitle}>
        {isSuccess
          ? result.attendeeName ? `Welcome, ${result.attendeeName}` : 'Check-in successful'
          : state === 'denied' ? 'Already checked in' : 'Check-in failed'}
      </Text>
      {result.wasOffline && (
        <View style={styles.offlineBadge}>
          <Ionicons name="cloud-offline-outline" size={12} color={Colors.warning} />
          <Text style={styles.offlineBadgeText}>Saved offline — will sync when connected</Text>
        </View>
      )}
      {result.message && <Text style={styles.overlaySub}>{result.message}</Text>}
      <TouchableOpacity style={styles.overlayBtn} onPress={onDismiss} activeOpacity={0.85}>
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
  const [offlineCount, setOfflineCount] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventPickerVisible, setEventPickerVisible] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [connState, setConnState] = useState<ConnState>('online');
  const [syncMessage, setSyncMessage] = useState('');

  const lastScanned = useRef<string | null>(null);
  const scanCooldown = useRef(false);
  const isOnline = useRef(true);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // ─── Load events ──────────────────────────────────────────
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

  // ─── Load offline queue count on mount ────────────────────
  useEffect(() => {
    loadQueue().then(q => setOfflineCount(q.length));
  }, []);

  // ─── Fetch real initial network state ─────────────────────
  useEffect(() => {
    NetInfo.fetch().then(state => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      isOnline.current = online;
      if (!online) setConnState('offline');
    });
  }, []);

  // ─── Cleanup sync banner timer on unmount ─────────────────
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // ─── Sync offline queue ───────────────────────────────────
  const syncQueue = useCallback(async () => {
    const queue = await loadQueue();
    if (queue.length === 0) return;

    setConnState('syncing');
    setSyncMessage(`Syncing ${queue.length} offline scan${queue.length > 1 ? 's' : ''}…`);

    try {
      await checkinApi.syncOffline(queue);
      await clearQueue();
      setOfflineCount(0);
      setSyncMessage(`✓ ${queue.length} scan${queue.length > 1 ? 's' : ''} synced`);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => setSyncMessage(''), 3000);
    } catch {
      setSyncMessage('Sync failed — will retry on next connection');
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => setSyncMessage(''), 4000);
    } finally {
      setConnState('online');
    }
  }, []);

  // ─── Network monitoring ───────────────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable !== false;
      const wasOffline = !isOnline.current;
      isOnline.current = !!online;

      if (online) {
        setConnState('online');
        if (wasOffline) {
          // Just came back online — sync queue
          syncQueue();
        }
      } else {
        setConnState('offline');
      }
    });

    return () => unsubscribe();
  }, [syncQueue]);

  // ─── Sync when app comes to foreground ────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && isOnline.current) {
        syncQueue();
      }
    });
    return () => sub.remove();
  }, [syncQueue]);

  // ─── Handle scan ──────────────────────────────────────────
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
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

    // ─── Offline path ──────────────────────────────────────
    if (!isOnline.current) {
      await addToQueue({
        qr_code: data,
        event_id: selectedEventId,
        scanned_at: new Date().toISOString(),
      });
      const newCount = (await loadQueue()).length;
      setOfflineCount(newCount);
      setCheckinCount(c => c + 1);
      setResult({
        eventTitle: selectedEvent?.title,
        wasOffline: true,
      });
      setScanState('success');
      return;
    }

    // ─── Online path ───────────────────────────────────────
    try {
      await checkinApi.scanQR(data, selectedEventId);
      setCheckinCount(c => c + 1);
      setResult({ eventTitle: selectedEvent?.title });
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
        // Network error — fall back to offline queue
        await addToQueue({
          qr_code: data,
          event_id: selectedEventId,
          scanned_at: new Date().toISOString(),
        });
        const newCount = (await loadQueue()).length;
        setOfflineCount(newCount);
        setCheckinCount(c => c + 1);
        setResult({ eventTitle: selectedEvent?.title, wasOffline: true });
        setScanState('success');
      }
    }
  };

  const handleDismiss = () => {
    lastScanned.current = null;
    setResult({});
    setScanState('scanning');
    setTimeout(() => { scanCooldown.current = false; }, 300);
  };

  // ─── Permission screens ───────────────────────────────────
  if (!permission) {
    return <View style={styles.permissionScreen}><ActivityIndicator color="#ffffff" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.4)" />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionSub}>TeqEvent needs camera access to scan attendee QR codes.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permissionBtnText}>Grant access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />

      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanState === 'scanning' ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      <View style={styles.vignette} pointerEvents="none" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color="#ffffff" />
        </TouchableOpacity>

        {/* Connection status */}
        <View style={[
          styles.connBadge,
          connState === 'offline' && styles.connBadgeOffline,
          connState === 'syncing' && styles.connBadgeSyncing,
        ]}>
          <Ionicons
            name={connState === 'offline' ? 'cloud-offline-outline' : connState === 'syncing' ? 'sync-outline' : 'cloud-done-outline'}
            size={12}
            color="#ffffff"
          />
          <Text style={styles.connBadgeText}>
            {connState === 'offline'
              ? offlineCount > 0 ? `Offline · ${offlineCount} queued` : 'Offline'
              : connState === 'syncing' ? 'Syncing…' : 'Online'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.topBtn, torch && styles.topBtnActive]}
          onPress={() => setTorch(t => !t)}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Sync message banner */}
      {syncMessage !== '' && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>{syncMessage}</Text>
        </View>
      )}

      {/* Center reticle */}
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
            ? connState === 'offline'
              ? 'Offline mode — scans will sync when connected'
              : "Align the attendee's QR code within the frame"
            : ''}
        </Text>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.eventSelector}
          onPress={() => setEventPickerVisible(v => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.eventSelectorText}>
            <Text style={styles.eventSelectorLabel}>EVENT</Text>
            <Text style={styles.eventSelectorName} numberOfLines={1}>
              {loadingEvents ? 'Loading…' : selectedEvent?.title ?? 'Select event'}
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
                {selectedEventId === e.id && <Ionicons name="checkmark" size={14} color="#ffffff" />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Result overlay */}
      {(scanState === 'success' || scanState === 'denied' || scanState === 'error') && (
        <ResultOverlay state={scanState} result={result} onDismiss={handleDismiss} />
      )}
    </View>
  );
}

const RETICLE_SIZE = 240;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },

  permissionScreen: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  permissionTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: '#ffffff', marginTop: 8 },
  permissionSub: { fontSize: 13.5, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
  permissionBtn: { marginTop: 8, height: 46, paddingHorizontal: 28, borderRadius: Radius.md, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  permissionBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: '#000' },

  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
  },
  topBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  topBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },

  // Connection badge
  connBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(74,222,128,0.25)',
  },
  connBadgeOffline: { backgroundColor: 'rgba(251,191,36,0.25)' },
  connBadgeSyncing: { backgroundColor: 'rgba(96,165,250,0.25)' },
  connBadgeText: { fontSize: 11, fontFamily: FontFamily.semiBold, color: '#ffffff' },

  // Sync banner
  syncBanner: {
    position: 'absolute', top: 110, left: 16, right: 16,
    backgroundColor: 'rgba(96,165,250,0.2)',
    borderRadius: Radius.md, padding: 10,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)',
    alignItems: 'center',
  },
  syncBannerText: { fontSize: 12.5, fontFamily: FontFamily.medium, color: '#ffffff' },

  // Center
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticleContainer: { width: RETICLE_SIZE, height: RETICLE_SIZE },
  reticle: { width: RETICLE_SIZE, height: RETICLE_SIZE, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  reticleBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderRadius: 24 },
  corner: { position: 'absolute', width: 36, height: 36 },
  scanLine: {
    position: 'absolute', top: 0, left: 16, right: 16, height: 2,
    backgroundColor: 'transparent',
    shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6,
    borderTopWidth: 1.5, borderTopColor: 'rgba(255,255,255,0.8)',
  },
  hint: { marginTop: 28, fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 280, fontFamily: FontFamily.regular },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, paddingBottom: 32 },
  eventSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  eventSelectorText: { flex: 1 },
  eventSelectorLabel: { fontSize: 10.5, fontFamily: FontFamily.semiBold, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  eventSelectorName: { fontSize: 14, fontFamily: FontFamily.bold, color: '#ffffff', marginTop: 2 },
  countWrap: { alignItems: 'center' },
  countNum: { fontSize: 20, fontFamily: FontFamily.bold, color: '#ffffff' },
  countLabel: { fontSize: 10, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.45)' },
  statsBtn: { height: 36, paddingHorizontal: 14, borderRadius: Radius.sm, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  statsBtnText: { fontSize: 12, fontFamily: FontFamily.semiBold, color: '#000000' },

  eventPicker: { marginTop: 8, backgroundColor: 'rgba(30,35,38,0.95)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  eventPickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  eventPickerItemActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  eventPickerItemText: { fontSize: 13.5, fontFamily: FontFamily.medium, color: '#ffffff', flex: 1 },

  // Result overlay
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  overlayIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  overlayTitle: { fontSize: 22, fontFamily: FontFamily.bold, color: '#ffffff', marginBottom: 8, textAlign: 'center' },
  overlaySub: { fontSize: 13.5, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 4 },
  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)', marginBottom: 8,
  },
  offlineBadgeText: { fontSize: 11.5, fontFamily: FontFamily.medium, color: Colors.warning },
  overlayBtn: { marginTop: 28, height: 48, paddingHorizontal: 36, borderRadius: Radius.md, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  overlayBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: '#000000' },
});