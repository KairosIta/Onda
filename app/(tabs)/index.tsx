import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Empty, ErrorNotice, Loading } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { assertEnv } from '@/config/env';
import { useInfiniteTracks } from '@/hooks/useInfiniteTracks';
import { useQueue } from '@/hooks/useQueue';
import { GENRES } from '@/services/genres';
import { trendingAll } from '@/services/sources';
import { tracksOf, useLibrary } from '@/store/library';
import { colors, radius, spacing, type } from '@/theme';
import type { Track } from '@/types/track';

const PAGE = 20;

export default function DiscoverScreen() {
  const envError = assertEnv();
  const { history } = useLibrary();
  const [genreKey, setGenreKey] = useState<string | undefined>();

  const { tracks, failed, loadMore, retry, isLoading, isFetching, isFetchingNextPage, error } =
    useInfiniteTracks(
      ['trending', genreKey ?? 'all'],
      (offset) => trendingAll({ limit: PAGE, offset, genreKey }),
      { pageSize: PAGE },
    );

  const recent = useMemo(() => tracksOf(history.slice(0, 12)), [history]);

  /**
   * Caduta totale: nessuna sorgente ha risposto.
   *
   * Va dentro la lista e non al posto della schermata: sostituendo tutto
   * sparirebbero anche i chip dei generi, e da un genere che fallisce non
   * si potrebbe piu' tornare agli altri — l'unica uscita sarebbe cambiare
   * tab. Serve comunque un bottone, perche' la query resta in cache e da
   * sola non riprova piu'.
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

            {recent.length > 0 ? <RecentStrip tracks={recent} /> : null}

            <GenreChips selected={genreKey} onSelect={setGenreKey} />

            {isLoading ? <Loading /> : null}
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

/** Filtro per genere. Un tocco sul genere gia' attivo lo toglie. */
function GenreChips({
  selected,
  onSelect,
}: {
  selected: string | undefined;
  onSelect: (key: string | undefined) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      <Chip label="Tutti" active={!selected} onPress={() => onSelect(undefined)} />
      {GENRES.map((g) => (
        <Chip
          key={g.key}
          label={g.label}
          active={selected === g.key}
          onPress={() => onSelect(selected === g.key ? undefined : g.key)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Riga orizzontale con gli ultimi ascolti: la scorciatoia piu' usata. */
function RecentStrip({ tracks }: { tracks: Track[] }) {
  const { playList } = useQueue();
  const router = useRouter();

  return (
    <View style={styles.strip}>
      <View style={styles.stripHead}>
        <Text style={styles.sectionTitle}>Riprendi da dove eri</Text>
        <Pressable onPress={() => router.push('/collection/history')} hitSlop={10}>
          <Text style={styles.stripMore}>Tutti</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={tracks}
        keyExtractor={(t) => t.uid}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripList}
        renderItem={({ item, index }) => (
          <Pressable style={styles.card} onPress={() => playList(tracks, index)}>
            {item.artworkUrl ? (
              <Image source={{ uri: item.artworkUrl }} style={styles.cardArt} />
            ) : (
              <View style={[styles.cardArt, styles.cardArtEmpty]} />
            )}
            <Text numberOfLines={2} style={styles.cardTitle}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.cardArtist}>
              {item.artist}
            </Text>
          </Pressable>
        )}
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
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...type.caption, color: colors.textMuted },
  chipTextActive: { color: colors.bg },
  strip: { paddingBottom: spacing.sm },
  stripHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  stripMore: { ...type.caption, color: colors.accent },
  stripList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: 128, gap: 4 },
  cardArt: {
    width: 128,
    height: 128,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
  },
  cardArtEmpty: { borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...type.caption, color: colors.text, fontSize: 13 },
  cardArtist: { ...type.caption, color: colors.textMuted },
  more: { paddingVertical: spacing.lg },
});
