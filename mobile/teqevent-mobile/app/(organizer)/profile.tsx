import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export default function ProfileScreen() {
  const { user, role, logout, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.regular }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const firstName = user.first_name ?? '';
  const lastName = user.last_name ?? '';
  const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || '?';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || user.email;

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  const settingsItems = [
    { label: 'Edit profile', icon: 'person-outline', onPress: () => {} },
    { label: 'Notifications', icon: 'notifications-outline', onPress: () => {} },
    { label: 'Privacy & security', icon: 'shield-outline', onPress: () => {} },
    { label: 'Help & support', icon: 'help-circle-outline', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.sub}>Manage your account</Text>
        </View>

        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{role}</Text>
          </View>
        </View>

        {/* Settings */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.menuCard}>
          {settingsItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < settingsItems.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon as any} size={18} color={Colors.textSub} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        {/* App version */}
        <Text style={styles.version}>TeqEvent v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: 40 },

  header: { paddingTop: Spacing.md, paddingBottom: Spacing.base },
  title: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.5 },
  sub: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textSub, marginTop: 4 },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontFamily: FontFamily.bold, color: Colors.text },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },
  userEmail: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderMed,
  },
  roleBadgeText: { fontSize: 11, fontFamily: FontFamily.medium, color: Colors.textSub, textTransform: 'capitalize' },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 4,
  },

  // Menu
  menuCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon: { marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 13.5, fontFamily: FontFamily.regular, color: Colors.text },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    marginBottom: Spacing.lg,
  },
  signOutText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.error },

  version: { textAlign: 'center', fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },
});