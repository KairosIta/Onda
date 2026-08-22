import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { setupPlayer } from '@/services/setupPlayer';
import { colors, radius, spacing, type } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
});

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

export default function RootLayout() {
  const [error, setError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    setupPlayer()
      .then(() => setPlayerReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    // Da Android 13 la notifica del player non compare senza permesso,
    // e non viene segnalato alcun errore: si vede solo che "non funziona".
    if (Platform.OS === 'android') {
      import('react-native').then(({ PermissionsAndroid }) => {
        PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never).catch(
          () => {},
        );
      });
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <SafeAreaView style={styles.root} edges={['top']}>
            {error ? (
              <View style={styles.fatal}>
                <Text style={styles.fatalText}>Player non inizializzato: {error}</Text>
              </View>
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
                  options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
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
  fatal: { padding: spacing.md, backgroundColor: colors.danger },
  fatalText: { ...type.caption, color: colors.bg },
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
  crashButtonText: { ...type.body, color: colors.bg },
});
