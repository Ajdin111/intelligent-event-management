import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const submitting = useRef(false);

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (submitting.current) return;

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword && !currentPassword) {
      setError('Please enter your current password to set a new one.');
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Update profile info
      await api.patch('/api/auth/me', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim() || undefined,
      });

      // Update password if provided
      if (newPassword && currentPassword) {
        await api.post('/api/auth/change-password', {
          current_password: currentPassword,
          new_password: newPassword,
        });
      }

      await refreshUser();
      setSuccess('Profile updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (status === 400 && typeof detail === 'string' && detail.toLowerCase().includes('password')) {
        setError('Current password is incorrect.');
      } else if (status === 422) {
        setError('Please check your details and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  };

  const handleDeleteAccount = () => {
    setDeletePassword('');
    setDeleteError('');
    setDeleteModalVisible(true);
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/api/auth/me', { data: { password: deletePassword } });
      setDeleteModalVisible(false);
      router.replace('/(auth)/login' as any);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setDeleteError(typeof detail === 'string' ? detail : 'Incorrect password or failed to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : '??';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        {/* Success */}
        {success !== '' && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {/* Error */}
        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Personal info */}
        <Text style={styles.sectionLabel}>PERSONAL INFO</Text>
        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <Text style={styles.fieldLabel}>FIRST NAME</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
          <View style={styles.nameField}>
            <Text style={styles.fieldLabel}>LAST NAME</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>EMAIL</Text>
        <View style={styles.emailField}>
          <Text style={styles.emailText}>{user?.email}</Text>
        </View>
        <Text style={styles.emailHint}>Email address cannot be changed after registration.</Text>

        <Text style={styles.fieldLabel}>BIO <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell others a bit about yourself"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Change password */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>CHANGE PASSWORD</Text>

        <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={!showCurrent}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(v => !v)} activeOpacity={0.7}>
            <Text style={styles.eyeText}>{showCurrent ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Min. 8 characters"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={!showNew}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(v => !v)} activeOpacity={0.7}>
            <Text style={styles.eyeText}>{showNew ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat new password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)} activeOpacity={0.7}>
            <Text style={styles.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={Colors.bg} size="small" />
            : <Text style={styles.saveBtnText}>Save changes</Text>
          }
        </TouchableOpacity>

        {/* Delete account */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteBtnText}>Delete account</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Delete account</Text>
            <Text style={styles.modalSub}>
              This action cannot be undone. All your data will be permanently removed. Enter your password to confirm.
            </Text>

            {deleteError !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Your password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteBtn, deleting && styles.saveBtnDisabled]}
                onPress={confirmDeleteAccount}
                disabled={deleting}
                activeOpacity={0.85}
              >
                {deleting
                  ? <ActivityIndicator color={Colors.error} size="small" />
                  : <Text style={styles.modalDeleteText}>Delete account</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  backBtn: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },

  scroll: { paddingHorizontal: Spacing.base, paddingTop: 24, paddingBottom: 40 },

  // Avatar
  avatarWrap: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.text },

  // Feedback
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.successBg, borderWidth: 1, borderColor: Colors.success,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base,
  },
  successText: { color: Colors.success, fontSize: FontSize.sm, fontFamily: FontFamily.medium },
  errorBox: {
    backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontFamily: FontFamily.medium },

  // Section
  sectionLabel: {
    fontSize: 11, fontFamily: FontFamily.semiBold,
    color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 12,
  },

  // Fields
  nameRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  nameField: { flex: 1 },
  fieldLabel: {
    fontSize: 11.5, fontFamily: FontFamily.semiBold,
    color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 7,
  },
  optional: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },
  input: {
    height: 44, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.text, fontSize: 14, fontFamily: FontFamily.regular,
    marginBottom: 14,
  },
  bioInput: { height: 88, paddingTop: 12, lineHeight: 20 },

  // Email
  emailField: {
    height: 44, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginBottom: 6,
    justifyContent: 'center',
  },
  emailText: { fontSize: 14, fontFamily: FontFamily.regular, color: Colors.textMuted },
  emailHint: {
    fontSize: 11.5, fontFamily: FontFamily.regular,
    color: Colors.textMuted, marginBottom: 14, paddingLeft: 2,
  },

  // Password
  passwordWrap: { position: 'relative', marginBottom: 14 },
  passwordInput: { paddingRight: 60, marginBottom: 0 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontSize: FontSize.sm, fontFamily: FontFamily.medium, color: Colors.textSub },

  // Buttons
  saveBtn: {
    height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 16,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
  deleteBtn: {
    height: 46, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.error },
  
  //modal
  modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.65)',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
},
modalBox: {
  width: '100%',
  backgroundColor: Colors.card,
  borderRadius: Radius.lg,
  borderWidth: 1,
  borderColor: Colors.border,
  padding: 20,
},
modalTitle: {
  fontSize: 17,
  fontFamily: FontFamily.bold,
  color: Colors.text,
  marginBottom: 8,
},
modalSub: {
  fontSize: 13,
  fontFamily: FontFamily.regular,
  color: Colors.textSub,
  lineHeight: 19,
  marginBottom: 16,
},
modalActions: {
  flexDirection: 'row',
  gap: 10,
  marginTop: 4,
},
modalCancelBtn: {
  flex: 1,
  height: 44,
  borderRadius: Radius.md,
  borderWidth: 1,
  borderColor: Colors.borderMed,
  alignItems: 'center',
  justifyContent: 'center',
},
modalCancelText: {
  fontSize: 13.5,
  fontFamily: FontFamily.medium,
  color: Colors.text,
},
modalDeleteBtn: {
  flex: 1,
  height: 44,
  borderRadius: Radius.md,
  backgroundColor: Colors.errorBg,
  borderWidth: 1,
  borderColor: Colors.error,
  alignItems: 'center',
  justifyContent: 'center',
},
modalDeleteText: {
  fontSize: 13.5,
  fontFamily: FontFamily.semiBold,
  color: Colors.error,
},
});