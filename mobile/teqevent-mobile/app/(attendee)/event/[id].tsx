import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi, reviewsApi, Event, Review } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TicketTier {
  id: number;
  name: string;
  price: string;
  description?: string;
  quantity: number;
  quantity_sold: number;
  quantity_available: number;
  is_sold_out: boolean;
  is_active: boolean;
}

// ─── Detail Row ───────────────────────────────────────────────────────────────
function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon as any} size={16} color={Colors.textSub} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────
function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  const tabs = ['about', 'tickets', 'reviews'];
  return (
    <View style={styles.tabBar}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t}
          style={styles.tabItem}
          onPress={() => onChange(t)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, active === t && styles.tabLabelActive]}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Text>
          {active === t && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── About Tab ───────────────────────────────────────────────────────────────
function AboutTab({ event }: { event: Event }) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.description}>{event.description}</Text>

      {event.online_link && (
        <View style={[styles.infoBox, { marginTop: 16 }]}>
          <Ionicons name="link-outline" size={14} color={Colors.textSub} />
          <Text style={styles.infoBoxText} numberOfLines={1}>{event.online_link}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Tickets Tab ─────────────────────────────────────────────────────────────
function TicketsTab({ tiers, loading }: { tiers: TicketTier[]; loading: boolean }) {
  if (loading) return <ActivityIndicator color={Colors.text} style={{ marginTop: 24 }} />;

  if (tiers.length === 0) {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.emptyText}>No ticket tiers available.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.tabContent, { gap: 10 }]}>
      {tiers.map(tier => {
        const progress = tier.quantity > 0 ? tier.quantity_sold / tier.quantity : 0;
        return (
          <View key={tier.id} style={[styles.tierCard, !tier.is_active && styles.tierCardInactive]}>
            <View style={styles.tierHeader}>
              <Text style={styles.tierName}>{tier.name}</Text>
              <Text style={styles.tierPrice}>
                {parseFloat(tier.price) === 0 ? 'Free' : `$${parseFloat(tier.price).toFixed(2)}`}
              </Text>
            </View>
            {tier.description && (
              <Text style={styles.tierDesc}>{tier.description}</Text>
            )}
            {/* Progress bar */}
            <View style={styles.tierProgress}>
              <View style={[styles.tierProgressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
            </View>
            <Text style={styles.tierMeta}>
              {tier.quantity_sold}/{tier.quantity} sold · {tier.quantity_available} left
            </Text>
            {tier.is_sold_out && (
              <Text style={styles.tierSoldOut}>Sold out</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Reviews Tab ─────────────────────────────────────────────────────────────
function ReviewsTab({ reviews, loading, eventId }: { reviews: Review[]; loading: boolean; eventId: number }) {
  if (loading) return <ActivityIndicator color={Colors.text} style={{ marginTop: 24 }} />;

  const avg = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <View style={styles.tabContent}>
      <TouchableOpacity
      style={styles.leaveReviewBtn}
      onPress={() => router.push(`/(attendee)/event/feedback?id=${eventId}` as any)}
      activeOpacity={0.85}
      >
        <Ionicons name="star-outline" size={15} color={Colors.bg} />
        <Text style={styles.leaveReviewBtnText}>Leave a review</Text>
        </TouchableOpacity>
      {avg && (
        <View style={styles.ratingHeader}>
          <Text style={styles.ratingScore}>{avg}</Text>
          <View>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(i => (
                <Ionicons
                  key={i}
                  name={i <= Math.round(parseFloat(avg)) ? 'star' : 'star-outline'}
                  size={14}
                  color={Colors.text}
                />
              ))}
            </View>
            <Text style={styles.ratingCount}>Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>No reviews yet.</Text>
      ) : (
        <View style={{ gap: 16 }}>
          {reviews.map((r, i) => (
            <View key={r.id} style={[styles.reviewItem, i < reviews.length - 1 && styles.reviewBorder]}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewName}>
                  {r.is_anonymous ? 'Anonymous' : `User #${r.user_id}`}
                </Text>
                <Text style={styles.reviewDate}>
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Ionicons
                    key={i}
                    name={i <= r.rating ? 'star' : 'star-outline'}
                    size={12}
                    color={Colors.text}
                  />
                ))}
              </View>
              {r.comment && <Text style={styles.reviewBody}>{r.comment}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = parseInt(id);

  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState('about');
  const [loading, setLoading] = useState(true);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState('');

  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  const fetchReviews = useCallback(() => {
    setReviewsLoading(true);
    reviewsApi.eventReviews(eventId)
      .then(res => setReviews(res.data))
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [eventId]);

  useEffect(() => {
    eventsApi.detail(eventId)
      .then(res => setEvent(res.data))
      .catch(() => setError('Failed to load event.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (tab === 'tickets' && tiers.length === 0) {
      setTiersLoading(true);
      eventsApi.ticketTiers(eventId)
        .then(res => setTiers(res.data))
        .catch(() => {})
        .finally(() => setTiersLoading(false));
    }
    if (tab === 'reviews' && reviews.length === 0) {
      fetchReviews();
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      if (tabRef.current === 'reviews') {
        fetchReviews();
      }
    }, [fetchReviews])
  );

  const handleShare = async () => {
    if (!event) return;
    await Share.share({ message: `Check out ${event.title} on TeqEvent!` });
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getLocation = (event: Event) => {
    if (event.location_type === 'online') return 'Online';
    if (event.physical_address) return event.physical_address;
    return event.location_type === 'hybrid' ? 'Hybrid' : 'In-person';
  };

  const getMinPrice = () => {
    if (!event) return '';
    if (event.is_free) return 'Free';
    if (tiers.length > 0) {
      const min = Math.min(...tiers.map(t => parseFloat(t.price)));
      return `From $${min.toFixed(2)}`;
    }
    return 'Paid';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.text} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (error || !event) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{error || 'Event not found.'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: Colors.textSub, fontFamily: FontFamily.medium }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Hero image area */}
        <View style={styles.hero}>
          <View style={styles.heroPlaceholder} />
          {/* Gradient overlay */}
          <View style={styles.heroGradient} />

          {/* Back button */}
          <SafeAreaView style={styles.heroNav}>
            <TouchableOpacity style={styles.heroBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={20} color={Colors.text} />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Title overlay */}
          <View style={styles.heroTitle}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>EVENT</Text>
            </View>
            <Text style={styles.heroName}>{event.title}</Text>
          </View>
        </View>

        {/* Detail rows */}
        <View style={styles.detailRows}>
          <DetailRow
            icon="calendar-outline"
            label="Date & time"
            value={formatDateTime(event.start_datetime)}
          />
          <DetailRow
            icon="location-outline"
            label="Location"
            value={getLocation(event)}
          />
          {event.capacity && (
            <DetailRow
              icon="people-outline"
              label="Capacity"
              value={`${event.capacity.toLocaleString()} spots`}
            />
          )}
          <DetailRow
            icon="ticket-outline"
            label="Registration"
            value={event.registration_type.replace('_', ' ')}
          />
        </View>

        {/* Tab bar */}
        <TabBar active={tab} onChange={setTab} />

        {/* Tab content */}
        {tab === 'about' && <AboutTab event={event} />}
        {tab === 'tickets' && <TicketsTab tiers={tiers} loading={tiersLoading} />}
        {tab === 'reviews' && <ReviewsTab reviews={reviews} loading={reviewsLoading} eventId={eventId} />}
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPrice}>
          <Text style={styles.bottomPriceLabel}>FROM</Text>
          <Text style={styles.bottomPriceValue}>{getMinPrice()}</Text>
        </View>
        <TouchableOpacity
          style={styles.registerBtn}
          activeOpacity={0.85}
          onPress={() => router.push(`/(attendee)/event/register?id=${eventId}` as any)}
        >
          <Text style={styles.registerBtnText}>Register →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  // Hero
  hero: { height: 240, position: 'relative' },
  heroPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulated gradient using multiple overlays
  },
  heroNav: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 8,
  },
  heroBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    position: 'absolute', bottom: 14, left: 16, right: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6, marginBottom: 8,
  },
  categoryBadgeText: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.text },
  heroName: {
    fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text,
    letterSpacing: -0.4, lineHeight: 28,
  },

  // Detail rows
  detailRows: { padding: Spacing.base, gap: 10 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  detailIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  detailText: { flex: 1 },
  detailLabel: {
    fontSize: 10.5, fontFamily: FontFamily.semiBold,
    color: Colors.textMuted, letterSpacing: 0.5,
  },
  detailValue: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.text, marginTop: 2 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.base,
    marginTop: 4,
  },
  tabItem: { marginRight: 22, paddingBottom: 10, position: 'relative' },
  tabLabel: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textMuted },
  tabLabelActive: { color: Colors.text, fontFamily: FontFamily.semiBold },
  tabIndicator: {
    position: 'absolute', bottom: -1, left: 0, right: 0,
    height: 2, backgroundColor: Colors.text, borderRadius: 1,
  },

  // Tab content
  tabContent: { padding: Spacing.base },
  description: {
    fontSize: 13.5, fontFamily: FontFamily.regular,
    color: Colors.textSub, lineHeight: 22,
  },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  infoBoxText: { flex: 1, fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub },

  // Ticket tiers
  tierCard: {
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  tierCardInactive: { opacity: 0.5 },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  tierName: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text },
  tierPrice: { fontSize: 14, fontFamily: FontFamily.bold, color: Colors.text },
  tierDesc: { fontSize: 12.5, fontFamily: FontFamily.regular, color: Colors.textSub, marginBottom: 10 },
  tierProgress: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2, overflow: 'hidden', marginBottom: 6,
  },
  tierProgressFill: { height: '100%', backgroundColor: Colors.text, borderRadius: 2 },
  tierMeta: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },
  tierSoldOut: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.error, marginTop: 4 },

  // Reviews
  ratingHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 18,
    paddingBottom: 16, borderBottomWidth: 1,
    borderBottomColor: Colors.border, marginBottom: 16,
  },
  ratingScore: { fontSize: 36, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  stars: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  ratingCount: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub },
  reviewItem: { paddingBottom: 16 },
  reviewBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 16 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  reviewName: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text },
  reviewDate: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },
  reviewBody: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub, lineHeight: 20, marginTop: 7 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingTop: 12, paddingBottom: 28,
    backgroundColor: Colors.bg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  bottomPrice: { flex: 1 },
  bottomPriceLabel: { fontSize: 10.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  bottomPriceValue: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.text, marginTop: 2 },
  registerBtn: {
    flex: 1.4, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  registerBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },

  // States
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: FontSize.base, fontFamily: FontFamily.regular, color: Colors.textMuted },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted },

  //feedback 
  leaveReviewBtn: {
  flexDirection: 'row', alignItems: 'center', gap: 7,
  height: 40, borderRadius: Radius.md,
  backgroundColor: Colors.accent,
  justifyContent: 'center', marginBottom: 20,
},
leaveReviewBtnText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.bg },
});