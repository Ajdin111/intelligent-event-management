import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { registrationsApi, eventsApi, Registration, Ticket } from '@/services/api';
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
function RegistrationCard({ registration, onCancel, onDelete, isCancelling }: {
  registration: Registration & { eventTitle?: string; eventDate?: string; locationType?: string };
  onCancel: (id: number) => void;
  onDelete: (id: number) => void;
  isCancelling: boolean;
}) {
  const dotColor = STATUS_COLOR[registration.status] ?? Colors.textMuted;
  const badgeBg = STATUS_BG[registration.status] ?? Colors.accentBg;
  const canCancel = registration.status === 'confirmed' || registration.status === 'pending';
  const isDismissable = registration.status === 'cancelled' || registration.status === 'rejected';

  const handleCancel = () => {
    Alert.alert(
      'Cancel registration',
      'Are you sure you want to cancel this registration? This action cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel registration',
          style: 'destructive',
          onPress: () => onCancel(registration.id),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.regCard}
      activeOpacity={0.8}
      onPress={() => router.push(`/(attendee)/event/${registration.event_id}` as any)}
    >
      {/* Status + date row */}
      <View style={styles.regCardTop}>
        <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.statusText, { color: dotColor }]}>
            {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
          </Text>
        </View>
        <Text style={styles.regDate}>
          {new Date(registration.registered_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </Text>
      </View>

      {/* Event title */}
      <Text style={styles.regTitle} numberOfLines={2}>
        {registration.eventTitle ?? `Event #${registration.event_id}`}
      </Text>

      {/* Meta row */}
      <View style={styles.regMeta}>
        {registration.eventDate && (
          <View style={styles.regMetaItem}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.regMetaText}>{registration.eventDate}</Text>
          </View>
        )}
        {registration.locationType && (
          <View style={styles.regMetaItem}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.regMetaText}>{registration.locationType}</Text>
          </View>
        )}
        <Text style={styles.regAmount}>
          {parseFloat(registration.total_amount) === 0 ? 'Free' : `$${parseFloat(registration.total_amount).toFixed(2)}`}
        </Text>
      </View>

      {/* Cancel button */}
      {canCancel && (
        <TouchableOpacity
          style={[styles.cancelBtn, isCancelling && styles.cancelBtnDisabled]}
          onPress={isCancelling ? undefined : handleCancel}
          activeOpacity={0.7}
        >
          {isCancelling ? (
            <View style={styles.cancelBtnInner}>
              <ActivityIndicator size="small" color={Colors.error} />
              <Text style={styles.cancelBtnText}>Canceling…</Text>
            </View>
          ) : (
            <Text style={styles.cancelBtnText}>Cancel registration</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Remove button for cancelled / rejected */}
      {isDismissable && (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onDelete(registration.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.removeBtnText}>Remove</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Ticket Card ─────────────────────────────────────────────────────────────
function TicketCard({ ticket }: { ticket: Ticket & { eventTitle?: string; eventDate?: string } }) {
  return (
    <View style={styles.ticketCard}>
      {/* Header */}
      <View style={styles.ticketHeader}>
        <View>
          <Text style={styles.ticketEventTitle} numberOfLines={2}>
            {ticket.eventTitle ?? `Event #${ticket.event_id}`}
          </Text>
          {ticket.eventDate && (
            <Text style={styles.ticketEventDate}>{ticket.eventDate}</Text>
          )}
        </View>
        <View style={[styles.ticketValidBadge, !ticket.is_valid && styles.ticketInvalidBadge]}>
          <Text style={[styles.ticketValidText, !ticket.is_valid && styles.ticketInvalidText]}>
            {ticket.is_valid ? 'Valid' : 'Used'}
          </Text>
        </View>
      </View>

      {/* Dashed divider */}
      <View style={styles.ticketDivider} />

      {/* QR placeholder */}
      <View style={styles.qrArea}>
        <View style={styles.qrPlaceholder}>
          <Ionicons name="qr-code-outline" size={80} color={Colors.textMuted} />
        </View>
        <Text style={styles.qrCode} numberOfLines={1}>{ticket.qr_code}</Text>
        <Text style={styles.qrHint}>Show this QR code at the event entrance</Text>
      </View>

      {/* Dashed divider */}
      <View style={styles.ticketDivider} />

      {/* How to use */}
      <View style={styles.howToUse}>
        <Text style={styles.howToUseLabel}>HOW TO USE</Text>
        {[
          'Show this QR code at the event entrance',
          'Staff will scan to verify your registration',
          'Keep your phone charged or save a screenshot',
        ].map((step, i) => (
          <View key={i} style={styles.howToUseRow}>
            <Text style={styles.howToUseNum}>{i + 1}.</Text>
            <Text style={styles.howToUseText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TicketsScreen() {
  const [mainTab, setMainTab] = useState<'registrations' | 'tickets'>('registrations');
  const [statusFilter, setStatusFilter] = useState('All');
  const [registrations, setRegistrations] = useState<(Registration & { eventTitle?: string; eventDate?: string; locationType?: string })[]>([]);
  const [tickets, setTickets] = useState<(Ticket & { eventTitle?: string; eventDate?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const handleCancelRegistration = async (id: number) => {
    setCancellingId(id);
    try {
      await registrationsApi.cancel(id);
      setRegistrations(prev =>
        prev.map(r => r.id === id ? { ...r, status: 'cancelled' as any } : r)
      );
      setTickets(prev => prev.filter(t => t.registration_id !== id));
    } catch {
      Alert.alert('Error', 'Failed to cancel registration. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleDeleteRegistration = async (id: number) => {
    setRegistrations(prev => prev.filter(r => r.id !== id));
    try {
      const raw = await SecureStore.getItemAsync('dismissed_registrations');
      const existing: number[] = raw ? JSON.parse(raw) : [];
      if (!existing.includes(id)) {
        await SecureStore.setItemAsync('dismissed_registrations', JSON.stringify([...existing, id]));
      }
    } catch {
      // persistence failure is non-critical
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      (async () => {
        try {
          const [regRes, dismissedRaw] = await Promise.all([
            registrationsApi.myRegistrations(),
            SecureStore.getItemAsync('dismissed_registrations'),
          ]);
          const dismissedIds: number[] = dismissedRaw ? JSON.parse(dismissedRaw) : [];
          const regs = regRes.data.filter(r => !dismissedIds.includes(r.id));

          const uniqueEventIds = [...new Set(regs.map(r => r.event_id))];
          const eventResults = await Promise.all(
            uniqueEventIds.map(id => eventsApi.detail(id).then(res => res.data).catch(() => null))
          );
          const eventMap = new Map(uniqueEventIds.map((id, i) => [id, eventResults[i]]));

          const formatDate = (iso: string) =>
            new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

          const getLocationType = (ev: { location_type: string; physical_address?: string }) => {
            if (ev.location_type === 'online') return 'Online';
            if (ev.location_type === 'hybrid') return 'Hybrid';
            return ev.physical_address ?? 'In-person';
          };

          if (!active) return;

          setRegistrations(regs.map(r => {
            const ev = eventMap.get(r.event_id);
            return {
              ...r,
              eventTitle: ev?.title,
              eventDate: ev ? formatDate(ev.start_datetime) : undefined,
              locationType: ev ? getLocationType(ev) : undefined,
            };
          }));

          const confirmed = regs.filter(r => r.status === 'confirmed');
          const ticketArrays = await Promise.all(
            confirmed.map(r =>
              registrationsApi.tickets(r.id).then(res => {
                const ev = eventMap.get(r.event_id);
                return res.data.map(t => ({
                  ...t,
                  eventTitle: ev?.title,
                  eventDate: ev ? formatDate(ev.start_datetime) : undefined,
                }));
              }).catch(() => [])
            )
          );

          if (active) setTickets(ticketArrays.flat());
        } catch {
          // silently fail
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => { active = false; };
    }, [])
  );

  const STATUS_TABS = ['All', 'Confirmed', 'Pending', 'Cancelled'];

  const filteredRegistrations = statusFilter === 'All'
    ? registrations
    : registrations.filter(r => r.status === statusFilter.toLowerCase());

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Tickets</Text>
        <Text style={styles.sub}>
          {loading ? 'Loading…' : `${registrations.length} registration${registrations.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Main tab switcher */}
      <View style={styles.mainTabs}>
        <TouchableOpacity
          style={[styles.mainTab, mainTab === 'registrations' && styles.mainTabActive]}
          onPress={() => setMainTab('registrations')}
          activeOpacity={0.7}
        >
          <Text style={[styles.mainTabText, mainTab === 'registrations' && styles.mainTabTextActive]}>
            Registrations
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, mainTab === 'tickets' && styles.mainTabActive]}
          onPress={() => setMainTab('tickets')}
          activeOpacity={0.7}
        >
          <Text style={[styles.mainTabText, mainTab === 'tickets' && styles.mainTabTextActive]}>
            QR Tickets
          </Text>
          {tickets.length > 0 && (
            <View style={styles.ticketBadge}>
              <Text style={styles.ticketBadgeText}>{tickets.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.text} style={{ marginTop: 40 }} />
      ) : mainTab === 'registrations' ? (
        <View style={{ flex: 1 }}>
          {/* Status filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.filterChips}
          >
            {STATUS_TABS.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, statusFilter === t && styles.chipActive]}
                onPress={() => setStatusFilter(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, statusFilter === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredRegistrations.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No registrations</Text>
              <Text style={styles.emptyText}>
                {statusFilter === 'All' ? 'You have not registered for any events yet.' : `No ${statusFilter.toLowerCase()} registrations.`}
              </Text>
              {statusFilter === 'All' && (
                <TouchableOpacity
                  style={styles.discoverBtn}
                  onPress={() => router.push('/(attendee)/discover' as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.discoverBtnText}>Discover events</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredRegistrations}
              keyExtractor={r => String(r.id)}
              renderItem={({ item }) => (
              <RegistrationCard
                registration={item}
                onCancel={handleCancelRegistration}
                onDelete={handleDeleteRegistration}
                isCancelling={cancellingId === item.id}
              />
            )}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            />
          )}
        </View>
      ) : (
        // QR Tickets tab
        tickets.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="ticket-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No tickets yet</Text>
            <Text style={styles.emptyText}>Tickets appear here after your registration is confirmed.</Text>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={t => String(t.id)}
            renderItem={({ item }) => <TicketCard ticket={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: 14 },
  title: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  sub: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },

  // Main tabs
  mainTabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    marginBottom: 14,
  },
  mainTab: {
    flex: 1, height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  mainTabActive: { backgroundColor: Colors.text },
  mainTabText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textMuted },
  mainTabTextActive: { color: Colors.bg },
  ticketBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ticketBadgeText: { fontSize: 10, fontFamily: FontFamily.bold, color: Colors.bg },

  // Filter chips
  filterChips: { paddingHorizontal: Spacing.base, paddingBottom: 16, paddingTop: 4, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.borderMed,
    minHeight: 36,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 12, fontFamily: FontFamily.medium, color: Colors.textSub },
  chipTextActive: { color: Colors.bg },

  list: { paddingHorizontal: Spacing.base, paddingBottom: 32 },

  // Registration card
  regCard: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
  },
  regCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11.5, fontFamily: FontFamily.medium },
  regDate: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },
  regTitle: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text, lineHeight: 20, marginBottom: 10 },
  regMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  regMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  regMetaText: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted },
  regAmount: { marginLeft: 'auto', fontSize: 12, fontFamily: FontFamily.semiBold, color: Colors.textSub },

  // Ticket card
  ticketCard: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  ticketHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16, gap: 12,
  },
  ticketEventTitle: { flex: 1, fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text, lineHeight: 21 },
  ticketEventDate: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 3 },
  ticketValidBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.successBg,
  },
  ticketInvalidBadge: { backgroundColor: Colors.errorBg },
  ticketValidText: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.success },
  ticketInvalidText: { color: Colors.error },
  ticketDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    borderStyle: 'dashed',
  },
  qrArea: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  qrPlaceholder: {
    width: 160, height: 160,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  qrCode: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginBottom: 6 },
  qrHint: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub, textAlign: 'center' },
  howToUse: { padding: 16 },
  howToUseLabel: {
    fontSize: 10.5, fontFamily: FontFamily.semiBold,
    color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 10,
  },
  howToUseRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  howToUseNum: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.textSub },
  howToUseText: { flex: 1, fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub, lineHeight: 20 },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: FontSize.md, fontFamily: FontFamily.semiBold, color: Colors.text },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted, textAlign: 'center' },
  discoverBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMed,
  },
  discoverBtnText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.text },

  cancelBtn: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center',
  },
  cancelBtnDisabled: {
    opacity: 0.6,
  },
  cancelBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontFamily: FontFamily.medium,
    color: Colors.error,
  },
  removeBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
});