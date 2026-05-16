import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Filters {
  location_type: string;
  category_id: number | null;
  price: 'all' | 'free' | 'paid';
  date: 'anytime' | 'this_week' | 'this_month' | 'next_3_months';
}

const DEFAULT_FILTERS: Filters = {
  location_type: 'All',
  category_id: null,
  price: 'all',
  date: 'anytime',
};

const LOCATION_TYPES = ['All', 'physical', 'online', 'hybrid'];
const LOCATION_LABELS: Record<string, string> = {
  All: 'All', physical: 'In-person', online: 'Online', hybrid: 'Hybrid',
};

const DATE_OPTIONS: { key: Filters['date']; label: string }[] = [
  { key: 'anytime', label: 'Anytime' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'next_3_months', label: 'Next 3 months' },
];

const PRICE_OPTIONS: { key: Filters['price']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid' },
];

// ─── Date filter logic ────────────────────────────────────────────────────────
function isWithinDate(isoDate: string, filter: Filters['date']): boolean {
  if (filter === 'anytime') return true;
  const now = new Date();
  const date = new Date(isoDate);
  if (filter === 'this_week') {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    return date >= now && date <= weekEnd;
  }
  if (filter === 'this_month') {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  if (filter === 'next_3_months') {
    const threeMonths = new Date(now);
    threeMonths.setMonth(now.getMonth() + 3);
    return date >= now && date <= threeMonths;
  }
  return true;
}

// ─── Active filter count ──────────────────────────────────────────────────────
function activeFilterCount(f: Filters): number {
  let count = 0;
  if (f.location_type !== 'All') count++;
  if (f.category_id !== null) count++;
  if (f.price !== 'all') count++;
  if (f.date !== 'anytime') count++;
  return count;
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({
  event,
  categoryName,
}: {
  event: Event;
  categoryName: string;
}) {
  const spotsLeft = event.capacity ?? null;
  const location = event.location_type === 'physical'
    ? event.physical_address ?? 'In-person'
    : event.location_type === 'online'
    ? 'Online'
    : event.physical_address ?? 'Hybrid';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => {}}>
      {/* Image area with overlaid badges */}
      <View style={styles.cardImage}>
        <View style={styles.cardImagePlaceholder} />
        {/* Category badge top-left */}
        {categoryName ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{categoryName}</Text>
          </View>
        ) : null}
        {/* Price badge top-right */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>
            {event.is_free ? 'Free' : 'Paid'}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>

        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.cardMetaText}>
            {new Date(event.start_datetime).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.cardMeta}>
          <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.cardMetaText} numberOfLines={1}>{location}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        {spotsLeft !== null ? (
          <Text style={styles.spotsText}>
            <Text style={styles.spotsBold}>{spotsLeft}</Text> spots left
          </Text>
        ) : (
          <View />
        )}
        <TouchableOpacity style={styles.registerBtn} activeOpacity={0.8} onPress={() => {}}>
          <Text style={styles.registerBtnText}>Register →</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Filter Row ───────────────────────────────────────────────────────────────
function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
function FilterSheet({
  visible,
  filters,
  categories,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  categories: { id: number; name: string }[];
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>(filters);

  // Sync when reopened
  useEffect(() => {
    if (visible) setLocal(filters);
  }, [visible]);

  const handleReset = () => {
    setLocal(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.sheetReset}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Location */}
            <FilterSection label="LOCATION">
              {LOCATION_TYPES.map(lt => (
                <Chip
                  key={lt}
                  label={LOCATION_LABELS[lt]}
                  active={local.location_type === lt}
                  onPress={() => setLocal(p => ({ ...p, location_type: lt }))}
                />
              ))}
            </FilterSection>

            {/* Date */}
            <FilterSection label="DATE">
              {DATE_OPTIONS.map(o => (
                <Chip
                  key={o.key}
                  label={o.label}
                  active={local.date === o.key}
                  onPress={() => setLocal(p => ({ ...p, date: o.key }))}
                />
              ))}
            </FilterSection>

            {/* Price */}
            <FilterSection label="PRICE">
              {PRICE_OPTIONS.map(o => (
                <Chip
                  key={o.key}
                  label={o.label}
                  active={local.price === o.key}
                  onPress={() => setLocal(p => ({ ...p, price: o.key }))}
                />
              ))}
            </FilterSection>

            {/* Category */}
            <FilterSection label="CATEGORY">
              <Chip
                label="All"
                active={local.category_id === null}
                onPress={() => setLocal(p => ({ ...p, category_id: null }))}
              />
              {categories.map(c => (
                <Chip
                  key={c.id}
                  label={c.name}
                  active={local.category_id === c.id}
                  onPress={() => setLocal(p => ({ ...p, category_id: c.id }))}
                />
              ))}
            </FilterSection>
          </ScrollView>

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => { onApply(local); onClose(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.applyBtnText}>Show results</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Category name lookup map
  const categoryMap: Record<number, string> = Object.fromEntries(
    categories.map(c => [c.id, c.name])
  );

  const getCategoryName = (event: Event): string => {
    if (!event.category_ids?.length) return '';
    return categoryMap[event.category_ids[0]] ?? '';
  };

  // Fetch categories
  useEffect(() => {
    eventsApi.categories().then(res => setCategories(res.data ?? [])).catch(() => {});
  }, []);

  // Fetch all events once
  useEffect(() => {
    eventsApi.list({ limit: 100, status: 'published' })
      .then(res => {
        const items = res.data.items ?? [];
        setAllEvents(items);
        setEvents(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter locally
  useEffect(() => {
    let filtered = [...allEvents];

    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(e => e.title.toLowerCase().includes(q));
    }
    if (filters.location_type !== 'All') {
      filtered = filtered.filter(e => e.location_type === filters.location_type);
    }
    if (filters.category_id !== null) {
      filtered = filtered.filter(e => e.category_ids?.includes(filters.category_id!));
    }
    if (filters.price === 'free') {
      filtered = filtered.filter(e => e.is_free);
    } else if (filters.price === 'paid') {
      filtered = filtered.filter(e => !e.is_free);
    }
    if (filters.date !== 'anytime') {
      filtered = filtered.filter(e => isWithinDate(e.start_datetime, filters.date));
    }

    setEvents(filtered);
  }, [query, filters, allEvents]);

  const filtersActive = activeFilterCount(filters);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.sub}>
          {loading ? 'Loading…' : `${events.length} event${events.length !== 1 ? 's' : ''} found`}
        </Text>
      </View>

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search events…"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, filtersActive > 0 && styles.filterBtnActive]}
          onPress={() => setFilterOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={18} color={Colors.textSub} />
          {filtersActive > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filtersActive}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip
          label="All"
          active={filters.category_id === null}
          onPress={() => setFilters(f => ({ ...f, category_id: null }))}
        />
        {categories.map(c => (
          <Chip
            key={c.id}
            label={c.name}
            active={filters.category_id === c.id}
            onPress={() => setFilters(f => ({ ...f, category_id: c.id }))}
          />
        ))}
      </ScrollView>

      {/* Results */}
      <View style={styles.results}>
        {loading ? (
          <ActivityIndicator color={Colors.text} style={{ marginTop: 40 }} />
        ) : events.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No events found</Text>
            <Text style={styles.emptyText}>Try a different search or filter</Text>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={e => String(e.id)}
            renderItem={({ item }) => (
              <EventCard event={item} categoryName={getCategoryName(item)} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </View>

      <FilterSheet
        visible={filterOpen}
        filters={filters}
        categories={categories}
        onApply={setFilters}
        onClose={() => setFilterOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: 14 },
  title: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  sub: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.base, paddingBottom: 12 },
  searchBox: {
    flex: 1, height: 42, flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 13.5, fontFamily: FontFamily.regular },
  filterBtn: {
    width: 42, height: 42,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { borderColor: Colors.text, backgroundColor: 'rgba(255,255,255,0.08)' },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.text,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontFamily: FontFamily.bold, color: Colors.bg },

  chipsScroll: { flexGrow: 0 },
  chipsRow: { paddingHorizontal: Spacing.base, paddingBottom: 10, paddingTop: 2, gap: 8, alignItems: 'center' },

  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.borderMed,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.text },
  chipTextActive: { color: Colors.bg },

  results: { flex: 1 },
  list: { paddingHorizontal: Spacing.base, paddingTop: 8, paddingBottom: 32 },

  // Card
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, overflow: 'hidden',
  },
  cardImage: {
    height: 130,
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  cardImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  categoryBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  categoryBadgeText: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.text },
  priceBadge: {
    position: 'absolute', top: 10, right: 10,
  },
  priceBadgeText: {
    fontSize: 12, fontFamily: FontFamily.semiBold, color: Colors.text,
  },
  cardBody: { paddingHorizontal: 14, paddingTop: 13, paddingBottom: 10 },
  cardTitle: { fontSize: 14.5, fontFamily: FontFamily.semiBold, color: Colors.text, lineHeight: 20, marginBottom: 9 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  cardMetaText: { fontSize: 12.5, fontFamily: FontFamily.regular, color: Colors.textSub, flex: 1 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  spotsText: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub },
  spotsBold: { fontFamily: FontFamily.semiBold, color: Colors.text },
  registerBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderMed,
  },
  registerBtnText: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text },

  // Filter sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderColor: Colors.border,
    padding: 20, paddingBottom: 36,
    maxHeight: '85%',
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.borderMed, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 17, fontFamily: FontFamily.bold, color: Colors.text },
  sheetReset: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub },
  filterSection: { marginBottom: 22 },
  filterLabel: { fontSize: 10.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.6, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  applyBtn: { height: 46, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  applyBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontFamily: FontFamily.semiBold, color: Colors.text },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted },
});