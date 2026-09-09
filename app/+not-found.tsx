import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Empty } from '@/components/StateViews';

/**
 * Un deep link o un URL che non corrisponde a nessuna schermata: senza
 * questa route Expo mostra la sua «Unmatched Route» in inglese, senza via
 * d'uscita evidente.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Empty
        title="Pagina non trovata"
        hint="Il collegamento non porta a nessuna schermata di Onda."
        action={{ label: 'Torna a Scopri', onPress: () => router.navigate('/') }}
      />
    </Screen>
  );
}
