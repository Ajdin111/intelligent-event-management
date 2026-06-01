import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event }: { event: Event }) {
  const progress = event.capacity ? 0 : 0; // registration count needs separate call
  const startDate = new Date(event.start_datetime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const endDate = new Date(event.end_datetime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const statusColor = event.status === 'published'
    ? Colors.success
    : event.status === 'cancelled'
    ? Colors.error
    : Colors.textMuted;

  const statusBg = event.status === 'published'
    ? Colors.successBg
    : event.status === 'cancelled'
    ? Colors.errorBg
    : 'rgba(255,255,255,0.06)';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => {}}
    >
      {/* Image placeholder */}
      <View style={styles.cardImage} />

      <View style={styles.cardBody}>
        {/* Status + title */}
        <View style={styles.cardTop}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>

        {/* Meta */}
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.cardMetaText}>{startDate} — {endDate}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.cardMetaText}>
            {event.location_type === 'online' ? 'Online' : event.physical_address ?? 'In-person'}
          </Text>
        </View>

        {/* Capacity bar */}
        {event.capacity && (
          <View style={styles.capacityRow}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
            <Text style={styles.capacityText}>{event.capacity} capacity</Text>
          </View>
        )}

        {/* Footer actions */}
        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => router.push(`/(organizer)/edit-event?id=${event.id}` as any)}>
            <Ionicons name="create-outline" size={14} color={Colors.textSub} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => router.push(`/(organizer)/event-registrations?id=${event.id}` as any)}>
            <Ionicons name="people-outline" size={14} color={Colors.textSub} />
            <Text style={styles.actionBtnText}>Registrations</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => {}}>
            <Ionicons name="bar-chart-outline" size={14} color={Colors.textSub} />
            <Text style={styles.actionBtnText}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OrganizerEventsScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'published' | 'draft' | 'cancelled'>('published');

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      eventsApi.myEvents()
        .then(res => {
          const raw = res.data as any;
          const all: Event[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
          setEvents(all);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  const filtered = events.filter(e => e.status === tab);

  const tabs: { key: 'published' | 'draft' | 'cancelled'; label: string }[] = [
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Events</Text>
          <Text style={styles.sub}>
            {loading ? 'Loading…' : `${events.length} total`}
          </Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(organizer)/create-event' as any)} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color={Colors.bg} />
        </TouchableOpacity>
      </View>

      {/* Status tabs */}
      <View style={styles.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]} numberOfLines={1}>
              {t.label}
            </Text>
            <View style={[styles.tabCount, tab === t.key && styles.tabCountActive]}>
              <Text style={[styles.tabCountText, tab === t.key && styles.tabCountTextActive]}>
                {events.filter(e => e.status === t.key).length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.text} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No {tab} events</Text>
          <Text style={styles.emptyText}>
            {tab === 'published'
              ? 'Publish an event to see it here.'
              : tab === 'draft'
              ? 'Create an event to get started.'
              : 'No cancelled events.'}
          </Text>
          {tab !== 'cancelled' && (
            <TouchableOpacity style={styles.createEventBtn} onPress={() => router.push('/(organizer)/create-event' as any)} activeOpacity={0.85}>
              <Text style={styles.createEventBtnText}>Create event</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => String(e.id)}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md, paddingBottom: 14,
  },
  title: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  sub: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },
  createBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingBottom: 12, gap: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.borderMed,
  },
  tabActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  tabText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textSub },
  tabTextActive: { color: Colors.bg },
  tabCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: 'rgba(0,0,0,0.2)' },
  tabCountText: { fontSize: 10, fontFamily: FontFamily.bold, color: Colors.textSub },
  tabCountTextActive: { color: Colors.bg },

  list: { paddingHorizontal: Spacing.base, paddingBottom: 32 },

  // Card
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, overflow: 'hidden',
  },
  cardImage: { height: 100, backgroundColor: 'rgba(255,255,255,0.04)' },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: FontFamily.medium },
  cardTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text, lineHeight: 21, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  cardMetaText: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub, flex: 1 },

  // Capacity
  capacityRow: { marginTop: 8, gap: 5 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.text, borderRadius: 2 },
  capacityText: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },

  // Footer actions
  cardFooter: {
    flexDirection: 'row', gap: 6,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnText: { fontSize: 11.5, fontFamily: FontFamily.medium, color: Colors.textSub },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: FontSize.md, fontFamily: FontFamily.semiBold, color: Colors.text },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted, textAlign: 'center' },
  createEventBtn: {
    marginTop: 8, height: 44, paddingHorizontal: 24,
    borderRadius: Radius.md, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  createEventBtnText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.bg },
});
