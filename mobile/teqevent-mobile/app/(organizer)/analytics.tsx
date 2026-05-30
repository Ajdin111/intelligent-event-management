import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { eventsApi, registrationsApi, reviewsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  const W = 280; const H = 80;
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const stepX = W / (data.length - 1);
  const coords = data.map((v, i) => [i * stepX, H - (v / max) * (H - 10) - 5]);
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${W},${H} L0,${H} Z`;
  const last = coords[coords.length - 1];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="fill2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
          <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#fill2)" />
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

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRegistrations, setTotalRegistrations] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);
  const [eventRegCounts, setEventRegCounts] = useState<{ event: Event; count: number }[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await eventsApi.myEvents();
        const raw = res.data as any;
        const all: Event[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
        setEvents(all);

        // Fetch registrations for each event
        let totalRegs = 0;
        let totalRev = 0;
        const regCounts: { event: Event; count: number }[] = [];
        const allRegs: any[] = [];

        await Promise.all(all.map(async e => {
          try {
            const regRes = await registrationsApi.eventRegistrations(e.id, { limit: 100 });
            const regs = regRes.data?.items ?? [];
            const count = regRes.data?.total ?? regs.length;
            totalRegs += count;
            totalRev += regs
              .filter((r: any) => r.status === 'confirmed')
              .reduce((s: number, r: any) => s + parseFloat(r.total_amount ?? '0'), 0);
            regCounts.push({ event: e, count });
            allRegs.push(...regs);
          } catch {
            regCounts.push({ event: e, count: 0 });
          }
        }));

        setTotalRegistrations(totalRegs);
        setTotalRevenue(totalRev);
        regCounts.sort((a, b) => b.count - a.count);
        setEventRegCounts(regCounts);

        // Build 30-day revenue trend from real registration timestamps
        const now = new Date();
        const trend = new Array(30).fill(0);
        for (const r of allRegs) {
          if (r.status !== 'confirmed') continue;
          const regDate = new Date(r.registered_at);
          const diffDays = Math.floor((now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays < 30) {
            trend[29 - diffDays] += parseFloat(r.total_amount ?? '0');
          }
        }
        setRevenueTrend(trend);

        // Fetch reviews for each event
        let allRatings: number[] = [];
        await Promise.all(all.map(async e => {
          try {
            const revRes = await reviewsApi.eventReviews(e.id);
            const reviews = revRes.data ?? [];
            allRatings = allRatings.concat(reviews.map((r: any) => r.rating));
          } catch {}
        }));

        if (allRatings.length > 0) {
          setAvgRating(allRatings.reduce((s, r) => s + r, 0) / allRatings.length);
          setTotalReviews(allRatings.length);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxCount = Math.max(...eventRegCounts.map(e => e.count), 1);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.sub}>All events · Last 30 days</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.text} style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* KPI tiles */}
            <View style={styles.kpiGrid}>
              <KpiTile
                label="TOTAL REGISTRATIONS"
                value={totalRegistrations.toLocaleString()}
                delta={`${events.length} event${events.length !== 1 ? 's' : ''}`}
              />
              <KpiTile
                label="GROSS REVENUE"
                value={totalRevenue === 0 ? '$0' : `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                delta="Confirmed only"
              />
              <KpiTile
                label="AVG. RATING"
                value={avgRating !== null ? avgRating.toFixed(1) : '—'}
                delta={totalReviews > 0 ? `${totalReviews} review${totalReviews !== 1 ? 's' : ''}` : 'No reviews yet'}
              />
              <KpiTile
                label="ACTIVE EVENTS"
                value={String(events.filter(e => e.status === 'published').length)}
                delta={`${events.filter(e => e.status === 'draft').length} drafts`}
              />
            </View>

            {/* Revenue trend */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Revenue trend</Text>
              <Text style={styles.cardSub}>Last 30 days</Text>
              <Sparkline data={revenueTrend} />
            </View>

            {/* Top events */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top events by registrations</Text>
              {eventRegCounts.length === 0 ? (
                <Text style={styles.emptyText}>No events yet</Text>
              ) : (
                <View style={styles.topEventsList}>
                  {eventRegCounts.slice(0, 5).map(({ event, count }, i) => {
                    const pct = (count / maxCount) * 100;
                    return (
                      <View key={event.id} style={[styles.topEventItem, i < Math.min(eventRegCounts.length, 5) - 1 && { marginBottom: 14 }]}>
                        <View style={styles.topEventHeader}>
                          <Text style={styles.topEventTitle} numberOfLines={1}>{event.title}</Text>
                          <Text style={styles.topEventCount}>{count}</Text>
                        </View>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${Math.max(pct, 2)}%` as any }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Registration status breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Event breakdown</Text>
              <View style={styles.breakdownGrid}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownValue}>{events.filter(e => e.status === 'published').length}</Text>
                  <Text style={styles.breakdownLabel}>Published</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownValue}>{events.filter(e => e.status === 'draft').length}</Text>
                  <Text style={styles.breakdownLabel}>Draft</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownValue}>{events.filter(e => e.status === 'cancelled').length}</Text>
                  <Text style={styles.breakdownLabel}>Cancelled</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 32 },

  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: 18 },
  title: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  sub: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: Spacing.base, marginBottom: 14 },
  kpiTile: { width: '47.5%', padding: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  kpiLabel: { fontSize: 10, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.4, marginTop: 6 },
  kpiDelta: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },

  // Cards
  card: {
    marginHorizontal: Spacing.base, marginBottom: 14,
    padding: 16, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
  },
  cardTitle: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginBottom: 14 },

  // Top events
  topEventsList: { marginTop: 10 },
  topEventItem: {},
  topEventHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  topEventTitle: { flex: 1, fontSize: 12, fontFamily: FontFamily.medium, color: Colors.text, marginRight: 8 },
  topEventCount: { fontSize: 12, fontFamily: FontFamily.semiBold, color: Colors.textSub },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.text, borderRadius: 2 },

  // Breakdown
  breakdownGrid: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownValue: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  breakdownLabel: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 4 },
  breakdownDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 8 },
});