import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  AudiusKeyForm,
  JamendoCredentialForm,
  JamendoGuide,
  useRefreshCatalog,
} from '@/components/SourceCredentials';
import { setSourceEnabled, useSources } from '@/store/sources';
import { colors, radius, spacing, touch, type } from '@/theme';
import type { SourceId } from '@/types/track';

/**
 * Le sorgenti di Onda: un interruttore per ciascuna e le credenziali che
 * la persona inserisce. Onda non ne incorpora nessuna.
 */
export default function SourcesScreen() {
  const router = useRouter();
  const { settings, credentials, active } = useSources();
  const refresh = useRefreshCatalog();

  const toggle = (id: SourceId, enabled: boolean): void => {
    setSourceEnabled(id, enabled);
    refresh();
  };

  const status = (id: SourceId): string => {
    if (active[id]) return 'Attiva';
    if (!settings.enabled[id]) return 'Spenta';
    return 'Da configurare: serve il Client ID';
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={touch.target}
          accessibilityRole="button"
          accessibilityLabel="Indietro"
        >
          <Ionicons name="chevron-back" size={28} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.headerTitle}>Sorgenti</Text>
      </View>

      <Text style={styles.lead}>
        Onda riproduce i cataloghi di Audius e Jamendo. Le credenziali che inserisci restano su
        questo telefono, cifrate, e vanno solo al servizio a cui appartengono.
      </Text>

      <View style={styles.section}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.sectionTitle}>Audius</Text>
            <Text style={styles.status}>{status('audius')}</Text>
          </View>
          <Switch
            value={settings.enabled.audius}
            onValueChange={(value) => toggle('audius', value)}
            trackColor={{ false: colors.border, true: colors.accentDim }}
            thumbColor={settings.enabled.audius ? colors.accent : colors.textMuted}
            accessibilityLabel="Audius"
          />
        </View>
        <Text style={styles.body}>Funziona subito, senza dati da inserire.</Text>
        <AudiusKeyForm />
      </View>

      <View style={styles.section}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.sectionTitle}>Jamendo</Text>
            <Text style={[styles.status, !credentials.jamendoClientId && styles.pending]}>
              {status('jamendo')}
            </Text>
          </View>
          {/* Senza Client ID l'interruttore non accenderebbe niente: compare
              quando c'e' qualcosa da accendere. */}
          {credentials.jamendoClientId ? (
            <Switch
              value={settings.enabled.jamendo}
              onValueChange={(value) => toggle('jamendo', value)}
              trackColor={{ false: colors.border, true: colors.accentDim }}
              thumbColor={settings.enabled.jamendo ? colors.accent : colors.textMuted}
              accessibilityLabel="Jamendo"
            />
          ) : null}
        </View>
        <Text style={styles.body}>
          Musica con licenze Creative Commons. Serve un Client ID personale, gratuito per uso non
          commerciale.
        </Text>
        <JamendoCredentialForm />
        {credentials.jamendoClientId ? null : <JamendoGuide />}
      </View>
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
  lead: {
    ...type.body,
    color: colors.textMuted,
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleText: { flex: 1, gap: spacing.xs },
  sectionTitle: { ...type.title, color: colors.text },
  status: { ...type.caption, color: colors.textMuted },
  pending: { color: colors.accent },
  body: { ...type.body, color: colors.textMuted, lineHeight: 22 },
});
