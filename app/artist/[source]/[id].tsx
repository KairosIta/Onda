import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { CollectionHeader } from '@/components/CollectionHeader';
import { Screen } from '@/components/Screen';
import { Empty, ErrorNotice, Loading } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useInfiniteTracks } from '@/hooks/useInfiniteTracks';
import { useQueue } from '@/hooks/useQueue';
import { sourceById } from '@/services/sources';
import { colors, radius, spacing, type } from '@/theme';
import { shuffled } from '@/utils/shuffle';

const PAGE = 25;

export default function ArtistScreen() {
  const { source, id } = useLocalSearchParams<{ source: string; id: string }>();
  const music = sourceById(source);
  const { playList } = useQueue();

  const info = useQuery({
    queryKey: ['artist', source, id],
    queryFn: () => music!.artistInfo(id),
    enabled: Boolean(music && id),
  });

  const { tracks, loadMore, isLoading, isFetchingNextPage, error } = useInfiniteTracks(
    ['artist-tracks', source, id],
    (offset) => music!.artistTracks(id, { limit: PAGE, offset }).then((t) => ({ tracks: t })),
    { pageSize: PAGE, enabled: Boolean(music && id) },
  );

  if (!music) {
    return (
      <Screen>
        <Empty title="Sorgente sconosciuta" hint={`"${source}" non e' fra quelle registrate.`} />
      </Screen>
    );
  }

  if (isLoading && info.isLoading) {
    return (
      <Screen>
        <Loading />
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
                    <Image source={{ uri: info.data.imageUrl }} style={styles.avatar} />
                  </View>
                ) : null
              }
            />

            {info.data?.bio ? (
              <Text numberOfLines={4} style={styles.bio}>
                {info.data.bio}
              </Text>
            ) : null}

            {info.error ? <ErrorNotice message="Non sono riuscito a leggere il profilo." /> : null}
            {error ? <ErrorNotice message="Non sono riuscito a caricare i brani." /> : null}
          </View>
        }
        footer={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.more} color={colors.textMuted} />
          ) : null
        }
        empty={
          <Empty
            title="Nessun brano riproducibile"
            hint={`Su ${music.label} questo artista non ha tracce in streaming libero.`}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', paddingTop: spacing.xl },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
  },
  bio: {
    ...type.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    lineHeight: 18,
  },
  more: { paddingVertical: spacing.lg },
});
