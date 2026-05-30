import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { eventsApi, registrationsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Sparkline chart ──────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  const W = 280;
  const H = 80;
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const stepX = W / (data.length - 1);
  const coords = data.map((v, i) => [
    i * stepX,
    H - (v / max) * (H - 10) - 5,
  ]);
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${W},${H} L0,${H} Z`;
  const last = coords[coords.length - 1];

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
          <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#sparkfill)" />
      <Path d={path} fill="none" stroke="#fff" strokeWidth="1.5" />
      <Circle cx={last[0]} cy={last[1]} r="3.5" fill="#fff" />
    </Svg>
  );
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function KpiTile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiDelta}>{delta}</Text>
    </View>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────
function EventRow({ event, registrationCount }: { event: Event; registrationCount: number }) {
  const progress = event.capacity ? registrationCount / event.capacity : 0;
  const startDate = new Date(event.start_datetime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <TouchableOpacity
      style={styles.eventRow}
      onPress={() => router.push(`/(organizer)/events` as any)}
      activeOpacity={0.8}
    >
      <View style={styles.eventRowTop}>
        <Text style={styles.eventRowTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{event.status}</Text>
        </View>
      </View>
      <View style={styles.eventRowMeta}>
        <View style={styles.eventRowMetaItem}>
          <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
          <Text style={styles.eventRowMetaText}>{startDate}</Text>
        </View>
        <View style={styles.eventRowMetaItem}>
          <Ionicons name="people-outline" size={11} color={Colors.textMuted} />
          <Text style={styles.eventRowMetaText}>
            {registrationCount}{event.capacity ? `/${event.capacity}` : ''}
          </Text>
        </View>
      </View>
      {event.capacity ? (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Activity Item ────────────────────────────────────────────────────────────
function ActivityItem({ title, detail, time, last }: {
  title: string; detail: string; time: string; last: boolean;
}) {
  return (
    <View style={[styles.activityItem, !last && styles.activityItemBorder]}>
      <View style={styles.activityDot} />
      <View style={styles.activityText}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityDetail}>{detail}</Text>
      </View>
      <Text style={styles.activityTime}>{time}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OrganizerHomeScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [regCounts, setRegCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [sparkData] = useState([12, 18, 14, 22, 28, 24, 32, 38, 34, 42, 48, 44, 52, 58, 56, 64, 70, 66, 74, 82, 78, 86, 92, 88, 96, 104, 100, 110, 118, 124]);
  const [period, setPeriod] = useState<'7D' | '30D' | '90D'>('30D');

  useEffect(() => {
    eventsApi.myEvents()
      .then(async res => {
        const raw = res.data as any;
        const all: Event[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
        setEvents(all);

        // Fetch registration counts for each event
        const counts: Record<number, number> = {};
        await Promise.all(
          all.map(e =>
            registrationsApi.eventRegistrations(e.id, { limit: 1 })
              .then((r: any) => { counts[e.id] = r.data?.total ?? 0; })
              .catch(() => { counts[e.id] = 0; })
          )
        );
        setRegCounts(counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const publishedEvents = events.filter(e => e.status === 'published');
  const totalRegistrations = Object.values(regCounts).reduce((s, c) => s + c, 0);
  const firstName = user?.first_name ?? 'there';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Organizer</Text>
            <Text style={styles.headerSub}>Welcome back, {firstName}</Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => {}}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color={Colors.bg} />
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        </View>

        {/* KPI tiles */}
        {loading ? (
          <ActivityIndicator color={Colors.text} style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.kpiGrid}>
            <KpiTile
              label="ACTIVE EVENTS"
              value={String(publishedEvents.length)}
              delta={`${events.length} total`}
            />
            <KpiTile
              label="REGISTRATIONS"
              value={totalRegistrations.toLocaleString()}
              delta="All time"
            />
            <KpiTile
              label="REVENUE (MTD)"
              value="—"
              delta="Analytics tab"
            />
            <KpiTile
              label="AVG. RATING"
              value="—"
              delta="Analytics tab"
            />
          </View>
        )}

        {/* Registrations sparkline */}
        <View style={styles.sparkCard}>
          <View style={styles.sparkHeader}>
            <View>
              <Text style={styles.sparkTitle}>Registrations</Text>
              <Text style={styles.sparkSub}>Last {period === '7D' ? '7' : period === '30D' ? '30' : '90'} days</Text>
            </View>
            <View style={styles.periodPicker}>
              {(['7D', '30D', '90D'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Sparkline data={sparkData} />
        </View>

        {/* Active events */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active events</Text>
          <TouchableOpacity onPress={() => router.push('/(organizer)/events' as any)} activeOpacity={0.7}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.eventsList}>
          {publishedEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No published events yet</Text>
            </View>
          ) : (
            publishedEvents.slice(0, 3).map(e => (
              <EventRow key={e.id} event={e} registrationCount={regCounts[e.id] ?? 0} />
            ))
          )}
        </View>

        {/* Recent activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>

        <View style={styles.activityList}>
          {[
            ['New registration', 'Someone registered for your event', '2m ago'],
            ['Review posted', '★★★★★ on your latest event', '14m ago'],
            ['Capacity 90%', 'One of your events is filling up', '1h ago'],
          ].map(([t, d, w], i) => (
            <ActivityItem key={i} title={t} detail={d} time={w} last={i === 2} />
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md, paddingBottom: 18,
  },
  headerTitle: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 3 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 38, paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  createBtnText: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.bg },

  // KPI
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: Spacing.base, marginBottom: 14,
  },
  kpiTile: {
    width: '47.5%',
    padding: 14,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  kpiLabel: { fontSize: 10, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.4, marginTop: 6 },
  kpiDelta: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },

  // Sparkline
  sparkCard: {
    marginHorizontal: Spacing.base, marginBottom: 14,
    padding: 16,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  sparkHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sparkTitle: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text },
  sparkSub: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },
  periodPicker: { flexDirection: 'row', gap: 2 },
  periodBtn: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  periodBtnActive: { backgroundColor: Colors.accent },
  periodBtnText: { fontSize: 10.5, fontFamily: FontFamily.semiBold, color: Colors.textSub },
  periodBtnTextActive: { color: Colors.bg },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text },
  sectionAction: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub },

  // Events list
  eventsList: { paddingHorizontal: Spacing.base, gap: 10 },
  eventRow: {
    padding: 14,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  eventRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  eventRowTitle: { flex: 1, fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text, marginRight: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.borderMed, borderRadius: 5 },
  statusBadgeText: { fontSize: 10.5, fontFamily: FontFamily.medium, color: Colors.textSub, textTransform: 'capitalize' },
  eventRowMeta: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  eventRowMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eventRowMetaText: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.text, borderRadius: 2 },

  // Activity
  activityList: { paddingHorizontal: Spacing.base },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  activityItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textSub, marginTop: 7 },
  activityText: { flex: 1 },
  activityTitle: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.text },
  activityDetail: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 2 },
  activityTime: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },

  // Empty
  emptyState: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted },
});
