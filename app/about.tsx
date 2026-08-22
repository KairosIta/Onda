import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AUDIUS_API_TERMS_URL,
  AUDIUS_OPEN_MUSIC_LICENSE_URL,
  AUDIUS_PRIVACY_URL,
  AUDIUS_TERMS_URL,
  JAMENDO_API_TERMS_URL,
  JAMENDO_PRIVACY_URL,
  PRIVACY_POLICY_URL,
  PROJECT_URL,
  THIRD_PARTY_CONTENT_URL,
} from '@/config/legal';
import { colors, radius, spacing, type } from '@/theme';

const version = Constants.expoConfig?.version ?? '0.1.0';

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={`${label}, apre il browser`}
    >
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="open-outline" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function AboutScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Indietro">
          <Ionicons name="chevron-back" size={28} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.headerTitle}>Informazioni e privacy</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.appName}>Onda</Text>
        <Text style={styles.version}>Versione {version}</Text>
        <Text style={styles.lead}>Un player musicale locale, senza account Onda.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>I tuoi dati</Text>
        <Text style={styles.body}>
          Preferiti, cronologia, playlist e preferenze di riproduzione restano nello spazio privato
          dell’app. Onda non integra pubblicità, analytics o segnalazioni automatiche dei crash.
        </Text>
        <Text style={styles.body}>
          Il backup cloud e il trasferimento Android dei dati dell’app sono disabilitati. Puoi
          eliminare tutti i dati cancellando l’archiviazione di Onda dalle impostazioni Android o
          disinstallando l’app.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connessioni esterne</Text>
        <Text style={styles.body}>
          Per cercare e riprodurre musica, Onda contatta Audius, Jamendo e gli host dei rispettivi
          contenuti. Questi servizi ricevono i normali dati tecnici della connessione, come
          indirizzo IP e dettagli della richiesta, secondo le proprie informative.
        </Text>
        <ExternalLink label="Privacy Audius" url={AUDIUS_PRIVACY_URL} />
        <ExternalLink label="Privacy Jamendo" url={JAMENDO_PRIVACY_URL} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Musica e licenze</Text>
        <Text style={styles.body}>
          La licenza MIT riguarda il codice di Onda, non musica, artwork o metadati. Nel player è
          indicata la sorgente del brano, il regime di diritti dichiarato, il collegamento alla
          pagina originale e, per Jamendo, alla licenza Creative Commons specifica.
        </Text>
        <ExternalLink label="Condizioni generali Audius" url={AUDIUS_TERMS_URL} />
        <ExternalLink label="Termini API Audius" url={AUDIUS_API_TERMS_URL} />
        <ExternalLink label="Open Music License Audius" url={AUDIUS_OPEN_MUSIC_LICENSE_URL} />
        <ExternalLink label="Termini API Jamendo" url={JAMENDO_API_TERMS_URL} />
        <ExternalLink label="Nota sui contenuti di terze parti" url={THIRD_PARTY_CONTENT_URL} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documenti e progetto</Text>
        <ExternalLink label="Informativa privacy completa" url={PRIVACY_POLICY_URL} />
        <ExternalLink label="Codice sorgente e segnalazioni" url={PROJECT_URL} />
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
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  appName: { ...type.display, color: colors.text },
  version: { ...type.caption, color: colors.accent, marginTop: spacing.xs },
  lead: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
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
  body: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
  },
  pressed: { opacity: 0.65 },
  linkText: { ...type.body, flex: 1, color: colors.text },
});
