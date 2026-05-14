import { useState } from 'react';
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

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401) {
        setError('Incorrect email or password.');
      } else if (status === 422) {
        setError('Please enter a valid email address.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
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

          <Text style={styles.heading}>Sign in</Text>
          <Text style={styles.sub}>Enter your credentials to continue</Text>

          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

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
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.bg} size="small" />
              : <Text style={styles.btnLabel}>Sign in</Text>
            }
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Create one</Text>
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
  brandRow: { flexDirection: 'row', marginBottom: 48, marginTop: 32 },
  brandLight: { fontSize: 22, fontFamily: FontFamily.regular, color: Colors.text, letterSpacing: -0.3 },
  brandBold: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.3 },
  heading: { fontSize: 28, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.4, marginBottom: 6 },
  sub: { fontSize: 13.5, fontFamily: FontFamily.regular, color: Colors.textSub, marginBottom: 30 },
  errorBox: { backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontFamily: FontFamily.medium },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 11.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 7 },
  input: { height: 44, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.text, fontSize: 14, fontFamily: FontFamily.regular },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 60 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontSize: FontSize.sm, fontFamily: FontFamily.medium, color: Colors.textSub },
  btn: { height: 48, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  btnDisabled: { opacity: 0.6 },
  btnLabel: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'auto', paddingTop: 32 },
  footerText: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub },
  footerLink: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.text },
});
