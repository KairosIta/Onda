import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { JamendoCredentialForm, JamendoGuide } from '@/components/SourceCredentials';
import { finishWelcome, useSources } from '@/store/sources';
import { colors, radius, spacing, touch, type } from '@/theme';

/**
 * Il primo avvio. Onda non incorpora credenziali: Audius parte subito,
 * Jamendo quando la persona inserisce il proprio Client ID. Chi non ha
 * tempo ora salta, e in Scopri trova un invito finche' non configura
 * Jamendo o non lo chiude.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { credentials } = useSources();
  const ready = credentials.jamendoClientId !== '';

  const done = (): void => {
    finishWelcome();
    router.replace('/');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        Benvenuto in Onda
      </Text>
      <Text style={styles.lead}>
        Onda riproduce musica da due cataloghi aperti, senza account Onda. Le credenziali che
        inserisci restano su questo telefono, cifrate.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audius</Text>
        <Text style={styles.body}>Già attivo: funziona subito, senza dati da inserire.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Jamendo</Text>
        <Text style={styles.body}>
          Musica con licenze Creative Commons. Serve un Client ID personale, gratuito per uso non
          commerciale.
        </Text>
        <JamendoCredentialForm />
        {ready ? null : <JamendoGuide />}
      </View>

      <PressableScale
        onPress={done}
        haptic="tap"
        containerStyle={styles.ctaSlot}
        style={[styles.cta, ready && styles.ctaReady]}
        accessibilityRole="button"
        accessibilityHint={ready ? undefined : 'Potrai aggiungere Jamendo più tardi da Libreria'}
      >
        <Text style={[styles.ctaText, ready && styles.ctaReadyText]}>
          {ready ? 'Inizia ad ascoltare' : 'Salta per ora'}
        </Text>
      </PressableScale>
      {ready ? null : (
        <Text style={styles.hint}>
          Potrai aggiungere Jamendo quando vuoi da Libreria › Sorgenti.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  title: { ...type.display, color: colors.text },
  lead: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  section: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionTitle: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  ctaSlot: { marginTop: spacing.sm },
  cta: {
    minHeight: touch.target.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
  },
  ctaReady: { backgroundColor: colors.accent },
  ctaText: { ...type.label, color: colors.text },
  ctaReadyText: { color: colors.bg },
  hint: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
});
