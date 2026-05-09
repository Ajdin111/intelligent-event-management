import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize } from '@/constants/theme';

export default function EventsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Events</Text>
      <Text style={styles.sub}>Coming in Phase 4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: Colors.text, fontSize: FontSize.xl, fontFamily: FontFamily.semiBold },
  sub: { color: Colors.textMuted, fontSize: FontSize.sm, fontFamily: FontFamily.regular, marginTop: 8 },
});
