import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GenreGrid } from '@/components/GenreGrid';
import { PressableScale } from '@/components/PressableScale';
import { TrackListSkeleton } from '@/components/Skeleton';
import { Empty, ErrorNotice } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { TrackStrip } from '@/components/TrackStrip';
import { useInfiniteTracks } from '@/hooks/useInfiniteTracks';
import { activeSourceLabels, spotlightAll, trendingAll } from '@/services/sources';
import { showJamendoInvite } from '@/services/sourceSettings';
import { failureNotice } from '@/services/sources/meta';
import { tracksOf, useLibrary } from '@/store/library';
import { dismissJamendoInvite, useSources } from '@/store/sources';
import { colors, radius, spacing, touch, type } from '@/theme';
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
    queryFn: ({ signal }) => spotlightAll(kind, { signal }),
    staleTime: 30 * 60_000,
  });
}

/**
 * La home a sezioni: ascolti recenti, cosa sale, voci nuove, i generi e
 * poi il trending federato con lo scroll infinito. Le vetrine stanno
 * nell'header della lista, cosi' tutta la schermata scorre insieme.
 */
/**
 * Al primo avvio passa dal benvenuto, che spiega le sorgenti e chiede il
 * Client ID Jamendo. Qui e non nel layout: le altre rotte (un deep link al
 * player) restano raggiungibili.
 */
export default function DiscoverRoute() {
  const { settings } = useSources();
  return settings.welcomeDone ? <DiscoverScreen /> : <Redirect href="/welcome" />;
}

/**
 * Per chi ha saltato il benvenuto senza Jamendo: un promemoria, finche' non
 * lo configura o non lo chiude.
 */
function JamendoInvite({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  return (
    <View style={styles.invite}>
      <Ionicons name="musical-notes-outline" size={22} color={colors.accent} />
      <View style={styles.inviteText}>
        <Text style={styles.inviteTitle}>Aggiungi Jamendo</Text>
        <Text style={styles.inviteBody}>
          Inserisci il tuo Client ID per ascoltare anche il catalogo Jamendo.
        </Text>
        <PressableScale
          onPress={onOpen}
          haptic="tap"
          containerStyle={styles.inviteActionSlot}
          style={styles.inviteAction}
          accessibilityRole="button"
        >
          <Text style={styles.inviteActionText}>Configura</Text>
        </PressableScale>
      </View>
      <Pressable
        onPress={onClose}
        style={touch.target}
        accessibilityRole="button"
        accessibilityLabel="Chiudi l'invito ad aggiungere Jamendo"
      >
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function DiscoverScreen() {
  const router = useRouter();
  const { settings, credentials, active } = useSources();
  const anyActive = Object.values(active).some(Boolean);
  const { history } = useLibrary();
  const rising = useSpotlight('rising');
  const fresh = useSpotlight('fresh');

  const { tracks, failed, loadMore, retry, isLoading, isFetching, isFetchingNextPage, error } =
    useInfiniteTracks(['trending', 'all'], (cursor, signal) =>
      trendingAll({ limit: PAGE, cursor, signal }),
    );

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
              <Text style={styles.subtitle}>
                {anyActive ? `Dal catalogo ${activeSourceLabels()}` : 'Nessuna sorgente attiva'}
              </Text>
            </View>

            {showJamendoInvite(settings, credentials) ? (
              <JamendoInvite
                onOpen={() => router.push('/sources')}
                onClose={dismissJamendoInvite}
              />
            ) : null}
            {failed.map((f) => (
              <ErrorNotice key={f.source} message={failureNotice(f)} />
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
        empty={
          errorState ??
          (!anyActive ? (
            <Empty
              title="Nessuna sorgente attiva"
              hint="Accendi Audius o aggiungi il tuo Client ID Jamendo."
              action={{ label: 'Apri Sorgenti', onPress: () => router.push('/sources') }}
            />
          ) : isLoading ? null : (
            <Empty title="Nessuna traccia disponibile" />
          ))
        }
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
  invite: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inviteText: { flex: 1, gap: spacing.xs },
  inviteTitle: { ...type.label, color: colors.text },
  inviteBody: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  inviteActionSlot: { alignSelf: 'flex-start', marginTop: spacing.sm },
  inviteAction: {
    minHeight: touch.target.minHeight - spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  inviteActionText: { ...type.label, color: colors.bg },
});
