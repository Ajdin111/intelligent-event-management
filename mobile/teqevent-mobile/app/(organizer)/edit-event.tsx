import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
interface FormData {
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  location_type: 'physical' | 'online' | 'hybrid';
  physical_address: string;
  online_link: string;
  capacity: string;
  registration_type: 'automatic' | 'manual' | 'invite_only';
  is_free: boolean;
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, multiline, keyboardType, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any; hint?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="sentences"
        autoCorrect={false}
      />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

// ─── Chip selector ────────────────────────────────────────────────────────────
function ChipSelector<T extends string>({ label, options, value, onChange }: {
  label: string; options: { key: T; label: string }[];
  value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, value === o.key && styles.chipActive]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, value === o.key && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = parseInt(id);
  const submittingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '18:00',
    location_type: 'physical',
    physical_address: '',
    online_link: '',
    capacity: '',
    registration_type: 'automatic',
    is_free: true,
  });

  // Load existing event data
  useEffect(() => {
    eventsApi.detail(eventId)
      .then(res => {
        const e: Event = res.data;
        const startDt = new Date(e.start_datetime);
        const endDt = new Date(e.end_datetime);

        const padDate = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const padTime = (d: Date) =>
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        setForm({
          title: e.title,
          description: e.description,
          start_date: padDate(startDt),
          start_time: padTime(startDt),
          end_date: padDate(endDt),
          end_time: padTime(endDt),
          location_type: e.location_type,
          physical_address: e.physical_address ?? '',
          online_link: e.online_link ?? '',
          capacity: e.capacity ? String(e.capacity) : '',
          registration_type: e.registration_type,
          is_free: e.is_free,
        });
      })
      .catch(() => setError('Failed to load event.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const update = (key: keyof FormData, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleSave = async (publish?: boolean) => {
    if (submittingRef.current) return;
    if (!form.title.trim()) { setError('Event name is required.'); return; }
    if (!form.start_date.trim()) { setError('Start date is required.'); return; }
    if (!form.end_date.trim()) { setError('End date is required.'); return; }

    submittingRef.current = true;
    setSaving(true);
    setError('');

    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim(),
        start_datetime: `${form.start_date}T${form.start_time}:00`,
        end_datetime: `${form.end_date}T${form.end_time}:00`,
        location_type: form.location_type,
        registration_type: form.registration_type,
        is_free: form.is_free,
        has_ticketing: !form.is_free,
      };

      if (form.physical_address.trim()) payload.physical_address = form.physical_address.trim();
      if (form.online_link.trim()) payload.online_link = form.online_link.trim();
      if (form.capacity.trim()) payload.capacity = parseInt(form.capacity);

      await eventsApi.update(eventId, payload);

      if (publish) await eventsApi.publish(eventId);

      Alert.alert(
        'Saved!',
        publish ? 'Event has been published.' : 'Event updated successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to save event.');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete event',
      'Are you sure you want to delete this event? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await eventsApi.delete(eventId);
              router.replace('/(organizer)/events' as any);
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit event</Text>
        <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Basic info */}
        <Text style={styles.sectionLabel}>BASIC INFO</Text>
        <Field label="EVENT NAME" value={form.title} onChange={v => update('title', v)} placeholder="Event name" />
        <Field label="DESCRIPTION" value={form.description} onChange={v => update('description', v)} placeholder="Description" multiline />

        {/* Schedule */}
        <Text style={styles.sectionLabel}>SCHEDULE</Text>
        <Field label="START DATE" value={form.start_date} onChange={v => update('start_date', v)} placeholder="YYYY-MM-DD" hint="Format: 2026-06-15" />
        <Field label="START TIME" value={form.start_time} onChange={v => update('start_time', v)} placeholder="HH:MM" />
        <Field label="END DATE" value={form.end_date} onChange={v => update('end_date', v)} placeholder="YYYY-MM-DD" hint="Format: 2026-06-15" />
        <Field label="END TIME" value={form.end_time} onChange={v => update('end_time', v)} placeholder="HH:MM" />

        {/* Location */}
        <Text style={styles.sectionLabel}>LOCATION</Text>
        <ChipSelector
          label="FORMAT"
          options={[
            { key: 'physical', label: 'In-person' },
            { key: 'online', label: 'Online' },
            { key: 'hybrid', label: 'Hybrid' },
          ]}
          value={form.location_type}
          onChange={v => update('location_type', v)}
        />
        {(form.location_type === 'physical' || form.location_type === 'hybrid') && (
          <Field label="ADDRESS" value={form.physical_address} onChange={v => update('physical_address', v)} placeholder="e.g. Sarajevo, Bosnia" />
        )}
        {(form.location_type === 'online' || form.location_type === 'hybrid') && (
          <Field label="ONLINE LINK" value={form.online_link} onChange={v => update('online_link', v)} placeholder="https://..." />
        )}

        {/* Settings */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <Field label="CAPACITY (OPTIONAL)" value={form.capacity} onChange={v => update('capacity', v)} placeholder="e.g. 500" keyboardType="number-pad" />
        <ChipSelector
          label="REGISTRATION TYPE"
          options={[
            { key: 'automatic', label: 'Automatic' },
            { key: 'manual', label: 'Manual' },
            { key: 'invite_only', label: 'Invite only' },
          ]}
          value={form.registration_type}
          onChange={v => update('registration_type', v)}
        />
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Free event</Text>
            <Text style={styles.toggleSub}>No ticket purchase required</Text>
          </View>
          <Switch
            value={form.is_free}
            onValueChange={v => update('is_free', v)}
            trackColor={{ false: Colors.border, true: Colors.text }}
            thumbColor={Colors.bg}
          />
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={() => handleSave(false)}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={Colors.bg} size="small" />
            : <Text style={styles.saveBtnText}>Save changes</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.publishBtn, saving && styles.btnDisabled]}
          onPress={() => handleSave(true)}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.publishBtnText}>Save & publish</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },
  scroll: { paddingHorizontal: Spacing.base, paddingTop: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.textMuted,
    letterSpacing: 0.5, marginBottom: 12, marginTop: 8,
  },
  errorBox: {
    backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontFamily: FontFamily.medium },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 11.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 7 },
  fieldHint: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 5 },
  input: {
    height: 44, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.text, fontSize: 14, fontFamily: FontFamily.regular,
  },
  inputMulti: { height: 100, paddingTop: 12, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderMed },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textSub },
  chipTextActive: { color: Colors.bg },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginBottom: 16,
  },
  toggleText: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.text },
  toggleSub: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },
  saveBtn: {
    height: 48, borderRadius: Radius.md, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  saveBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
  publishBtn: {
    height: 46, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderMed,
    alignItems: 'center', justifyContent: 'center',
  },
  publishBtnText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.text },
  btnDisabled: { opacity: 0.6 },
});