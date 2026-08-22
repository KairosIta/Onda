import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Empty, ErrorNotice, Loading } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useDebounced } from '@/hooks/useDebounced';
import { useInfiniteTracks } from '@/hooks/useInfiniteTracks';
import { searchAll } from '@/services/sources';
import { colors, radius, spacing, type } from '@/theme';

const PAGE = 25;

export default function SearchScreen() {
  const [input, setInput] = useState('');
  const query = useDebounced(input.trim(), 400);
  const enabled = query.length > 1;

  // isLoading (non isFetching): distingue il primo caricamento di una
  // query nuova dal refetch di una gia' vista. Con isFetching la lista
  // spariva e ricompariva a ogni ricarica dalla cache.
  const { tracks, failed, loadMore, retry, isLoading, isFetching, isFetchingNextPage, error } =
    useInfiniteTracks(['search', query], (offset) => searchAll(query, { limit: PAGE, offset }), {
      pageSize: PAGE,
      enabled,
    });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Cerca</Text>
        <View>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Titolo o artista"
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

      {isLoading && enabled ? (
        <Loading />
      ) : (
        <TrackList
          tracks={tracks}
          onEndReached={loadMore}
          footer={
            isFetchingNextPage ? (
              <ActivityIndicator style={styles.more} color={colors.textMuted} />
            ) : null
          }
          empty={
            !enabled ? (
              <Empty
                title="Cerca nel catalogo"
                hint="Mezzo milione di tracce Jamendo piu' il catalogo Audius."
              />
            ) : error ? (
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
            ) : (
              <Empty
                title={`Nessun risultato per "${query}"`}
                hint="Prova con il nome dell'artista."
              />
            )
          }
        />
      )}
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
  more: { paddingVertical: spacing.lg },
});
