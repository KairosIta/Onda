import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/components/Artwork';
import { CollectionHeader } from '@/components/CollectionHeader';
import { Screen } from '@/components/Screen';
import { CollectionSkeleton } from '@/components/Skeleton';
import { Empty, ErrorNotice } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useInfiniteTracks } from '@/hooks/useInfiniteTracks';
import { useQueue } from '@/hooks/useQueue';
import { sourceById } from '@/services/sources';
import { colors, radius, spacing, type } from '@/theme';
import { parseEntityId } from '@/utils/routes';
import { shuffled } from '@/utils/shuffle';

const PAGE = 25;

export default function ArtistScreen() {
  const { source, id: rawId } = useLocalSearchParams<{ source: string; id: string }>();
  const music = sourceById(source);
  const id = parseEntityId(rawId) ?? '';
  const { playList } = useQueue();

  const info = useQuery({
    queryKey: ['artist', source, id],
    queryFn: () => music!.artistInfo(id),
    enabled: Boolean(music && id),
  });

  const { tracks, loadMore, retry, isLoading, isFetching, isFetchingNextPage, error } =
    useInfiniteTracks(
      ['artist-tracks', source, id],
      (offset) => music!.artistTracks(id, { limit: PAGE, offset }).then((t) => ({ tracks: t })),
      { pageSize: PAGE, enabled: Boolean(music && id) },
    );

  if (!id) {
    return (
      <Screen>
        <Empty title="Artista non indicato" hint="Il collegamento non dice quale artista aprire." />
      </Screen>
    );
  }

  if (!music) {
    return (
      <Screen>
        <Empty title="Sorgente sconosciuta" hint={`"${source}" non è fra quelle registrate.`} />
      </Screen>
    );
  }

  // Sagoma finche' uno qualunque dei due carica, come per l'album: il
  // profilo di norma arriva prima dei brani, e con `&&` la lista vuota
  // mostrerebbe "Nessun brano riproducibile" mentre i brani stanno ancora
  // caricando.
  if (isLoading || info.isLoading) {
    // Sagoma con l'avatar tondo: anticipa la forma della pagina che arriva.
    return (
      <Screen>
        <CollectionSkeleton media="circle" rows={6} />
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
              title={info.data?.name ?? 'Artista'}
              subtitle={info.data?.detail ?? music.label}
              count={tracks.length}
              onPlay={() => playList(tracks, 0)}
              onShuffle={() => playList(shuffled(tracks), 0)}
              media={
                info.data?.imageUrl ? (
                  <View style={styles.avatarWrap}>
                    {/* Priorita' alta: e' l'unica immagine della pagina e
                        sta in testa, prima delle copertine delle righe. */}
                    <Artwork
                      uri={info.data.imageUrl}
                      size={132}
                      radius={radius.pill}
                      priority="high"
                    />
                  </View>
                ) : null
              }
            />

            {info.data?.bio ? (
              <Text numberOfLines={4} style={styles.bio}>
                {info.data.bio}
              </Text>
            ) : null}

            {/* Con dei brani in lista gli errori si dicono qui, ciascuno
                con il suo Riprova; a lista vuota parla solo `empty`, così
                non compaiono insieme due avvisi e «Nessun brano». */}
            {info.error && tracks.length > 0 ? (
              <ErrorNotice
                message="Non sono riuscito a leggere il profilo."
                action={{ label: 'Riprova', onPress: () => info.refetch(), busy: info.isFetching }}
              />
            ) : null}
            {error && tracks.length > 0 ? (
              <ErrorNotice
                message="Non sono riuscito a caricare altri brani."
                action={{ label: 'Riprova', onPress: retry, busy: isFetching }}
              />
            ) : null}
          </View>
        }
        footer={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.more} color={colors.textMuted} />
          ) : null
        }
        empty={
          error || info.error ? (
            <Empty
              title="Non sono riuscito a caricare l'artista"
              hint="Controlla la rete e riprova."
              action={{
                label: 'Riprova',
                onPress: () => {
                  if (error) retry();
                  if (info.error) info.refetch();
                },
                busy: isFetching || info.isFetching,
              }}
            />
          ) : (
            <Empty
              title="Nessun brano riproducibile"
              hint={`Su ${music.label} questo artista non ha tracce in streaming libero.`}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', paddingTop: spacing.xl },
  bio: {
    ...type.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    lineHeight: 18,
  },
  more: { paddingVertical: spacing.lg },
});
