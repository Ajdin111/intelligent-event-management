import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export default function RegisterScreen() {
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  const handleRegister = async () => {
    if (submitting.current) return;
    submitting.current = true;

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      submitting.current = false;
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      submitting.current = false;
      return;
    }

    setError('');
    setLoading(true);

    try {
      await register(email.trim(), password, firstName.trim(), lastName.trim());
    } catch (e: any) {
      const status = e?.response?.status;
      if (!e?.response) {
        setError('Network error. Check your connection and try again.');
      } else if (status === 400) {
        setError('An account with this email already exists.');
      } else if (status === 422) {
        setError('Please check your details and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <Text style={styles.brandLight}>Teq</Text>
            <Text style={styles.brandBold}>Event</Text>
          </View>

          <Text style={styles.heading}>Create account</Text>
          <Text style={styles.sub}>Join TeqEvent to discover and manage events</Text>

          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={styles.fieldLabel}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Alex"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            <View style={styles.nameField}>
              <Text style={styles.fieldLabel}>LAST NAME</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Smith"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.bg} size="small" />
              : <Text style={styles.btnLabel}>Create account</Text>
            }
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 40, paddingBottom: 28 },
  brandRow: { flexDirection: 'row', marginBottom: 36, marginTop: 16 },
  brandLight: { fontSize: 22, fontFamily: FontFamily.regular, color: Colors.text, letterSpacing: -0.3 },
  brandBold: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.3 },
  heading: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.4, marginBottom: 6 },
  sub: { fontSize: 13.5, fontFamily: FontFamily.regular, color: Colors.textSub, marginBottom: 24 },
  errorBox: { backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontFamily: FontFamily.medium },
  nameRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  nameField: { flex: 1 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 11.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 7 },
  input: { height: 44, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.text, fontSize: 14, fontFamily: FontFamily.regular },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 60 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontSize: FontSize.sm, fontFamily: FontFamily.medium, color: Colors.textSub },
  btn: { height: 48, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  btnDisabled: { opacity: 0.6 },
  btnLabel: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'auto', paddingTop: 32 },
  footerText: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub },
  footerLink: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.text },
});
