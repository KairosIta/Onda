import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { type Entity, EntityStrip } from '@/components/EntityStrip';
import { PressableScale } from '@/components/PressableScale';
import { TrackListSkeleton } from '@/components/Skeleton';
import { Empty, ErrorNotice } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useDebounced } from '@/hooks/useDebounced';
import { useInfiniteTracks } from '@/hooks/useInfiniteTracks';
import { searchAlbumsAll, searchAll, searchArtistsAll } from '@/services/sources';
import { clearSearches, rememberSearch, useRecentSearches } from '@/store/searchHistory';
import { colors, radius, spacing, touch, type } from '@/theme';

const PAGE = 25;

export default function SearchScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const query = useDebounced(input.trim(), 400);
  const enabled = query.length > 1;
  const recentSearches = useRecentSearches();

  // isLoading (non isFetching): distingue il primo caricamento di una
  // query nuova dal refetch di una gia' vista. Con isFetching la lista
  // spariva e ricompariva a ogni ricarica dalla cache.
  const { tracks, failed, loadMore, retry, isLoading, isFetching, isFetchingNextPage, error } =
    useInfiniteTracks(['search', query], (offset) => searchAll(query, { limit: PAGE, offset }), {
      pageSize: PAGE,
      enabled,
    });

  // Artisti e album: una pagina sola per ciascuno, alternata fra le
  // sorgenti. Una sorgente senza quella ricerca (Audius per gli album)
  // viene saltata, non contata come caduta.
  const artists = useQuery({
    queryKey: ['search-artists', query],
    queryFn: () => searchArtistsAll(query),
    enabled,
  });
  const albums = useQuery({
    queryKey: ['search-albums', query],
    queryFn: () => searchAlbumsAll(query),
    enabled,
  });

  // Una ricerca si ricorda quando ha trovato qualcosa: i refusi e le
  // parole a meta' non devono restare fra le recenti.
  const found = tracks.length > 0;
  useEffect(() => {
    if (enabled && found) rememberSearch(query);
  }, [enabled, found, query]);

  const artistItems = useMemo<Entity[]>(
    () =>
      (artists.data?.tracks ?? []).map((a) => ({
        key: `${a.source}:${a.id}`,
        title: a.name,
        subtitle: a.detail,
        imageUrl: a.imageUrl,
        source: a.source,
        onPress: () =>
          router.push({
            pathname: '/artist/[source]/[id]',
            params: { source: a.source, id: a.id },
          }),
      })),
    [artists.data, router],
  );

  const albumItems = useMemo<Entity[]>(
    () =>
      (albums.data?.tracks ?? []).map((a) => ({
        key: `${a.source}:${a.id}`,
        title: a.name,
        subtitle: a.artist,
        imageUrl: a.imageUrl,
        source: a.source,
        onPress: () =>
          router.push({ pathname: '/album/[source]/[id]', params: { source: a.source, id: a.id } }),
      })),
    [albums.data, router],
  );

  const hasStrips = artistItems.length > 0 || albumItems.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Cerca</Text>
        <View>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Titolo, artista o album"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.input}
            autoCorrect={false}
          />
          {/* Refetch in corso su risultati gia' a schermo: si segnala
              di lato, senza smontare la lista sotto le dita. */}
          {isFetching && !isLoading ? (
            <ActivityIndicator style={styles.inputSpinner} size="small" color={colors.textMuted} />
          ) : null}
        </View>
      </View>

      {failed.map((f) => (
        <ErrorNotice key={f.source} message={`${f.source} non risponde: ${f.message}`} />
      ))}

      <TrackList
        tracks={enabled ? tracks : []}
        onEndReached={loadMore}
        header={
          enabled ? (
            <View>
              <EntityStrip
                title="Artisti"
                shape="circle"
                items={artistItems}
                loading={artists.isLoading}
              />
              <EntityStrip
                title="Album"
                shape="square"
                items={albumItems}
                loading={albums.isLoading}
              />
              {hasStrips && (found || isLoading) ? (
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  Brani
                </Text>
              ) : null}
              {/* La sagoma prende il posto dei brani, non dell'intestazione:
                  l'input resta montato e a fuoco mentre si scrive. */}
              {isLoading ? <TrackListSkeleton rows={8} /> : null}
            </View>
          ) : recentSearches.length > 0 ? (
            <RecentSearches queries={recentSearches} onPick={setInput} />
          ) : null
        }
        footer={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.more} color={colors.textMuted} />
          ) : null
        }
        empty={
          !enabled ? (
            <Empty
              title="Cerca nel catalogo"
              hint="Mezzo milione di tracce Jamendo più il catalogo Audius."
            />
          ) : isLoading ? null : error ? (
            // Nessuna sorgente ha risposto: dirlo, invece di far credere
            // che la ricerca non abbia trovato niente.
            <Empty
              title="Le sorgenti non rispondono"
              hint="Controlla la rete e riprova."
              action={{
                label: isFetching ? 'Riprovo...' : 'Riprova',
                onPress: () => {
                  retry();
                },
                busy: isFetching,
              }}
            />
          ) : hasStrips ? null : (
            <Empty
              title={`Nessun risultato per "${query}"`}
              hint="Prova con il nome dell'artista."
            />
          )
        }
      />
    </View>
  );
}

/** Le ultime ricerche, da rifare con un tocco quando la casella e' vuota. */
function RecentSearches({ queries, onPick }: { queries: string[]; onPick: (q: string) => void }) {
  return (
    <View style={styles.recent}>
      <View style={styles.recentHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Ricerche recenti
        </Text>
        <Pressable
          onPress={clearSearches}
          style={({ pressed }) => [touch.target, pressed && styles.recentClearPressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancella le ricerche recenti"
        >
          <Text style={styles.recentClear}>Cancella</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {queries.map((q) => (
          <PressableScale
            key={q}
            scaleTo={0.94}
            haptic="tap"
            style={styles.chip}
            onPress={() => onPick(q)}
            accessibilityRole="button"
            accessibilityLabel={`Cerca di nuovo ${q}`}
          >
            <Text style={styles.chipText}>{q}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: { ...type.display, color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    ...type.body,
  },
  inputSpinner: { position: 'absolute', right: spacing.md, top: 0, bottom: 0 },
  sectionTitle: {
    ...type.title,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  recent: { paddingBottom: spacing.sm },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  recentClear: { ...type.caption, color: colors.accent },
  recentClearPressed: { opacity: 0.5 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...type.caption, color: colors.text },
  more: { paddingVertical: spacing.lg },
});
