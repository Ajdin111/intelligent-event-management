import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize } from '@/constants/theme';

interface PlaceholderScreenProps {
  title: string;
  phase: number;
}

/**
 * Temporary placeholder used for all screens not yet built.
 * Replace this with the real screen implementation when building that feature PR.
 */
export function PlaceholderScreen({ title, phase }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>Coming in Phase {phase}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontFamily: FontFamily.semiBold,
  },
  sub: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    marginTop: 8,
  },
});
