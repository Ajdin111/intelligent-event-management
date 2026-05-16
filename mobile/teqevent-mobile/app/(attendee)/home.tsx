import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { eventsApi, registrationsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event, compact = false }: { event: Event; compact?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={() => {}}
      activeOpacity={0.8}
    >
      <View style={[styles.cardImage, compact && styles.cardImageCompact]}>
        {event.cover_image ? (
          <Image source={{ uri: event.cover_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.cardMetaText}>
            {new Date(event.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
          <View style={styles.locationBadge}>
            <Text style={styles.locationBadgeText}>{event.location_type}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>{event.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, action, onAction }: {
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub && <Text style={styles.sectionSub}>{sub}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await eventsApi.list({ limit: 10, status: 'published' });
        setEvents(res.data.items ?? []);

        const regRes = await registrationsApi.myRegistrations();
        setUpcomingCount(
          regRes.data.filter(r => r.status === 'confirmed').length
        );
      } catch {
        // silently fail — show empty state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const firstName = user?.first_name ?? '';
  const upcoming = events.slice(0, 5);
  const recommended = events.slice(0, 3);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              {greeting()}{firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={styles.headerSub}>
              {upcomingCount > 0 ? `${upcomingCount} event${upcomingCount > 1 ? 's' : ''} coming up` : 'Discover events near you'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.textSub} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        {/* Quick ticket banner */}
        {upcomingCount > 0 && (
          <TouchableOpacity
            style={styles.ticketBanner}
            onPress={() => router.push('/(attendee)/tickets')}
            activeOpacity={0.8}
          >
            <View style={styles.ticketBannerIcon}>
              <Ionicons name="ticket" size={22} color={Colors.bg} />
            </View>
            <View style={styles.ticketBannerText}>
              <Text style={styles.ticketBannerTitle}>Your upcoming event</Text>
              <Text style={styles.ticketBannerSub}>Tap to show your ticket</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Upcoming events */}
        <SectionHeader
          title="Upcoming events"
          action="See all"
          onAction={() => router.push('/(attendee)/discover')}
        />

        {loading ? (
          <ActivityIndicator color={Colors.text} style={{ marginVertical: 24 }} />
        ) : upcoming.length > 0 ? (
          <FlatList
            data={upcoming}
            horizontal
            keyExtractor={e => String(e.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <View style={styles.horizontalCard}>
                <EventCard event={item} compact />
              </View>
            )}
            scrollEnabled
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No upcoming events</Text>
          </View>
        )}

        {/* Recommended */}
        <SectionHeader
          title="Recommended for you"
          sub="Based on your interests"
        />

        {loading ? (
          <ActivityIndicator color={Colors.text} style={{ marginVertical: 24 }} />
        ) : recommended.length > 0 ? (
          <View style={styles.verticalList}>
            {recommended.map(e => (
              <EventCard key={e.id} event={e} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recommendations yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: 14,
  },
  headerText: { flex: 1, marginRight: 12 },
  headerTitle: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5, lineHeight: 28 },
  headerSub: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },
  bellBtn: {
    width: 40, height: 40,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute', top: 7, right: 8,
    width: 7, height: 7,
    borderRadius: 4,
    backgroundColor: Colors.text,
  },

  // Ticket banner
  ticketBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    padding: Spacing.base,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  ticketBannerIcon: {
    width: 44, height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ticketBannerText: { flex: 1 },
  ticketBannerTitle: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.text },
  ticketBannerSub: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 2 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text },
  sectionSub: { fontSize: 11.5, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 3 },
  sectionAction: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub },

  // Event card
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  cardCompact: { width: 240 },
  cardImage: { height: 148, backgroundColor: 'rgba(255,255,255,0.04)' },
  cardImageCompact: { height: 120 },
  cardImagePlaceholder: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  cardBody: { padding: '13px 14px 12px' as any, paddingHorizontal: 14, paddingVertical: 13 },
  cardTitle: { fontSize: 14.5, fontFamily: FontFamily.semiBold, color: Colors.text, lineHeight: 20, marginBottom: 9 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  cardMetaText: { fontSize: 12.5, fontFamily: FontFamily.regular, color: Colors.textSub },
  locationBadge: {
    paddingHorizontal: 8, paddingVertical: 1,
    borderWidth: 1, borderColor: Colors.borderMed,
    borderRadius: Radius.full,
  },
  locationBadgeText: { fontSize: 11, fontFamily: FontFamily.medium, color: Colors.text },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cardFooterText: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted },

  // Lists
  horizontalList: { paddingHorizontal: Spacing.base, gap: 12 },
  horizontalCard: {},
  verticalList: { paddingHorizontal: Spacing.base, gap: 12 },

  // Empty
  emptyState: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted },
});