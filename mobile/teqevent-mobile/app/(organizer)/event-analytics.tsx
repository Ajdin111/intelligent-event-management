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
import { eventsApi, registrationsApi, reviewsApi, checkinApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={[styles.statTileValue, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={styles.statTileSub}>{sub}</Text>}
    </View>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function EventAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = parseInt(id);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [regStats, setRegStats] = useState({
    total: 0, confirmed: 0, pending: 0, cancelled: 0, revenue: 0,
  });
  const [checkinStats, setCheckinStats] = useState<{
    total_checked_in: number; total_registered: number; attendance_rate: number;
  } | null>(null);
  const [reviewStats, setReviewStats] = useState<{
    avg: number; count: number; distribution: number[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [evRes, regRes] = await Promise.all([
          eventsApi.detail(eventId),
          registrationsApi.eventRegistrations(eventId, { limit: 100 }),
        ]);

        setEvent(evRes.data);
        const regs = regRes.data?.items ?? regRes.data ?? [];
        const arr = Array.isArray(regs) ? regs : [];

        const confirmed = arr.filter((r: any) => r.status === 'confirmed');
        const revenue = confirmed.reduce((s: number, r: any) => s + parseFloat(r.total_amount ?? '0'), 0);
        setRegStats({
          total: arr.length,
          confirmed: confirmed.length,
          pending: arr.filter((r: any) => r.status === 'pending').length,
          cancelled: arr.filter((r: any) => r.status === 'cancelled' || r.status === 'rejected').length,
          revenue,
        });

        // Checkin stats
        try {
          const statsRes = await checkinApi.stats(eventId);
          setCheckinStats(statsRes.data);
        } catch {}

        // Reviews
        try {
          const revRes = await reviewsApi.eventReviews(eventId);
          const reviews = revRes.data ?? [];
          if (reviews.length > 0) {
            const avg = reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length;
            const dist = [5, 4, 3, 2, 1].map(star =>
              reviews.filter((r: any) => r.rating === star).length
            );
            setReviewStats({ avg, count: reviews.length, distribution: dist });
          }
        } catch {}
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const attendanceRate = checkinStats
    ? Math.round(checkinStats.attendance_rate)
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Analytics</Text>
          {event && <Text style={styles.headerSub} numberOfLines={1}>{event.title}</Text>}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.text} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Event info */}
          {event && (
            <View style={styles.eventCard}>
              <View style={styles.eventCardLeft}>
                <Text style={styles.eventCardTitle}>{event.title}</Text>
                <Text style={styles.eventCardDate}>
                  {new Date(event.start_datetime).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: event.status === 'published' ? Colors.successBg : Colors.accentBg,
              }]}>
                <Text style={[styles.statusText, {
                  color: event.status === 'published' ? Colors.success : Colors.textSub,
                }]}>
                  {event.status}
                </Text>
              </View>
            </View>
          )}

          {/* Registrations */}
          <Section title="Registrations">
            <View style={styles.tileGrid}>
              <StatTile label="TOTAL" value={String(regStats.total)} />
              <StatTile label="CONFIRMED" value={String(regStats.confirmed)} color={Colors.success} />
              <StatTile label="PENDING" value={String(regStats.pending)} color={Colors.warning} />
              <StatTile label="CANCELLED" value={String(regStats.cancelled)} color={Colors.error} />
            </View>
            <View style={styles.revenueCard}>
              <Text style={styles.revenueLabel}>GROSS REVENUE</Text>
              <Text style={styles.revenueValue}>
                {regStats.revenue === 0 ? 'Free event' : `$${regStats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            </View>
          </Section>

          {/* Capacity */}
          {event?.capacity && (
            <Section title="Capacity">
              <View style={styles.card}>
                <View style={styles.capacityRow}>
                  <Text style={styles.capacityNum}>{regStats.confirmed}</Text>
                  <Text style={styles.capacityDivider}>/</Text>
                  <Text style={styles.capacityTotal}>{event.capacity}</Text>
                  <Text style={styles.capacityLabel}>spots filled</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {
                    width: `${Math.min((regStats.confirmed / event.capacity) * 100, 100)}%` as any,
                  }]} />
                </View>
                <Text style={styles.capacityPct}>
                  {Math.round((regStats.confirmed / event.capacity) * 100)}% capacity
                </Text>
              </View>
            </Section>
          )}

          {/* Check-in */}
          {checkinStats && (
            <Section title="Check-in">
              <View style={styles.tileGrid}>
                <StatTile
                  label="CHECKED IN"
                  value={String(checkinStats.total_checked_in)}
                  sub={`of ${checkinStats.total_registered}`}
                />
                <StatTile
                  label="ATTENDANCE"
                  value={`${attendanceRate}%`}
                  color={attendanceRate >= 80 ? Colors.success : attendanceRate >= 50 ? Colors.warning : Colors.error}
                />
              </View>
            </Section>
          )}

          {/* Reviews */}
          {reviewStats ? (
            <Section title="Reviews">
              <View style={styles.card}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAvg}>{reviewStats.avg.toFixed(1)}</Text>
                  <View>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <Ionicons
                          key={i}
                          name={i <= Math.round(reviewStats.avg) ? 'star' : 'star-outline'}
                          size={14}
                          color={Colors.text}
                        />
                      ))}
                    </View>
                    <Text style={styles.reviewCount}>{reviewStats.count} review{reviewStats.count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>

                {/* Star distribution */}
                {[5, 4, 3, 2, 1].map((star, i) => {
                  const count = reviewStats.distribution[i];
                  const pct = reviewStats.count > 0 ? (count / reviewStats.count) * 100 : 0;
                  return (
                    <View key={star} style={styles.distRow}>
                      <Text style={styles.distStar}>{star}</Text>
                      <Ionicons name="star" size={10} color={Colors.textMuted} />
                      <View style={styles.distBar}>
                        <View style={[styles.distFill, { width: `${pct}%` as any }]} />
                      </View>
                      <Text style={styles.distCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </Section>
          ) : (
            <Section title="Reviews">
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No reviews yet</Text>
              </View>
            </Section>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },
  headerSub: { fontSize: 11.5, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },

  scroll: { paddingBottom: 32 },

  // Event card
  eventCard: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    margin: Spacing.base, padding: 14,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  eventCardLeft: { flex: 1, marginRight: 10 },
  eventCardTitle: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text, lineHeight: 20 },
  eventCardDate: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 3 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 11, fontFamily: FontFamily.medium, textTransform: 'capitalize' },

  // Section
  section: { paddingHorizontal: Spacing.base, marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text, marginBottom: 10 },

  // Stat tiles
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  statTile: {
    width: '47.5%', padding: 12,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  statTileLabel: { fontSize: 10, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  statTileValue: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.4, marginTop: 4 },
  statTileSub: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },

  // Revenue
  revenueCard: {
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  revenueLabel: { fontSize: 10, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  revenueValue: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5, marginTop: 4 },

  // Card
  card: {
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },

  // Capacity
  capacityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 12 },
  capacityNum: { fontSize: 28, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  capacityDivider: { fontSize: 20, fontFamily: FontFamily.regular, color: Colors.textMuted, marginBottom: 2 },
  capacityTotal: { fontSize: 20, fontFamily: FontFamily.regular, color: Colors.textMuted, marginBottom: 2 },
  capacityLabel: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub, marginBottom: 4 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: Colors.text, borderRadius: 2 },
  capacityPct: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted },

  // Reviews
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  reviewAvg: { fontSize: 36, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  stars: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  reviewCount: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  distStar: { fontSize: 12, fontFamily: FontFamily.medium, color: Colors.textSub, width: 10 },
  distBar: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  distFill: { height: '100%', backgroundColor: Colors.text, borderRadius: 2 },
  distCount: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, width: 20, textAlign: 'right' },

  // Empty
  emptyCard: { padding: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted },
});