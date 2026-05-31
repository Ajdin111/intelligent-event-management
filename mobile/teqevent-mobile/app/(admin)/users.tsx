import { useEffect, useState, useCallback } from 'react';
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
import { useAuth } from '@/context/AuthContext';
import { adminApi } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

type RoleFilter = 'all' | 'organizer' | 'admin';

function getInitials(first = '', last = '') {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?';
}

function getRoleLabel(u: any): string {
  if (u.is_admin) return 'Admin';
  if (u.is_organizer) return 'Organizer';
  return 'Attendee';
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  onToggleActive,
  onDelete,
  isSelf,
}: {
  user: any;
  onToggleActive: () => void;
  onDelete: () => void;
  isSelf: boolean;
}) {
  const role = getRoleLabel(user);
  const roleColor = user.is_admin ? Colors.warning : user.is_organizer ? Colors.info : Colors.textMuted;

  return (
    <View style={styles.userRow}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>{getInitials(user.first_name, user.last_name)}</Text>
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.first_name} {user.last_name}
          {isSelf && <Text style={styles.youBadge}> (you)</Text>}
        </Text>
        <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
        <View style={styles.userMeta}>
          <Text style={[styles.roleTag, { color: roleColor }]}>{role}</Text>
          <Text style={[styles.statusTag, { color: user.is_active ? Colors.success : Colors.error }]}>
            {user.is_active ? '● Active' : '● Inactive'}
          </Text>
        </View>
      </View>

      {!isSelf && (
        <View style={styles.userActions}>
          <TouchableOpacity onPress={onToggleActive} style={styles.actionBtn}>
            <Ionicons
              name={user.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
              size={22}
              color={user.is_active ? Colors.warning : Colors.success}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminUsersScreen() {
  const { user: me } = useAuth();
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(false);
  const [users, setUsers]           = useState<any[]>([]);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(false);
    try {
      const res = await adminApi.users();
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filter — API search is optional; we filter locally for speed
  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    const matchRole =
      roleFilter === 'all' ||
      (roleFilter === 'admin' && u.is_admin) ||
      (roleFilter === 'organizer' && u.is_organizer && !u.is_admin);
    return matchSearch && matchRole;
  });

  const stats = {
    total:      users.length,
    active:     users.filter(u => u.is_active).length,
    organizers: users.filter(u => u.is_organizer && !u.is_admin).length,
    admins:     users.filter(u => u.is_admin).length,
  };

  const toggleActive = (target: any) => {
    const action = target.is_active ? 'deactivate' : 'activate';
    Alert.alert(
      `${target.is_active ? 'Deactivate' : 'Activate'} user`,
      `Are you sure you want to ${action} ${target.first_name} ${target.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: target.is_active ? 'Deactivate' : 'Activate',
          style: target.is_active ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const res = target.is_active
                ? await adminApi.deactivateUser(target.id)
                : await adminApi.activateUser(target.id);
              setUsers(list => list.map(u => u.id === target.id ? { ...u, is_active: (res.data as any).is_active } : u));
            } catch {
              Alert.alert('Error', `Failed to ${action} user.`);
            }
          },
        },
      ]
    );
  };

  const deleteUser = (target: any) => {
    Alert.alert(
      'Delete user',
      `Permanently delete ${target.first_name} ${target.last_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deleteUser(target.id);
              setUsers(list => list.filter(u => u.id !== target.id));
            } catch {
              Alert.alert('Error', 'Failed to delete user.');
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
          <Text style={styles.errorText}>Failed to load users</Text>
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
        <Text style={styles.headerTitle}>Users</Text>
        <Text style={styles.headerSub}>{stats.total.toLocaleString()} total</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Active',      value: stats.active },
          { label: 'Organizers',  value: stats.organizers },
          { label: 'Admins',      value: stats.admins },
          { label: 'Inactive',    value: stats.total - stats.active },
        ].map(s => (
          <View key={s.label} style={styles.statChip}>
            <Text style={styles.statChipValue}>{s.value}</Text>
            <Text style={styles.statChipLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email…"
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

      {/* Role filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'organizer', 'admin'] as RoleFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setRoleFilter(f)}
            style={[styles.chip, roleFilter === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, roleFilter === f && styles.chipTextActive]}>
              {f === 'all' ? 'All' : f === 'organizer' ? 'Organizers' : 'Admins'}
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
            <Text style={styles.emptyText}>No users match your filter.</Text>
          </View>
        ) : filtered.map((u, i) => (
          <View key={u.id}>
            <UserRow
              user={u}
              isSelf={u.id === me?.id}
              onToggleActive={() => toggleActive(u)}
              onDelete={() => deleteUser(u)}
            />
            {i < filtered.length - 1 && <View style={styles.divider} />}
          </View>
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
    paddingHorizontal: Spacing.base, marginBottom: 14,
  },
  statChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  statChipValue: { fontSize: 15, fontFamily: FontFamily.bold, color: Colors.text },
  statChipLabel: { fontSize: 10, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.base, marginBottom: 10,
    height: 42, paddingHorizontal: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  searchInput: {
    flex: 1, fontSize: FontSize.base, fontFamily: FontFamily.regular,
    color: Colors.text,
  },

  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: Spacing.base, marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive:    { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText:      { fontSize: FontSize.sm, fontFamily: FontFamily.medium, color: Colors.textSub },
  chipTextActive:{ color: Colors.bg },

  list: { paddingHorizontal: Spacing.base, paddingBottom: 32 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentBg, alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text },
  userInfo: { flex: 1, minWidth: 0 },
  userName:  { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text },
  youBadge:  { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted },
  userEmail: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 1 },
  userMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  roleTag:   { fontSize: 11, fontFamily: FontFamily.medium },
  statusTag: { fontSize: 11, fontFamily: FontFamily.medium },
  userActions: { flexDirection: 'row', gap: 4 },
  actionBtn:   { padding: 6 },

  divider: { height: 1, backgroundColor: Colors.border },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 16 },
  errorText: { fontSize: FontSize.base, fontFamily: FontFamily.semiBold, color: Colors.text },
  emptyText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textMuted },
  retryBtn:  { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.accentBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  retryText: { fontSize: FontSize.sm, fontFamily: FontFamily.semiBold, color: Colors.text },
});
