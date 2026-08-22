import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { CollectionHeader } from '@/components/CollectionHeader';
import { Screen } from '@/components/Screen';
import { Empty, ErrorNotice, Loading } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useQueue } from '@/hooks/useQueue';
import { sourceById } from '@/services/sources';
import { colors, radius, spacing } from '@/theme';
import { shuffled } from '@/utils/shuffle';

/**
 * Gli album esistono su Jamendo. Su Audius il campo c'e' ma resta quasi
 * sempre vuoto, quindi da li' non si arriva mai a questa schermata: se
 * ci si arriva comunque, il messaggio lo dice invece di mostrare una
 * lista vuota senza spiegazione.
 */
export default function AlbumScreen() {
  const { source, id } = useLocalSearchParams<{ source: string; id: string }>();
  const music = sourceById(source);
  const { playList } = useQueue();

  const supported = Boolean(music?.albumTracks && music?.albumInfo);

  const info = useQuery({
    queryKey: ['album', source, id],
    queryFn: () => music!.albumInfo!(id),
    enabled: supported && Boolean(id),
  });

  const list = useQuery({
    queryKey: ['album-tracks', source, id],
    queryFn: () => music!.albumTracks!(id, { limit: 100 }),
    enabled: supported && Boolean(id),
  });

  if (!supported) {
    return (
      <Screen>
        <Empty
          title="Album non disponibili"
          hint={`${music?.label ?? source} non espone gli album come raccolte navigabili.`}
        />
      </Screen>
    );
  }

  if (info.isLoading || list.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const tracks = list.data ?? [];

  return (
    <Screen>
      <TrackList
        tracks={tracks}
        header={
          <View>
            <CollectionHeader
              title={info.data?.name ?? 'Album'}
              subtitle={[info.data?.artist, info.data?.detail].filter(Boolean).join(' · ')}
              count={tracks.length}
              onPlay={() => playList(tracks, 0)}
              onShuffle={() => playList(shuffled(tracks), 0)}
              media={
                info.data?.imageUrl ? (
                  <View style={styles.coverWrap}>
                    <Image source={{ uri: info.data.imageUrl }} style={styles.cover} />
                  </View>
                ) : null
              }
            />

            {list.error ? <ErrorNotice message="Non sono riuscito a caricare i brani." /> : null}
          </View>
        }
        empty={<Empty title="Album vuoto" />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverWrap: { alignItems: 'center', paddingTop: spacing.xl },
  cover: { width: 180, height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
});
