import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExternalLink } from '@/components/ExternalLink';
import { Empty } from '@/components/StateViews';
import { describeOrigin, licenseLabel, parseComponentIndex, textsOf } from '@/legal/notices';
import { NOTICES } from '@/legal/noticesFile';
import { colors, radius, spacing, touch, type } from '@/theme';

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} selectable>
        {value}
      </Text>
    </View>
  );
}

/**
 * Un componente dell'elenco: chi e', con quale licenza, dove sta nell'APK
 * e i testi per esteso, licenza e NOTICE. I testi si selezionano e si
 * copiano; sono a spaziatura fissa perche' sono impaginati cosi' negli
 * originali, con intestazioni centrate a colpi di spazi.
 */
export default function LicenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = parseComponentIndex(id, NOTICES);

  if (!found) {
    return (
      <View style={styles.screen}>
        <Empty
          title="Componente non trovato"
          hint="Il collegamento non corrisponde a nessuna voce dell'elenco."
          action={{ label: 'Torna alle licenze', onPress: () => router.navigate('/licenses') }}
        />
      </View>
    );
  }

  const { component } = found;
  const texts = textsOf(NOTICES, component);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={touch.target}
          accessibilityRole="button"
          accessibilityLabel="Indietro"
        >
          <Ionicons name="chevron-back" size={28} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.headerTitle}>Licenza</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.name} selectable>
          {component.name}
        </Text>
        {component.version ? (
          <Text style={styles.version}>Versione {component.version}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Meta label="Licenza" value={licenseLabel(component.license)} />
        {component.holder ? <Meta label="Titolare" value={component.holder} /> : null}
        <Meta label="Nell’APK" value={describeOrigin(component)} />
        {component.url ? <ExternalLink label="Sito del progetto" url={component.url} /> : null}
      </View>

      {texts.map((entry) => (
        <View key={entry.id} style={styles.section}>
          <Text style={styles.sectionTitle}>
            {entry.role === 'notice' ? 'Avviso (NOTICE)' : 'Testo della licenza'}
          </Text>
          <Text style={styles.licenseText} selectable>
            {entry.text}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl * 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...type.title, color: colors.text },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  name: { ...type.title, color: colors.text },
  version: { ...type.caption, color: colors.accent, marginTop: spacing.xs },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionTitle: { ...type.title, color: colors.text },
  meta: { gap: 2 },
  metaLabel: { ...type.caption, color: colors.textMuted },
  metaValue: { ...type.body, color: colors.text, lineHeight: 22 },
  licenseText: { fontFamily: 'monospace', fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
