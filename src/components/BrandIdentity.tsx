import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '@/theme';

/** Il marchio resta testo nativo: nitido, scalabile e leggibile da TalkBack. */
export function BrandIdentity({ large = false }: { large?: boolean }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Spivra by Andrea Spina"
    >
      <Image
        source={require('../../assets/brand/spivra-mark.png')}
        style={large ? styles.markLarge : styles.mark}
        contentFit="contain"
        accessible={false}
      />
      <View style={styles.nameSlot}>
        <Text
          style={[styles.name, large && styles.nameLarge]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          Spivra
        </Text>
        <Text style={styles.signature}>by Andrea Spina</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: { width: 44, height: 44 },
  markLarge: { width: 64, height: 64 },
  nameSlot: { flex: 1, minWidth: 0 },
  name: { ...type.brand, color: colors.text },
  nameLarge: { fontSize: 44 },
  signature: { ...type.caption, color: colors.textMuted, letterSpacing: 0.6 },
});
