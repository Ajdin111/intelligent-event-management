import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { registrationsApi, eventsApi, Event, Registration } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  confirmed: Colors.success,
  pending: Colors.warning,
  cancelled: Colors.error,
  rejected: Colors.error,
};

const STATUS_BG: Record<string, string> = {
  confirmed: Colors.successBg,
  pending: Colors.warningBg,
  cancelled: Colors.errorBg,
  rejected: Colors.errorBg,
};

// ─── Registration Card ────────────────────────────────────────────────────────
function RegistrationCard({
  registration,
  onApprove,
  onReject,
}: {
  registration: Registration;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const dotColor = STATUS_COLOR[registration.status] ?? Colors.textMuted;
  const badgeBg = STATUS_BG[registration.status] ?? Colors.accentBg;
  const isPending = registration.status === 'pending';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.statusText, { color: dotColor }]}>
            {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
          </Text>
        </View>
        <Text style={styles.cardDate}>
          {new Date(registration.registered_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </Text>
      </View>

      <Text style={styles.cardName}>
        {registration.user
          ? `${registration.user.first_name} ${registration.user.last_name}`
          : `User #${registration.user_id}`}
      </Text>

      {registration.user?.email && (
        <Text style={styles.cardEmail}>{registration.user.email}</Text>
      )}

      <View style={styles.cardMeta}>
        <View style={styles.cardMetaItem}>
          <Ionicons name="ticket-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.cardMetaText}>Qty: {registration.quantity}</Text>
        </View>
        <View style={styles.cardMetaItem}>
          <Ionicons name="cash-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.cardMetaText}>
            {parseFloat(registration.total_amount) === 0 ? 'Free' : `$${parseFloat(registration.total_amount).toFixed(2)}`}
          </Text>
        </View>
      </View>

      {isPending && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.approveBtn}
            onPress={() => onApprove(registration.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={14} color={Colors.success} />
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => onReject(registration.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={14} color={Colors.error} />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function EventRegistrationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = parseInt(id);

  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      eventsApi.detail(eventId),
      registrationsApi.eventRegistrations(eventId, { limit: 100 }),
    ]).then(([evRes, regRes]) => {
      setEvent(evRes.data);
      const items = regRes.data?.items ?? regRes.data ?? [];
      setRegistrations(Array.isArray(items) ? items : []);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [eventId]);

  const handleApprove = (id: number) => {
    Alert.alert(
      'Approve registration',
      'Approve this registration? The attendee will be confirmed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await registrationsApi.approve(id);
              setRegistrations(prev =>
                prev.map(r => r.id === id ? { ...r, status: 'confirmed' as any } : r)
              );
            } catch {
              Alert.alert('Error', 'Failed to approve registration.');
            }
          },
        },
      ]
    );
  };

  const handleReject = (id: number) => {
    Alert.alert(
      'Reject registration',
      'Reject this registration? The attendee will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await registrationsApi.reject(id, 'Rejected by organizer');
              setRegistrations(prev =>
                prev.map(r => r.id === id ? { ...r, status: 'rejected' as any } : r)
              );
            } catch {
              Alert.alert('Error', 'Failed to reject registration.');
            }
          },
        },
      ]
    );
  };

  const STATUS_TABS = ['all', 'confirmed', 'pending', 'cancelled', 'rejected'];

  const filtered = statusFilter === 'all'
    ? registrations
    : registrations.filter(r => r.status === statusFilter);

  const pendingCount = registrations.filter(r => r.status === 'pending').length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Registrations</Text>
          {event && <Text style={styles.headerSub} numberOfLines={1}>{event.title}</Text>}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Stats row */}
      {!loading && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{registrations.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {registrations.filter(r => r.status === 'confirmed').length}
            </Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.error }]}>
              {registrations.filter(r => r.status === 'cancelled' || r.status === 'rejected').length}
            </Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
        </View>
      )}

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          {STATUS_TABS.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, statusFilter === t && styles.chipActive]}
              onPress={() => setStatusFilter(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, statusFilter === t && styles.chipTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              {t === 'pending' && pendingCount > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {loading ? (
          <ActivityIndicator color={Colors.text} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No {statusFilter === 'all' ? '' : statusFilter} registrations</Text>
            <Text style={styles.emptyText}>
              {statusFilter === 'all' ? 'No one has registered yet.' : `No ${statusFilter} registrations found.`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={r => String(r.id)}
            renderItem={({ item }) => (
              <RegistrationCard
                registration={item}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )}
      </View>
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

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.text },
  statLabel: { fontSize: 10.5, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  // Filter chips
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChips: { paddingHorizontal: Spacing.base, paddingVertical: 12, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.borderMed,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 12, fontFamily: FontFamily.medium, color: Colors.textSub },
  chipTextActive: { color: Colors.bg },
  pendingBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.warning,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingBadgeText: { fontSize: 9, fontFamily: FontFamily.bold, color: Colors.bg },

  list: { paddingHorizontal: Spacing.base, paddingTop: 12, paddingBottom: 32 },

  // Card
  card: {
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: FontFamily.medium },
  cardDate: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },
  cardName: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text, marginBottom: 2 },
  cardEmail: { fontSize: 11.5, fontFamily: FontFamily.regular, color: Colors.textMuted, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub },

  // Actions
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.success,
    backgroundColor: Colors.successBg,
  },
  approveBtnText: { fontSize: 12.5, fontFamily: FontFamily.semiBold, color: Colors.success },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.error,
    backgroundColor: Colors.errorBg,
  },
  rejectBtnText: { fontSize: 12.5, fontFamily: FontFamily.semiBold, color: Colors.error },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: FontSize.md, fontFamily: FontFamily.semiBold, color: Colors.text },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted, textAlign: 'center' },
});