import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CollectionHeader } from '@/components/CollectionHeader';
import { Screen } from '@/components/Screen';
import { CollectionSkeleton } from '@/components/Skeleton';
import { Empty, ErrorNotice } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useInfiniteTracks } from '@/hooks/useInfiniteTracks';
import { useQueue } from '@/hooks/useQueue';
import { GENRES } from '@/services/genres';
import { trendingAll } from '@/services/sources';
import { colors, spacing } from '@/theme';
import { shuffled } from '@/utils/shuffle';

const PAGE = 20;

/**
 * Il trending di un genere, federato, con lo scroll infinito. Stessa
 * chiave di cache dei vecchi chip di Scopri: chi aveva gia' aperto un
 * genere lo ritrova da disco.
 */
export default function GenreScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const genre = GENRES.find((g) => g.key === key);
  const { playList } = useQueue();

  const { tracks, failed, loadMore, retry, isLoading, isFetching, isFetchingNextPage, error } =
    useInfiniteTracks(
      ['trending', key ?? ''],
      (offset) => trendingAll({ limit: PAGE, offset, genreKey: key }),
      { pageSize: PAGE, enabled: Boolean(genre) },
    );

  // Un deep link con una chiave ignota: si dice, non si apre "Tutti".
  if (!genre) {
    return (
      <Screen>
        <Empty title="Genere sconosciuto" hint={`"${key}" non è fra i generi di Onda.`} />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <CollectionSkeleton media="none" rows={8} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TrackList
        tracks={tracks}
        onEndReached={loadMore}
        header={
          <View>
            <CollectionHeader
              title={genre.label}
              subtitle="Di tendenza su Audius e Jamendo"
              count={tracks.length}
              onPlay={() => playList(tracks, 0)}
              onShuffle={() => playList(shuffled(tracks), 0)}
            />
            {failed.map((f) => (
              <ErrorNotice key={f.source} message={`${f.source} non risponde: ${f.message}`} />
            ))}
          </View>
        }
        footer={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.more} color={colors.textMuted} />
          ) : null
        }
        empty={
          error ? (
            <Empty
              title="Nessuna connessione alle sorgenti"
              hint="Controlla la rete e riprova."
              action={{
                label: isFetching ? 'Riprovo...' : 'Riprova',
                onPress: () => {
                  retry();
                },
                busy: isFetching,
              }}
            />
          ) : (
            <Empty
              title={`Niente di tendenza in ${genre.label}`}
              hint="Le sorgenti non hanno brani con questo genere adesso."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  more: { paddingVertical: spacing.lg },
});
