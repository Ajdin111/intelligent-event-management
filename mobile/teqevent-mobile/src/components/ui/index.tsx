import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Screen ──────────────────────────────────────────────────────────────────
interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, scroll = false, style, contentStyle }: ScreenProps) {
  const inner = (
    <View style={[styles.screenContent, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, style]}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {inner}
        </ScrollView>
      ) : inner}
    </SafeAreaView>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.btn,
        styles[`btn_${variant}`],
        styles[`btn_${size}`],
        isDisabled && styles.btn_disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.bg : Colors.text} size="small" />
      ) : (
        <Text style={[styles.btnLabel, styles[`btnLabel_${variant}`], styles[`btnLabel_${size}`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Typography ──────────────────────────────────────────────────────────────
interface TypographyProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export const H1 = ({ children, style }: TypographyProps) => (
  <Text style={[styles.h1, style]}>{children}</Text>
);
export const H2 = ({ children, style }: TypographyProps) => (
  <Text style={[styles.h2, style]}>{children}</Text>
);
export const H3 = ({ children, style }: TypographyProps) => (
  <Text style={[styles.h3, style]}>{children}</Text>
);
export const Body = ({ children, style }: TypographyProps) => (
  <Text style={[styles.body, style]}>{children}</Text>
);
export const Caption = ({ children, style }: TypographyProps) => (
  <Text style={[styles.caption, style]}>{children}</Text>
);

// ─── Divider ─────────────────────────────────────────────────────────────────
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Screen
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: Spacing.base,
  },

  // Card
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },

  // Button base
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    flexDirection: 'row',
  },
  btn_disabled: { opacity: 0.45 },

  // Button variants
  btn_primary: { backgroundColor: Colors.accent },
  btn_secondary: { backgroundColor: Colors.accentBg, borderWidth: 1, borderColor: Colors.border },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_danger: { backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error },

  // Button sizes
  btn_sm: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, minHeight: 36 },
  btn_md: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg, minHeight: 48 },
  btn_lg: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, minHeight: 56 },

  // Button labels
  btnLabel: { fontFamily: FontFamily.semiBold },
  btnLabel_primary: { color: Colors.bg },
  btnLabel_secondary: { color: Colors.text },
  btnLabel_ghost: { color: Colors.text },
  btnLabel_danger: { color: Colors.error },
  btnLabel_sm: { fontSize: FontSize.sm },
  btnLabel_md: { fontSize: FontSize.base },
  btnLabel_lg: { fontSize: FontSize.md },

  // Typography
  h1: { color: Colors.text, fontSize: FontSize.xxl, fontFamily: FontFamily.bold, lineHeight: FontSize.xxl * 1.2 },
  h2: { color: Colors.text, fontSize: FontSize.xl, fontFamily: FontFamily.bold, lineHeight: FontSize.xl * 1.25 },
  h3: { color: Colors.text, fontSize: FontSize.md, fontFamily: FontFamily.semiBold, lineHeight: FontSize.md * 1.3 },
  body: { color: Colors.textSub, fontSize: FontSize.base, fontFamily: FontFamily.regular, lineHeight: FontSize.base * 1.5 },
  caption: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: FontFamily.regular },

  // Divider
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
});
