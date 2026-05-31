import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserRole } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

const ROLE_META: Record<UserRole, { label: string; sub: string; icon: string }> = {
  attendee: { label: 'Attendee',  sub: 'Browse and register for events', icon: 'person-outline' },
  organizer:{ label: 'Organizer', sub: 'Create and manage your events',  icon: 'calendar-outline' },
  admin:    { label: 'Admin',     sub: 'Platform-wide oversight',         icon: 'shield-outline' },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  activeRole: UserRole;
  availableRoles: UserRole[];
  onSelect: (role: UserRole) => void;
}

export function RoleSwitcherSheet({ visible, onClose, activeRole, availableRoles, onSelect }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Switch view</Text>
        <Text style={styles.sub}>You have access to multiple panels</Text>

        <View style={styles.list}>
          {availableRoles.map((r, i) => {
            const meta = ROLE_META[r];
            const isActive = r === activeRole;
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.item,
                  i < availableRoles.length - 1 && styles.itemBorder,
                  isActive && styles.itemActive,
                ]}
                onPress={() => onSelect(r)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                  <Ionicons
                    name={meta.icon as any}
                    size={18}
                    color={isActive ? Colors.bg : Colors.textSub}
                  />
                </View>
                <View style={styles.itemText}>
                  <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>
                    {meta.label}
                  </Text>
                  <Text style={styles.itemSub}>{meta.sub}</Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark" size={16} color={Colors.text} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 36,
    paddingHorizontal: Spacing.base,
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: Colors.borderMed,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 20,
  },
  title: {
    fontSize: 17, fontFamily: FontFamily.bold,
    color: Colors.text, textAlign: 'center',
  },
  sub: {
    fontSize: FontSize.sm, fontFamily: FontFamily.regular,
    color: Colors.textMuted, textAlign: 'center',
    marginTop: 4, marginBottom: 20,
  },
  list: {
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden',
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: Colors.accentBg },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  iconWrapActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  itemText: { flex: 1 },
  itemLabel: {
    fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text,
  },
  itemLabelActive: { color: Colors.text },
  itemSub: {
    fontSize: 11.5, fontFamily: FontFamily.regular,
    color: Colors.textMuted, marginTop: 2,
  },
  cancelBtn: {
    height: 46, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14, fontFamily: FontFamily.medium, color: Colors.textSub,
  },
});
