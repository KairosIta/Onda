import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AUDIUS_API_PLANS_URL,
  AUDIUS_API_TERMS_URL,
  AUDIUS_PRIVACY_URL,
  JAMENDO_API_TERMS_URL,
  JAMENDO_DEVPORTAL_URL,
  JAMENDO_PRIVACY_URL,
  PROJECT_URL,
} from '@/config/legal';
import {
  afterJamendoCheck,
  audiusApiKeyProblem,
  JAMENDO_CHECK_MESSAGES,
  type JamendoCheck,
  jamendoClientIdProblem,
  maskCredential,
  normalizeCredential,
} from '@/services/sourceSettings';
import { checkJamendoClientId } from '@/services/sources/jamendo';
import { setCredential, useSources } from '@/store/sources';
import { colors, radius, spacing, touch, type } from '@/theme';
import { ExternalLink } from './ExternalLink';
import { PressableScale } from './PressableScale';

type Tone = 'ok' | 'warn' | 'error';
interface Feedback {
  tone: Tone;
  text: string;
}

const TONE: Record<JamendoCheck, Tone> = {
  ok: 'ok',
  'rate-limited': 'warn',
  invalid: 'error',
  suspended: 'error',
  unreachable: 'warn',
  error: 'error',
};

const SAVE_FAILED = 'Non riesco a salvarlo sul telefono. Riprova.';

function Button({
  label,
  onPress,
  primary,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const off = Boolean(busy || disabled);
  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      haptic="tap"
      style={[styles.button, primary && styles.primary, off && styles.off]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: Boolean(busy) }}
    >
      {busy ? <ActivityIndicator size="small" color={primary ? colors.bg : colors.text} /> : null}
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </PressableScale>
  );
}

function Message({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  return (
    <Text
      style={[styles.message, styles[feedback.tone]]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      {feedback.text}
    </Text>
  );
}

const inputProps = {
  autoCapitalize: 'none',
  autoCorrect: false,
  spellCheck: false,
  importantForAutofill: 'no',
  keyboardType: 'visible-password',
  placeholderTextColor: colors.textMuted,
} as const;

/**
 * Le liste in cache sono state chieste con le sorgenti di prima: dopo un
 * cambio si rifanno, cosi' una sorgente appena accesa compare e una spenta
 * sparisce senza aspettare che scadano.
 */
export function useRefreshCatalog(): () => void {
  const queryClient = useQueryClient();
  return () => {
    queryClient.resetQueries().catch(() => {});
  };
}

/**
 * Inserimento e verifica del Client ID Jamendo. Prima di salvare fa una
 * sola richiesta: un ID che Jamendo rifiuta non si salva, uno valido si',
 * e senza risposta decide la persona.
 */
export function JamendoCredentialForm({ onSaved }: { onSaved?: () => void }) {
  const { credentials } = useSources();
  const refresh = useRefreshCatalog();
  const saved = credentials.jamendoClientId;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);

  const store = (value: string, message: Feedback): void => {
    try {
      setCredential('jamendoClientId', value);
    } catch {
      setFeedback({ tone: 'error', text: SAVE_FAILED });
      return;
    }
    setDraft('');
    setUnverified(null);
    setFeedback(message);
    refresh();
    onSaved?.();
  };

  const verify = async (value: string): Promise<JamendoCheck> => {
    setBusy(true);
    try {
      return await checkJamendoClientId(value);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (): Promise<void> => {
    const problem = jamendoClientIdProblem(draft);
    if (problem) {
      setFeedback({ tone: 'error', text: problem });
      return;
    }
    const value = normalizeCredential(draft);
    const check = await verify(value);
    const message = { tone: TONE[check], text: JAMENDO_CHECK_MESSAGES[check] };
    const next = afterJamendoCheck(check);
    if (next === 'save') store(value, message);
    else {
      setFeedback(message);
      setUnverified(next === 'ask' ? value : null);
    }
  };

  const recheck = async (): Promise<void> => {
    const check = await verify(saved);
    setFeedback({ tone: TONE[check], text: JAMENDO_CHECK_MESSAGES[check] });
  };

  const remove = (): void => {
    store('', { tone: 'ok', text: 'Client ID rimosso: Jamendo è spento.' });
  };

  if (saved) {
    return (
      <View style={styles.form}>
        <Text style={styles.saved} accessibilityLabel="Client ID salvato">
          Client ID {maskCredential(saved)}
        </Text>
        <View style={styles.row}>
          <Button label="Verifica" onPress={recheck} busy={busy} />
          <Button label="Rimuovi" onPress={remove} disabled={busy} />
        </View>
        <Message feedback={feedback} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <TextInput
        {...inputProps}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setUnverified(null);
        }}
        placeholder="Client ID Jamendo"
        accessibilityLabel="Client ID Jamendo"
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={submit}
        editable={!busy}
      />
      <View style={styles.row}>
        <Button
          label="Verifica e salva"
          onPress={submit}
          primary
          busy={busy}
          disabled={!draft.trim()}
        />
        {unverified ? (
          <Button
            label="Salva comunque"
            onPress={() =>
              store(unverified, {
                tone: 'warn',
                text: 'Salvato senza verifica: se Jamendo non risponde, ricontrollalo da qui.',
              })
            }
          />
        ) : null}
      </View>
      <Message feedback={feedback} />
    </View>
  );
}

/** Come si ottiene un Client ID, con le condizioni che Jamendo vi lega. */
export function JamendoGuide() {
  return (
    <View style={styles.guide}>
      <Text style={styles.guideTitle}>Come ottenere il Client ID</Text>
      <Text style={styles.body}>
        1. Accedi al portale sviluppatori Jamendo: Jamendo ammette un solo account per persona.
      </Text>
      <Text style={styles.body}>
        2. Crea un’applicazione. Nella descrizione indica il link a Onda: {PROJECT_URL}
      </Text>
      <Text style={styles.body}>3. Copia qui il Client ID dell’applicazione.</Text>
      <Text style={styles.note}>
        Il Client ID è personale: non condividerlo. Jamendo lo concede gratis per uso non
        commerciale, fino a 35.000 richieste al mese per applicazione. Registrando l’applicazione
        accetti i termini API di Jamendo come sviluppatore.
      </Text>
      <ExternalLink label="Portale sviluppatori Jamendo" url={JAMENDO_DEVPORTAL_URL} />
      <ExternalLink label="Termini API Jamendo" url={JAMENDO_API_TERMS_URL} />
      <ExternalLink label="Privacy Jamendo" url={JAMENDO_PRIVACY_URL} />
    </View>
  );
}

/**
 * API key Audius facoltativa. Audius non offre un modo di verificarla (una
 * chiave sbagliata riceve le stesse risposte di nessuna chiave): qui si
 * controlla solo la forma.
 */
export function AudiusKeyForm() {
  const { credentials } = useSources();
  const refresh = useRefreshCatalog();
  const saved = credentials.audiusApiKey;
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const store = (value: string, text: string): void => {
    try {
      setCredential('audiusApiKey', value);
    } catch {
      setFeedback({ tone: 'error', text: SAVE_FAILED });
      return;
    }
    setDraft('');
    setFeedback({ tone: 'ok', text });
    refresh();
  };

  const submit = (): void => {
    const problem = audiusApiKeyProblem(draft);
    if (problem) {
      setFeedback({ tone: 'error', text: problem });
      return;
    }
    store(normalizeCredential(draft), 'API key salvata.');
  };

  return (
    <View style={styles.form}>
      <Text style={styles.body}>
        Facoltativa: con una tua API key Audius concede limiti di richieste più alti. Non inserire
        mai l’API Secret o un Bearer token.
      </Text>
      {saved ? (
        <>
          <Text style={styles.saved} accessibilityLabel="API key salvata">
            API key {maskCredential(saved)}
          </Text>
          <View style={styles.row}>
            <Button label="Rimuovi" onPress={() => store('', 'API key rimossa.')} />
          </View>
        </>
      ) : (
        <>
          <TextInput
            {...inputProps}
            value={draft}
            onChangeText={setDraft}
            placeholder="API key Audius"
            accessibilityLabel="API key Audius"
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.row}>
            <Button label="Salva" onPress={submit} disabled={!draft.trim()} />
          </View>
        </>
      )}
      <Message feedback={feedback} />
      <ExternalLink label="Crea una API key Audius" url={AUDIUS_API_PLANS_URL} />
      <ExternalLink label="Termini API Audius" url={AUDIUS_API_TERMS_URL} />
      <ExternalLink label="Privacy Audius" url={AUDIUS_PRIVACY_URL} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: touch.target.minHeight,
    color: colors.text,
    ...type.body,
  },
  saved: { ...type.label, color: colors.text, ...type.tabular },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touch.target.minHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
  },
  primary: { backgroundColor: colors.accent },
  off: { opacity: 0.5 },
  buttonText: { ...type.label, color: colors.text },
  primaryText: { color: colors.bg },
  message: { ...type.body, lineHeight: 22 },
  ok: { color: colors.text },
  warn: { color: colors.accent },
  error: { color: colors.danger },
  guide: { gap: spacing.sm },
  guideTitle: { ...type.label, color: colors.text },
  body: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  note: { ...type.caption, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.xs },
});
