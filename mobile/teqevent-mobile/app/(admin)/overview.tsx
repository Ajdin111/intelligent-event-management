import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Polygon, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { adminApi } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

const SCREEN_W = Dimensions.get('window').width;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLast12Months() {
  const result = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'short' }),
    });
  }
  return result;
}

function fmtRevenue(val: any) {
  const n = parseFloat(val);
  if (!n || isNaN(n)) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function fmtRelative(iso: string) {
  if (!iso) return '';
  const diffMs   = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30)  return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// ─── Sparkline chart ──────────────────────────────────────────────────────────

function LineChart({ data, labels }: { data: number[]; labels: string[] }) {
  const W = SCREEN_W - 64, H = 120;
  const PL = 28, PR = 8, PT = 10, PB = 24;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: PL + (i / Math.max(data.length - 1, 1)) * cW,
    y: PT + cH - (v / max) * cH,
  }));
  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${pts[0].x},${PT + cH} ${polyline} ${pts[pts.length - 1].x},${PT + cH}`;
  const yTicks = [0, Math.round(max / 2), max];
  const visibleLabels = labels.filter((_, i) => i % 2 === 0);

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="lgfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#fff" stopOpacity="0.12" />
          <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {yTicks.map(v => {
        const y = PT + cH - (v / max) * cH;
        return (
          <Line key={v} x1={PL} y1={y} x2={W - PR} y2={y}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        );
      })}
      <Polygon points={area} fill="url(#lgfill)" />
      <Polyline points={polyline} fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" />)}
      {visibleLabels.map((label, j) => {
        const i = j * 2;
        return (
          <SvgText key={label} x={pts[i]?.x ?? 0} y={H - 2}
            fill="rgba(255,255,255,0.35)" fontSize="8" textAnchor="middle">
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminOverviewScreen() {
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers]         = useState<any[]>([]);
  const [events, setEvents]       = useState<any[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(false);
    try {
      const [analyticsRes, usersRes, eventsRes] = await Promise.all([
        adminApi.analytics().then(r => r.data).catch(() => null),
        adminApi.users().then(r => r.data).catch(() => []),
        adminApi.allEvents().then(r => r.data).catch(() => []),
      ]);
      setAnalytics(analyticsRes);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setEvents(Array.isArray(eventsRes) ? eventsRes : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const months = getLast12Months();
  const thisMonth = months[months.length - 1].key;

  const totalUsers    = users.length;
  const totalEvents   = events.length;
  const activeEvents  = events.filter(e => e.status === 'published').length;
  const newUsersMonth = users.filter(u => u.created_at?.slice(0, 7) === thisMonth).length;
  const totalRevenue  = analytics?.total_revenue ?? 0;
  const revenueComputed = parseFloat(totalRevenue) > 0;

  const userGrowth     = months.map(m => users.filter(u => (u.created_at?.slice(0, 7) ?? '') <= m.key).length);
  const chartLabels    = months.map(m => m.label);

  const activityItems = [
    ...users.filter(u => u.created_at).map(u => ({
      key: `u-${u.id}`,
      text: `${u.first_name} ${u.last_name} joined`,
      time: u.created_at,
      isUser: true,
      initials: `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '?',
    })),
    ...events.filter(e => e.created_at).map(e => ({
      key: `e-${e.id}`,
      text: `"${e.title}" ${e.status === 'published' ? 'published' : 'created'}`,
      time: e.created_at,
      isUser: false,
      initials: '',
    })),
  ]
    .sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
    .slice(0, 7);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.text} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Failed to load</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={Colors.textMuted}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Platform overview</Text>
            <Text style={styles.headerSub}>All-time metrics</Text>
          </View>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={13} color={Colors.text} />
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        </View>

        {/* Stat tiles */}
        <View style={styles.statGrid}>
          <StatTile
            label="TOTAL USERS"
            value={totalUsers.toLocaleString()}
            sub={newUsersMonth > 0 ? `+${newUsersMonth} this month` : 'No new users this month'}
          />
          <StatTile
            label="TOTAL EVENTS"
            value={totalEvents.toLocaleString()}
            sub={`${activeEvents} active`}
          />
          <StatTile
            label="PLATFORM REVENUE"
            value={revenueComputed ? fmtRevenue(totalRevenue) : '—'}
            sub={revenueComputed ? 'Confirmed registrations' : 'Requires analytics run'}
          />
          <StatTile
            label="ACTIVE EVENTS"
            value={activeEvents.toLocaleString()}
            sub={`${totalEvents - activeEvents} draft / cancelled`}
          />
        </View>

        {/* User growth chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>User growth</Text>
          <Text style={styles.chartSub}>Cumulative · last 12 months</Text>
          <View style={{ marginTop: 12 }}>
            <LineChart data={userGrowth} labels={chartLabels} />
          </View>
        </View>

        {/* Recent activity */}
        <Text style={styles.sectionTitle}>Recent platform activity</Text>
        <View style={styles.activityCard}>
          {activityItems.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity.</Text>
          ) : activityItems.map((item, i) => (
            <View key={item.key} style={[styles.activityRow, i < activityItems.length - 1 && styles.activityBorder]}>
              <View style={styles.activityAvatar}>
                {item.isUser ? (
                  <Text style={styles.activityAvatarText}>{item.initials}</Text>
                ) : (
                  <Ionicons name="calendar-outline" size={13} color={Colors.textSub} />
                )}
              </View>
              <Text style={styles.activityText} numberOfLines={2}>{item.text}</Text>
              <Text style={styles.activityTime}>{fmtRelative(item.time)}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 32 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: 18,
  },
  headerTitle: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  headerSub:   { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 3 },
  adminBadge:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.accentBg, borderWidth: 1, borderColor: Colors.borderMed,
    borderRadius: Radius.full,
  },
  adminBadgeText: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.text },

  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: Spacing.base, marginBottom: 14,
  },
  statTile: {
    width: '47.5%', padding: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  statLabel: { fontSize: 10, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.4, marginTop: 6 },
  statSub:   { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },

  chartCard: {
    marginHorizontal: Spacing.base, marginBottom: 20, padding: 16,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  chartTitle: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text },
  chartSub:   { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },

  sectionTitle: {
    fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text,
    paddingHorizontal: Spacing.base, marginBottom: 10,
  },
  activityCard: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, overflow: 'hidden',
  },
  activityRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  activityAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.accentBg, alignItems: 'center', justifyContent: 'center',
  },
  activityAvatarText: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.text },
  activityText:  { flex: 1, fontSize: 12.5, fontFamily: FontFamily.regular, color: Colors.textSub },
  activityTime:  { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },

  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted, padding: 16 },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorTitle: { fontSize: FontSize.md, fontFamily: FontFamily.semiBold, color: Colors.text },
  retryBtn:   { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.accentBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  retryBtnText: { fontSize: FontSize.sm, fontFamily: FontFamily.semiBold, color: Colors.text },
});
