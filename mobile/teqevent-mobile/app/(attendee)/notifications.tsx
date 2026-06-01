import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi, Notification } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Type config — mirrors web TopBar NOTIF_ICONS ─────────────────────────────

const TYPE_CONFIG: Record<string, { bg: string; color: string; icon: string }> = {
  registration_confirmation: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', icon: 'checkmark' },
  approval:                  { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', icon: 'checkmark' },
  rejection:                 { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', icon: 'close' },
  reminder:                  { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', icon: 'time-outline' },
  feedback_request:          { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', icon: 'star-outline' },
  waitlist_notification:     { bg: 'rgba(99,102,241,0.15)', color: '#818cf8', icon: 'arrow-up' },
  invite:                    { bg: 'rgba(99,102,241,0.15)', color: '#818cf8', icon: 'mail-outline' },
};

const DEFAULT_CONFIG = { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', icon: 'notifications-outline' };

function fmtTime(iso: string) {
  if (!iso) return '';
  const diffMs   = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7)  return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotifRow({
  notif,
  onPress,
}: {
  notif: Notification;
  onPress: () => void;
}) {
  const cfg = TYPE_CONFIG[notif.type] ?? DEFAULT_CONFIG;

  return (
    <TouchableOpacity
      style={[styles.row, !notif.is_read && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowTitle, !notif.is_read && styles.rowTitleUnread]}
            numberOfLines={1}
          >
            {notif.title}
          </Text>
          <Text style={styles.rowTime}>{fmtTime(notif.created_at)}</Text>
        </View>
        <Text style={styles.rowMessage} numberOfLines={2}>{notif.message}</Text>
      </View>

      {!notif.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await notificationsApi.list();
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = (id: number) => {
    notificationsApi.markRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAll = () => {
    notificationsApi.markAllRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handlePress = (notif: Notification) => {
    markRead(notif.id);
    if (notif.event_id) {
      router.push(`/(attendee)/event/${notif.event_id}` as any);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAll} activeOpacity={0.7}>
            <Text style={styles.markAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.text} style={{ flex: 1 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={Colors.textMuted}
            />
          }
        >
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptySub}>No notifications yet.</Text>
            </View>
          ) : (
            notifications.map((n, i) => (
              <View key={n.id}>
                <NotifRow notif={n} onPress={() => handlePress(n)} />
                {i < notifications.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
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
  markAllBtn: { fontSize: 12.5, fontFamily: FontFamily.medium, color: Colors.textSub, width: 80, textAlign: 'right' },

  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.base, paddingVertical: 14,
    gap: 12,
  },
  rowUnread: { backgroundColor: 'rgba(255,255,255,0.025)' },
  iconWrap: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  rowTitle:      { flex: 1, fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.text },
  rowTitleUnread:{ fontFamily: FontFamily.semiBold },
  rowTime:  { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, flexShrink: 0 },
  rowMessage: { fontSize: 12.5, fontFamily: FontFamily.regular, color: Colors.textSub, lineHeight: 18 },
  unreadDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: Colors.text, marginTop: 6, flexShrink: 0,
  },

  divider: { height: 1, backgroundColor: Colors.border },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 10 },
  emptyTitle: { fontSize: FontSize.base, fontFamily: FontFamily.semiBold, color: Colors.text, marginTop: 8 },
  emptySub:   { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted },
});
