import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GenreGrid } from '@/components/GenreGrid';
import { TrackListSkeleton } from '@/components/Skeleton';
import { Empty, ErrorNotice } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { TrackStrip } from '@/components/TrackStrip';
import { assertEnv } from '@/config/env';
import { useInfiniteTracks } from '@/hooks/useInfiniteTracks';
import { spotlightAll, trendingAll } from '@/services/sources';
import { tracksOf, useLibrary } from '@/store/library';
import { colors, spacing, type } from '@/theme';
import type { SpotlightKind } from '@/types/track';

const PAGE = 20;

/**
 * Una vetrina: dieci brani per sorgente, alternati. Scade dopo mezz'ora,
 * piu' tardi del trending, perche' e' un assaggio e non un elenco da
 * scorrere: rinfrescarla a ogni apertura sposterebbe le schede sotto il
 * dito senza aggiungere niente.
 */
function useSpotlight(kind: SpotlightKind) {
  return useQuery({
    queryKey: ['spotlight', kind],
    queryFn: () => spotlightAll(kind),
    staleTime: 30 * 60_000,
  });
}

/**
 * La home a sezioni: ascolti recenti, cosa sale, voci nuove, i generi e
 * poi il trending federato con lo scroll infinito. Le vetrine stanno
 * nell'header della lista, cosi' tutta la schermata scorre insieme.
 */
export default function DiscoverScreen() {
  const envError = assertEnv();
  const router = useRouter();
  const { history } = useLibrary();
  const rising = useSpotlight('rising');
  const fresh = useSpotlight('fresh');

  const { tracks, failed, loadMore, retry, isLoading, isFetching, isFetchingNextPage, error } =
    useInfiniteTracks(['trending', 'all'], (offset) => trendingAll({ limit: PAGE, offset }), {
      pageSize: PAGE,
    });

  const recent = useMemo(() => tracksOf(history.slice(0, 12)), [history]);

  /**
   * Caduta totale: nessuna sorgente ha risposto.
   *
   * Va dentro la lista e non al posto della schermata: sostituendo tutto
   * sparirebbero anche vetrine e generi, che magari sono gia' a schermo
   * dalla cache. Serve comunque un bottone, perche' la query resta in
   * cache e da sola non riprova piu'.
   */
  const errorState =
    error && tracks.length === 0 ? (
      <Empty
        title="Nessuna connessione alle sorgenti"
        hint={`Controlla la rete e riprova.${
          error instanceof Error && error.message ? `\n${error.message}` : ''
        }`}
        action={{
          label: isFetching ? 'Riprovo...' : 'Riprova',
          onPress: () => {
            retry();
          },
          busy: isFetching,
        }}
      />
    ) : null;

  return (
    <View style={styles.screen}>
      <TrackList
        tracks={tracks}
        onEndReached={loadMore}
        header={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Scopri</Text>
              <Text style={styles.subtitle}>Dal catalogo Audius e Jamendo</Text>
            </View>

            {envError ? <ErrorNotice message={envError} /> : null}
            {failed.map((f) => (
              <ErrorNotice key={f.source} message={`${f.source} non risponde: ${f.message}`} />
            ))}

            {recent.length > 0 ? (
              <TrackStrip
                title="Ascoltati di recente"
                tracks={recent}
                more={{
                  label: 'Tutti',
                  onPress: () => router.push('/collection/history'),
                  accessibilityLabel: 'Tutti gli ascolti recenti',
                }}
              />
            ) : null}

            {/* Una vetrina caduta sparisce e basta: l'avviso sulle sorgenti
                sta gia' sopra, e una riga "non risponde" per ogni sezione
                farebbe della home un bollettino di guasti. */}
            <TrackStrip
              title="In ascesa questa settimana"
              tracks={rising.data?.tracks ?? []}
              loading={rising.isLoading}
            />
            <TrackStrip
              title="Voci nuove"
              tracks={fresh.data?.tracks ?? []}
              loading={fresh.isLoading}
            />

            <GenreGrid />

            <Text style={styles.sectionTitle} accessibilityRole="header">
              Di tendenza
            </Text>
            {/* Sagoma nell'header, sotto il titolo di sezione: le vetrine
                sopra restano al loro posto mentre l'elenco arriva. */}
            {isLoading ? <TrackListSkeleton rows={8} /> : null}
          </View>
        }
        footer={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.more} color={colors.textMuted} />
          ) : null
        }
        empty={errorState ?? (isLoading ? null : <Empty title="Nessuna traccia disponibile" />)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: 2,
  },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted },
  sectionTitle: {
    ...type.title,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  more: { paddingVertical: spacing.lg },
});
