import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import {
  describeKinds,
  describeLicenses,
  licenseLabel,
  sectionsByKind,
  type IndexedComponent,
  type NoticeSection,
} from '@/legal/notices';
import { NOTICES } from '@/legal/noticesFile';
import { colors, spacing, touch, type } from '@/theme';

/**
 * Riga muta, come quelle delle tracce: nome e, sotto, versione e licenza.
 * Resta un Pressable con l'evidenziazione di sfondo, la convenzione
 * Android per le righe di lista.
 */
const Row = memo(function Row({
  item,
  onPress,
}: {
  item: IndexedComponent;
  onPress: (item: IndexedComponent) => void;
}) {
  const { component } = item;
  const license = licenseLabel(component.license);
  const detail = component.version ? `${component.version} · ${license}` : license;
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${component.name}, ${detail}`}
      accessibilityHint="Apre licenza e avvisi"
    >
      <View style={styles.rowMeta}>
        <Text style={styles.rowName} numberOfLines={2}>
          {component.name}
        </Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
});

/**
 * Tutto cio' che l'APK incorpora, con licenza, titolare e testo: il gate 5
 * della nota di conformita' chiede che si legga anche senza rete. L'elenco
 * e' il file generato da `npm run notices`, incorporato nel bundle.
 */
export default function LicensesScreen() {
  const router = useRouter();
  const sections = useMemo(() => sectionsByKind(NOTICES), []);
  const open = (item: IndexedComponent) =>
    router.push({ pathname: '/licenses/[id]', params: { id: String(item.index) } });

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => String(item.index)}
      stickySectionHeadersEnabled
      initialNumToRender={24}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={touch.target}
              accessibilityRole="button"
              accessibilityLabel="Indietro"
            >
              <Ionicons name="chevron-back" size={28} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.headerTitle}>Licenze di terze parti</Text>
          </View>
          <View style={styles.intro}>
            <Text style={styles.lead}>
              Onda incorpora librerie di terze parti, ciascuna con la propria licenza. Per ogni
              componente della build trovi licenza, titolare e testo completo, anche senza rete.
            </Text>
            <Text style={styles.summary}>{describeKinds(NOTICES)}.</Text>
            <Text style={styles.summary}>Licenze: {describeLicenses(NOTICES)}.</Text>
          </View>
        </>
      }
      renderSectionHeader={({ section }: { section: NoticeSection }) => (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        </View>
      )}
      renderItem={({ item }) => <Row item={item} onPress={open} />}
    />
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
  intro: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  lead: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  summary: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  sectionTitle: { ...type.title, color: colors.text },
  sectionCount: { ...type.caption, ...type.tabular, color: colors.textMuted },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.surface },
  rowMeta: { flex: 1, gap: 2 },
  rowName: { ...type.body, color: colors.text },
  rowDetail: { ...type.caption, color: colors.textMuted },
});
