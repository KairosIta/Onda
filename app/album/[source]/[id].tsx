import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Artwork } from '@/components/Artwork';
import { CollectionHeader } from '@/components/CollectionHeader';
import { Screen } from '@/components/Screen';
import { CollectionSkeleton } from '@/components/Skeleton';
import { Empty, ErrorNotice } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useQueue } from '@/hooks/useQueue';
import { sourceById } from '@/services/sources';
import { radius, spacing } from '@/theme';
import { parseEntityId } from '@/utils/routes';
import { shuffled } from '@/utils/shuffle';

/**
 * Gli album esistono su Jamendo. Su Audius il campo c'e' ma resta quasi
 * sempre vuoto, quindi da li' non si arriva mai a questa schermata: se
 * ci si arriva comunque, il messaggio lo dice invece di mostrare una
 * lista vuota senza spiegazione.
 */
export default function AlbumScreen() {
  const { source, id: rawId } = useLocalSearchParams<{ source: string; id: string }>();
  const music = sourceById(source);
  const id = parseEntityId(rawId) ?? '';
  const { playList } = useQueue();

  const supported = Boolean(music?.albumTracks && music?.albumInfo);

  const info = useQuery({
    queryKey: ['album', source, id],
    queryFn: () => music!.albumInfo!(id),
    enabled: supported && Boolean(id),
  });

  const list = useQuery({
    queryKey: ['album-tracks', source, id],
    // Senza `limit` la sorgente pagina da sola fino in fondo: un album
    // va mostrato intero, e il vecchio tetto di 100 troncava in silenzio.
    queryFn: () => music!.albumTracks!(id),
    enabled: supported && Boolean(id),
  });

  if (!id) {
    return (
      <Screen>
        <Empty title="Album non indicato" hint="Il collegamento non dice quale album aprire." />
      </Screen>
    );
  }

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
    // Sagoma con la copertina quadrata: anticipa la forma della pagina che arriva.
    return (
      <Screen>
        <CollectionSkeleton media="square" rows={6} />
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
                    {/* Priorita' alta: e' l'unica immagine della pagina e
                        sta in testa, prima delle copertine delle righe. */}
                    <Artwork
                      uri={info.data.imageUrl}
                      size={180}
                      radius={radius.md}
                      priority="high"
                    />
                  </View>
                ) : null
              }
            />

            {/* L'errore della scheda si dice anche quando i brani ci sono:
                titolo «Album» e copertina assente altrimenti passerebbero
                per un album senza nome. A lista vuota parla solo `empty`. */}
            {info.error && tracks.length > 0 ? (
              <ErrorNotice
                message="Non sono riuscito a leggere la scheda dell'album."
                action={{ label: 'Riprova', onPress: () => info.refetch(), busy: info.isFetching }}
              />
            ) : null}
          </View>
        }
        empty={
          list.error || info.error ? (
            <Empty
              title="Non sono riuscito a caricare l'album"
              hint="Controlla la rete e riprova."
              action={{
                label: 'Riprova',
                onPress: () => {
                  if (list.error) list.refetch();
                  if (info.error) info.refetch();
                },
                busy: list.isFetching || info.isFetching,
              }}
            />
          ) : (
            <Empty title="Album vuoto" />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverWrap: { alignItems: 'center', paddingTop: spacing.xl },
});
