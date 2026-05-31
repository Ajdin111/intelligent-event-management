import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Field config — exact field names from backend NotificationPreferencesResponse ──

const PREF_SECTIONS = [
  {
    label: 'NOTIFICATION TYPES',
    fields: [
      { key: 'registration_confirmation', label: 'Registration confirmations' },
      { key: 'event_reminders',           label: 'Event reminders' },
      { key: 'approval_updates',          label: 'Approval updates' },
      { key: 'feedback_requests',         label: 'Feedback requests' },
      { key: 'waitlist_updates',          label: 'Waitlist updates' },
      { key: 'invite_notifications',      label: 'Invite notifications' },
      { key: 'email_enabled',             label: 'Email notifications' },
      { key: 'in_app_enabled',            label: 'In-app notifications' },
    ],
  },
];

type Prefs = Record<string, boolean>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const [prefs, setPrefs]       = useState<Prefs | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.preferences();
      setPrefs(res.data as Prefs);
    } catch {
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (key: string) => {
    setPrefs(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
  };

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    setMessage('');
    try {
      // Build payload with only the 8 preference fields — same as web
      const payload: Prefs = {};
      PREF_SECTIONS.forEach(s => s.fields.forEach(f => { payload[f.key] = prefs[f.key] ?? false; }));
      const res = await notificationsApi.updatePreferences(payload);
      setPrefs(res.data as Prefs);
      setMessage('Notification settings saved.');
    } catch {
      setMessage('Could not save notification settings right now.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.text} style={{ flex: 1 }} />
      ) : prefs === null ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Could not load notification settings.</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {PREF_SECTIONS.map(section => (
            <View key={section.label}>
              <Text style={styles.sectionLabel}>{section.label}</Text>
              <View style={styles.card}>
                {section.fields.map((field, i) => (
                  <View
                    key={field.key}
                    style={[styles.row, i < section.fields.length - 1 && styles.rowBorder]}
                  >
                    <Text style={styles.rowLabel}>{field.label}</Text>
                    <Switch
                      value={prefs[field.key] ?? false}
                      onValueChange={() => toggle(field.key)}
                      trackColor={{ false: 'rgba(255,255,255,0.12)', true: Colors.text }}
                      thumbColor={Colors.bg}
                      ios_backgroundColor="rgba(255,255,255,0.12)"
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}

          {message !== '' && (
            <Text style={[
              styles.message,
              message.includes('saved') ? styles.messageSuccess : styles.messageError,
            ]}>
              {message}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={Colors.bg} size="small" />
              : <Text style={styles.saveBtnText}>Save settings</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      )}
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
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },

  scroll: { paddingHorizontal: Spacing.base, paddingBottom: 40, paddingTop: Spacing.lg },

  sectionLabel: {
    fontSize: 11, fontFamily: FontFamily.semiBold,
    color: Colors.textMuted, letterSpacing: 0.5,
    marginBottom: 8, paddingLeft: 2, marginTop: 4,
  },
  card: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    justifyContent: 'space-between',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { fontSize: 13.5, fontFamily: FontFamily.regular, color: Colors.text, flex: 1 },

  message: {
    fontSize: FontSize.sm, fontFamily: FontFamily.medium,
    textAlign: 'center', marginTop: 12, marginBottom: 4,
  },
  messageSuccess: { color: Colors.success },
  messageError:   { color: Colors.error },

  saveBtn: {
    height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText:  { fontSize: FontSize.base, fontFamily: FontFamily.semiBold, color: Colors.text },
  retryBtn:   { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.accentBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  retryText:  { fontSize: FontSize.sm, fontFamily: FontFamily.semiBold, color: Colors.text },
});
