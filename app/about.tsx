import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExternalLink } from '@/components/ExternalLink';
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
import { describeBuild, readBuildInfo } from '@/services/buildInfo';
import { colors, radius, spacing, touch, type } from '@/theme';

const build = readBuildInfo();

export default function AboutScreen() {
  const router = useRouter();

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
        <Text style={styles.headerTitle}>Informazioni e privacy</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.appName}>Onda</Text>
        <Text style={styles.version}>Versione {build.version}</Text>
        {/* Fra due build personali dello stesso pomeriggio la versione e'
            identica: il commit e' l'unica cosa che le distingue, e da qui
            si legge senza collegare il telefono al computer. */}
        <Text style={styles.build} selectable>
          {describeBuild(build)}
        </Text>
        <Text style={styles.lead}>Un player musicale locale, senza account Onda.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>I tuoi dati</Text>
        <Text style={styles.body}>
          Preferiti, cronologia, playlist, preferenze di riproduzione, l’ultima coda con la
          posizione raggiunta e una copia temporanea dei cataloghi Jamendo consultati restano nello
          spazio privato dell’app; i cataloghi Audius restano solo in memoria finché l’app è aperta.
          Le credenziali delle sorgenti sono cifrate e vanno solo al servizio a cui appartengono.
          Onda non integra pubblicità, analytics o segnalazioni automatiche dei crash.
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
  build: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs },
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
});
