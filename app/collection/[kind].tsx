import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable } from 'react-native';
import { CollectionHeader } from '@/components/CollectionHeader';
import { Screen } from '@/components/Screen';
import { Empty } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useQueue } from '@/hooks/useQueue';
import { clearHistory, tracksOf, useLibrary } from '@/store/library';
import { colors } from '@/theme';
import { shuffled } from '@/utils/shuffle';

const COPY = {
  favorites: {
    title: 'Preferiti',
    empty: 'Nessun preferito',
    hint: 'Tocca il cuore nel player, o tieni premuto un brano in una lista.',
  },
  history: {
    title: 'Ascoltati di recente',
    empty: 'Cronologia vuota',
    hint: 'Qui finiscono gli ultimi 100 brani riprodotti.',
  },
} as const;

export default function CollectionScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const isHistory = kind === 'history';
  const copy = COPY[isHistory ? 'history' : 'favorites'];

  const library = useLibrary();
  const { playList } = useQueue();

  // Gli uid che non si risolvono (catalogo ripulito, dato vecchio) vengono
  // scartati da tracksOf: meglio una lista piu' corta di una riga rotta.
  const tracks = useMemo(
    () => tracksOf(isHistory ? library.history : library.favorites),
    [isHistory, library.history, library.favorites],
  );

  return (
    <Screen>
      <TrackList
        tracks={tracks}
        header={
          <CollectionHeader
            title={copy.title}
            subtitle={`${tracks.length} ${tracks.length === 1 ? 'brano' : 'brani'}`}
            count={tracks.length}
            onPlay={() => playList(tracks, 0)}
            onShuffle={() => playList(shuffled(tracks), 0)}
            actions={
              isHistory && tracks.length > 0 ? (
                <Pressable
                  hitSlop={12}
                  accessibilityLabel="Svuota la cronologia"
                  onPress={() =>
                    Alert.alert(
                      'Svuotare la cronologia?',
                      'I brani salvati nei preferiti restano.',
                      [
                        { text: 'Annulla', style: 'cancel' },
                        { text: 'Svuota', style: 'destructive', onPress: clearHistory },
                      ],
                    )
                  }
                >
                  <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null
            }
          />
        }
        empty={<Empty title={copy.empty} hint={copy.hint} />}
      />
    </Screen>
  );
}
