import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { checkinApi, eventsApi, Event, CheckInStatsResult } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Hourly bar chart ─────────────────────────────────────────────────────────
function HourlyChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <View style={styles.chartWrap}>
      {data.map((v, i) => {
        const pct = v / max;
        const isLast = i === data.length - 1;
        return (
          <View key={i} style={styles.chartCol}>
            <View style={styles.chartBarWrap}>
              <View style={[
                styles.chartBar,
                { height: `${Math.max(pct * 100, 4)}%` as any },
                isLast && styles.chartBarActive,
              ]} />
            </View>
            <Text style={styles.chartLabel}>{8 + i}h</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ScanStatsScreen() {
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId: string }>();

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    eventIdParam ? parseInt(eventIdParam) : null
  );
  const [stats, setStats] = useState<CheckInStatsResult | null>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [eventPickerVisible, setEventPickerVisible] = useState(false);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Load organizer's events
  useEffect(() => {
    eventsApi.myEvents()
      .then(res => {
        const raw = res.data as any;
        const all: Event[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
        const published = all.filter(e => e.status === 'published');
        setEvents(published);
        if (!selectedEventId && published.length > 0) {
          setSelectedEventId(published[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  }, []);

  // Load stats when event changes
  useEffect(() => {
    if (!selectedEventId) return;
    setLoadingStats(true);
    Promise.all([
      checkinApi.stats(selectedEventId),
      checkinApi.listCheckins(selectedEventId, { limit: 10 }),
    ]).then(([statsRes, checkinsRes]) => {
      setStats(statsRes.data);
      setCheckins(Array.isArray(checkinsRes.data) ? checkinsRes.data : checkinsRes.data?.items ?? []);
    }).catch(() => {
      setStats(null);
    }).finally(() => setLoadingStats(false));
  }, [selectedEventId]);

  // Mock hourly data for chart — real data would need a backend aggregation endpoint
  const hourlyData = [4, 8, 22, 38, 52, 64, 71, stats?.total_checked_in ?? 74];
  const attendanceRate = stats ? Math.round(stats.attendance_rate) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check-in stats</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Event selector */}
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
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* Event picker */}
      {eventPickerVisible && events.length > 0 && (
        <View style={styles.eventPicker}>
          {events.map(e => (
            <TouchableOpacity
              key={e.id}
              style={[styles.eventPickerItem, selectedEventId === e.id && styles.eventPickerItemActive]}
              onPress={() => {
                setSelectedEventId(e.id);
                setEventPickerVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.eventPickerText} numberOfLines={1}>{e.title}</Text>
              {selectedEventId === e.id && <Ionicons name="checkmark" size={14} color={Colors.text} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loadingStats ? (
        <ActivityIndicator color={Colors.text} style={{ marginTop: 40 }} />
      ) : !stats ? (
        <View style={styles.empty}>
          <Ionicons name="analytics-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No check-in data yet</Text>
          <Text style={styles.emptyText}>Stats will appear once attendees start checking in.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Event info */}
          {selectedEvent && (
            <View style={styles.eventInfo}>
              <Text style={styles.eventInfoTitle}>{selectedEvent.title}</Text>
              <Text style={styles.eventInfoDate}>
                {new Date(selectedEvent.start_datetime).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                })}
              </Text>
            </View>
          )}

          {/* Main stat */}
          <View style={styles.mainStat}>
            <Text style={styles.mainStatLabel}>CHECKED IN</Text>
            <View style={styles.mainStatValue}>
              <Text style={styles.mainStatNum}>{stats.total_checked_in}</Text>
              <Text style={styles.mainStatTotal}>/{stats.total_registered}</Text>
            </View>
            <View style={styles.mainProgressBar}>
              <View style={[styles.mainProgressFill, { width: `${Math.min(attendanceRate, 100)}%` as any }]} />
            </View>
            <Text style={styles.mainStatSub}>{attendanceRate}% of expected attendance</Text>
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statTile}>
              <Text style={styles.statTileLabel}>TOTAL REGISTERED</Text>
              <Text style={styles.statTileValue}>{stats.total_registered}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statTileLabel}>CHECKED IN</Text>
              <Text style={styles.statTileValue}>{stats.total_checked_in}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statTileLabel}>REMAINING</Text>
              <Text style={styles.statTileValue}>{stats.remaining}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statTileLabel}>ATTENDANCE</Text>
              <Text style={styles.statTileValue}>{attendanceRate}%</Text>
            </View>
          </View>

          {/* Hourly chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hourly check-ins</Text>
            <Text style={styles.cardSub}>Since 8:00 AM today</Text>
            <HourlyChart data={hourlyData} />
          </View>

          {/* Recent check-ins */}
          {checkins.length > 0 && (
            <View style={styles.recentWrap}>
              <Text style={styles.recentTitle}>Recent check-ins</Text>
              {checkins.map((c, i) => (
                <View
                  key={c.id}
                  style={[styles.recentItem, i < checkins.length - 1 && styles.recentItemBorder]}
                >
                  <View style={styles.recentAvatar}>
                    <Text style={styles.recentAvatarText}>
                      {String(c.registration_id).slice(-2)}
                    </Text>
                  </View>
                  <View style={styles.recentText}>
                    <Text style={styles.recentName}>Registration #{c.registration_id}</Text>
                    <Text style={styles.recentSub}>
                      {c.is_manual ? 'Manual check-in' : 'QR scan'}
                    </Text>
                  </View>
                  <Text style={styles.recentTime}>
                    {new Date(c.checked_in_at).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },

  // Event selector
  eventSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    margin: Spacing.base, padding: 14,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  eventSelectorText: { flex: 1 },
  eventSelectorLabel: { fontSize: 10.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  eventSelectorName: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text, marginTop: 2 },

  // Event picker
  eventPicker: {
    marginHorizontal: Spacing.base, marginTop: -8,
    backgroundColor: Colors.cardElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, overflow: 'hidden',
    marginBottom: 8,
  },
  eventPickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 13, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  eventPickerItemActive: { backgroundColor: 'rgba(255,255,255,0.05)' },
  eventPickerText: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.text, flex: 1 },

  scroll: { paddingBottom: 32 },

  // Event info
  eventInfo: { paddingHorizontal: Spacing.base, paddingBottom: 14 },
  eventInfoTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },
  eventInfoDate: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 3 },

  // Main stat
  mainStat: {
    marginHorizontal: Spacing.base, marginBottom: 12,
    padding: 20,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  mainStatLabel: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  mainStatValue: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6, marginBottom: 14 },
  mainStatNum: { fontSize: 44, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -1 },
  mainStatTotal: { fontSize: 22, fontFamily: FontFamily.regular, color: Colors.textSub, marginBottom: 6 },
  mainProgressBar: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  mainProgressFill: { height: '100%', backgroundColor: Colors.text, borderRadius: 2 },
  mainStatSub: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 8 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: Spacing.base, marginBottom: 12,
  },
  statTile: {
    width: '47.5%', padding: 14,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  statTileLabel: { fontSize: 10, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  statTileValue: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5, marginTop: 6 },

  // Chart
  card: {
    marginHorizontal: Spacing.base, marginBottom: 12,
    padding: 16,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  cardTitle: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text },
  cardSub: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginBottom: 14 },
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  chartBarWrap: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 3 },
  chartBarActive: { backgroundColor: Colors.text },
  chartLabel: { fontSize: 9.5, fontFamily: FontFamily.regular, color: Colors.textMuted },

  // Recent
  recentWrap: { paddingHorizontal: Spacing.base },
  recentTitle: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text, marginBottom: 12 },
  recentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  recentItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  recentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  recentAvatarText: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.text },
  recentText: { flex: 1 },
  recentName: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.text },
  recentSub: { fontSize: 11.5, fontFamily: FontFamily.regular, color: Colors.textMuted },
  recentTime: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textSub },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: FontSize.md, fontFamily: FontFamily.semiBold, color: Colors.text },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted, textAlign: 'center' },
});