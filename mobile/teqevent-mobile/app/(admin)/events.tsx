import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

type StatusFilter = 'all' | 'published' | 'draft' | 'cancelled';

const STATUS_COLOR: Record<string, string> = {
  published: Colors.success,
  draft:     Colors.textMuted,
  cancelled: Colors.error,
  closed:    Colors.warning,
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  ownerEmail,
  onUnpublish,
  onDelete,
}: {
  event: any;
  ownerEmail: string;
  onUnpublish: () => void;
  onDelete: () => void;
}) {
  const statusColor = STATUS_COLOR[event.status] ?? Colors.textMuted;

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventCardTop}>
        <View style={styles.eventCardLeft}>
          <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.eventMeta}>
            {ownerEmail || `#${event.owner_id}`} · {fmtDate(event.start_datetime)}
          </Text>
        </View>
        <View style={styles.eventCardRight}>
          <Text style={[styles.statusDot, { color: statusColor }]}>● {event.status}</Text>
        </View>
      </View>

      <View style={styles.eventCardActions}>
        {event.status === 'published' && (
          <TouchableOpacity onPress={onUnpublish} style={styles.actionBtn}>
            <Ionicons name="eye-off-outline" size={14} color={Colors.textSub} />
            <Text style={styles.actionBtnText}>Unpublish</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, styles.actionBtnDanger]}>
          <Ionicons name="trash-outline" size={14} color={Colors.error} />
          <Text style={[styles.actionBtnText, { color: Colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminEventsScreen() {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(false);
  const [events, setEvents]         = useState<any[]>([]);
  const [usersMap, setUsersMap]     = useState<Record<number, string>>({});
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(false);
    try {
      const [eventsRes, usersRes] = await Promise.all([
        adminApi.allEvents().then((r: any) => r.data),
        adminApi.users().then((r: any) => r.data).catch(() => []),
      ]);
      setEvents(Array.isArray(eventsRes) ? eventsRes : []);
      const map: Record<number, string> = {};
      (Array.isArray(usersRes) ? usersRes : []).forEach((u: any) => { map[u.id] = u.email; });
      setUsersMap(map);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = events;
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      (usersMap[e.owner_id] ?? '').toLowerCase().includes(q)
    );
    return list;
  }, [events, statusFilter, search, usersMap]);

  const counts = useMemo(() => ({
    all:       events.length,
    published: events.filter(e => e.status === 'published').length,
    draft:     events.filter(e => e.status === 'draft').length,
    cancelled: events.filter(e => e.status === 'cancelled' || e.status === 'closed').length,
  }), [events]);

  const unpublish = (ev: any) => {
    Alert.alert(
      'Unpublish event',
      `Unpublish "${ev.title}"? It will revert to draft and attendees will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpublish',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await adminApi.unpublishEvent(ev.id);
              setEvents(list => list.map(e => e.id === ev.id ? { ...e, status: (res.data as any).status } : e));
            } catch {
              Alert.alert('Error', 'Failed to unpublish event.');
            }
          },
        },
      ]
    );
  };

  const deleteEvent = (ev: any) => {
    Alert.alert(
      'Delete event',
      `Permanently delete "${ev.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deleteEvent(ev.id);
              setEvents(list => list.filter(e => e.id !== ev.id));
            } catch {
              Alert.alert('Error', 'Failed to delete event.');
            }
          },
        },
      ]
    );
  };

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
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load events</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All events</Text>
        <Text style={styles.headerSub}>Platform-wide · {events.length} total</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Published', value: counts.published, color: Colors.success },
          { label: 'Draft',     value: counts.draft,     color: Colors.textMuted },
          { label: 'Inactive',  value: counts.cancelled, color: Colors.error },
        ].map(s => (
          <View key={s.label} style={styles.statChip}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or organizer…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'published', 'draft', 'cancelled'] as StatusFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setStatusFilter(f)}
            style={[styles.chip, statusFilter === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, statusFilter === f && styles.chipTextActive]}>
              {f === 'all' ? `All (${counts.all})` :
               f === 'published' ? `Live (${counts.published})` :
               f === 'draft' ? `Draft (${counts.draft})` :
               `Inactive (${counts.cancelled})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={Colors.textMuted}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No events match your filter.</Text>
          </View>
        ) : filtered.map(ev => (
          <EventCard
            key={ev.id}
            event={ev}
            ownerEmail={usersMap[ev.owner_id] ?? ''}
            onUnpublish={() => unpublish(ev)}
            onDelete={() => deleteEvent(ev)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: 10 },
  headerTitle: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  headerSub:   { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: Spacing.base, marginBottom: 12,
  },
  statChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  statValue: { fontSize: 15, fontFamily: FontFamily.bold },
  statLabel: { fontSize: 10, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.base, marginBottom: 10,
    height: 42, paddingHorizontal: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  searchInput: {
    flex: 1, fontSize: FontSize.base, fontFamily: FontFamily.regular, color: Colors.text,
  },

  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.base, marginBottom: 12, gap: 8,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:     { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText:       { fontSize: FontSize.sm, fontFamily: FontFamily.medium, color: Colors.textSub },
  chipTextActive: { color: Colors.bg },

  list: { paddingHorizontal: Spacing.base, paddingBottom: 32, gap: 10 },

  eventCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 14,
  },
  eventCardTop:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
  eventCardLeft:  { flex: 1 },
  eventCardRight: { alignItems: 'flex-end' },
  eventTitle:  { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text, marginBottom: 4 },
  eventMeta:   { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted },
  statusDot:   { fontSize: 11, fontFamily: FontFamily.medium, textTransform: 'capitalize' },

  eventCardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnDanger: { borderColor: 'rgba(248,113,113,0.3)' },
  actionBtnText: { fontSize: 12, fontFamily: FontFamily.medium, color: Colors.textSub },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 16 },
  errorText: { fontSize: FontSize.base, fontFamily: FontFamily.semiBold, color: Colors.text },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted },
  retryBtn:  { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.accentBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  retryText: { fontSize: FontSize.sm, fontFamily: FontFamily.semiBold, color: Colors.text },
});
