import { QueryClientProvider } from '@tanstack/react-query';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createQueryClient } from '@/services/queryClient';
import { setupPlayer } from '@/services/setupPlayer';
import { startNotificationPermissionWatch } from '@/store/notificationPermission';
import { colors, radius, spacing, type } from '@/theme';

// Reidratato da MMKV prima del primo render: vedi services/queryClient.
const queryClient = createQueryClient();

/**
 * Senza, un errore di render e' una schermata bianca e basta: l'app smette
 * di funzionare e non dice ne' cosa e' successo ne' come uscirne. Per
 * qualcosa che si usa tutti i giorni e' il guasto peggiore, perche' non
 * lascia niente da cui ripartire.
 *
 * expo-router monta questo al posto del sottoalbero rotto e passa `retry`,
 * che lo rimonta senza riavviare il processo. Esportandolo dal layout
 * radice copre tutte le schermate sotto.
 *
 * Il messaggio dell'errore si mostra sempre, non solo in sviluppo: e' un
 * player privato, e "TypeError: undefined is not a function" e' comunque
 * piu' utile di "ops, qualcosa e' andato storto". La pila resta invece ai
 * soli build di sviluppo, dove esiste una mappa dei sorgenti per leggerla.
 */
/**
 * La pila di Hermes ripete l'URL completo del bundle a ogni frame
 * (`(http://localhost:8081/index.bundle//&platform=android&dev=true&...)`):
 * quattro righe a frame, che sommergono l'unica cosa che serve — il nome
 * della funzione e il file. I numeri dentro l'URL sono offset nel bundle,
 * non righe del sorgente, quindi togliendoli non si perde niente.
 */
const readableStack = (stack: string): string => stack.replace(/\s*\(https?:\/\/[^)]*\)/g, '');

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.crash}>
      <Text style={styles.crashTitle}>Qualcosa si è rotto</Text>
      <Text style={styles.crashHint}>
        La schermata non è riuscita a disegnarsi. La riproduzione in corso non si ferma.
      </Text>

      <Text style={styles.crashError}>{error.message || String(error)}</Text>

      {__DEV__ && error.stack ? (
        <ScrollView style={styles.crashStack}>
          <Text style={styles.crashStackText}>{readableStack(error.stack)}</Text>
        </ScrollView>
      ) : null}

      <Pressable
        onPress={() => {
          retry();
        }}
        style={({ pressed }) => [styles.crashButton, pressed && styles.crashButtonOff]}
        accessibilityRole="button"
      >
        <Text style={styles.crashButtonText}>Riprova</Text>
      </Pressable>
    </View>
  );
}

/**
 * Il player nativo non si e' avviato: senza, nessuna schermata ha senso.
 * `setupPlayer` dopo un errore si lascia richiamare, quindi Riprova ritenta
 * davvero; il messaggio si può selezionare e copiare per una segnalazione.
 */
function PlayerSetupFailed({
  error,
  retrying,
  onRetry,
}: {
  error: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <View style={styles.crash}>
      <Text style={styles.crashTitle}>Il player non si è avviato</Text>
      <Text style={styles.crashHint}>
        Senza il player nativo Onda non può riprodurre niente. Riprova; se succede ancora, copia il
        messaggio qui sotto e segnalalo.
      </Text>

      <Text style={styles.crashError} selectable accessibilityLabel={`Errore: ${error}`}>
        {error}
      </Text>

      <Pressable
        onPress={onRetry}
        disabled={retrying}
        style={({ pressed }) => [
          styles.crashButton,
          (pressed || retrying) && styles.crashButtonOff,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: retrying, busy: retrying }}
      >
        <Text style={styles.crashButtonText}>{retrying ? 'Riprovo…' : 'Riprova'}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [error, setError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Un contatore invece di una funzione nell'effetto: ogni Riprova lo
  // incrementa e l'effetto riparte, senza setState sincroni al montaggio.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setupPlayer()
      .then(() => {
        if (!alive) return;
        setError(null);
        setPlayerReady(true);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setRetrying(false));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = () => {
    setRetrying(true);
    setAttempt((n) => n + 1);
  };

  // Da Android 13 la notifica del player non compare senza permesso e
  // nessuno lo segnala. Il permesso si chiede al primo play (playerCommands,
  // useQueue): qui si controlla soltanto lo stato, anche tornando dalle
  // impostazioni, per far sparire l'avviso nel player.
  useEffect(() => startNotificationPermissionWatch(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <SafeAreaView style={styles.root} edges={['top']}>
            {error && !playerReady ? (
              <PlayerSetupFailed error={error} retrying={retrying} onRetry={retry} />
            ) : null}

            {/* Il MiniPlayer non sta piu' qui: vive dentro la tab bar
                custom di (tabs)/_layout.tsx, cosi' resta sopra i tab. */}
            {playerReady ? (
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="player"
                  options={{
                    // Il player si chiude trascinandolo: sotto deve intravedersi
                    // la schermata precedente, quindi la route e' trasparente e
                    // lo sfondo lo mette il player stesso. Lo Stack imposta uno
                    // sfondo opaco per tutti: qui va sovrascritto.
                    presentation: 'transparentModal',
                    animation: 'slide_from_bottom',
                    contentStyle: { backgroundColor: 'transparent' },
                  }}
                />
                <Stack.Screen
                  name="queue"
                  options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                />
                <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
              </Stack>
            ) : null}
          </SafeAreaView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  crash: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  crashTitle: { ...type.display, color: colors.text },
  crashHint: { ...type.body, color: colors.textMuted },
  crashError: {
    ...type.caption,
    color: colors.danger,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderLeftWidth: 2,
    borderLeftColor: colors.danger,
  },
  crashStack: { maxHeight: 220 },
  crashStackText: { ...type.caption, color: colors.textMuted, fontSize: 10, lineHeight: 15 },
  crashButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  crashButtonOff: { opacity: 0.6 },
  crashButtonText: { ...type.label, color: colors.bg },
});
