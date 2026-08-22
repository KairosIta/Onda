import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CollectionHeader } from '@/components/CollectionHeader';
import { Screen } from '@/components/Screen';
import { Empty } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useQueue } from '@/hooks/useQueue';
import {
  deletePlaylist,
  movePlaylistTrack,
  removeFromPlaylist,
  renamePlaylist,
  tracksOf,
  useLibrary,
} from '@/store/library';
import { colors, radius, spacing, type } from '@/theme';
import { shuffled } from '@/utils/shuffle';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playlists } = useLibrary();
  const { playList } = useQueue();

  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const playlist = playlists.find((p) => p.id === id);
  const tracks = useMemo(() => tracksOf(playlist?.trackUids ?? []), [playlist?.trackUids]);

  if (!playlist) {
    return (
      <Screen>
        <Empty title="Playlist non trovata" hint="Forse e' stata eliminata." />
      </Screen>
    );
  }

  const confirmDelete = () =>
    Alert.alert(
      `Eliminare "${playlist.name}"?`,
      'I brani restano nei preferiti, se ce li hai messi.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            deletePlaylist(playlist.id);
            router.back();
          },
        },
      ],
    );

  const header = (
    <CollectionHeader
      title={playlist.name}
      subtitle={`${tracks.length} ${tracks.length === 1 ? 'brano' : 'brani'}`}
      count={tracks.length}
      onPlay={() => playList(tracks, 0)}
      onShuffle={() => playList(shuffled(tracks), 0)}
      actions={
        <>
          {tracks.length > 1 ? (
            <Pressable
              hitSlop={12}
              onPress={() => setEditing((v) => !v)}
              accessibilityLabel={editing ? 'Fine riordino' : 'Riordina i brani'}
            >
              <Ionicons
                name={editing ? 'checkmark' : 'swap-vertical'}
                size={22}
                color={editing ? colors.accent : colors.textMuted}
              />
            </Pressable>
          ) : null}
          <Pressable
            hitSlop={12}
            onPress={() => {
              setDraft(playlist.name);
              setRenaming(true);
            }}
            accessibilityLabel="Rinomina la playlist"
          >
            <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable hitSlop={12} onPress={confirmDelete} accessibilityLabel="Elimina la playlist">
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </>
      }
    />
  );

  return (
    <Screen>
      {editing ? (
        /* Modalita' riordino: frecce invece del drag, cosi' non serve
           una libreria nativa in piu' e funziona anche con TalkBack. */
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.uid}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={styles.editRow}>
              <View style={styles.editMeta}>
                <Text numberOfLines={1} style={styles.editTitle}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.editArtist}>
                  {item.artist}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                disabled={index === 0}
                onPress={() => movePlaylistTrack(playlist.id, index, index - 1)}
                accessibilityLabel="Sposta su"
              >
                <Ionicons
                  name="chevron-up"
                  size={22}
                  color={index === 0 ? colors.border : colors.text}
                />
              </Pressable>
              <Pressable
                hitSlop={8}
                disabled={index === tracks.length - 1}
                onPress={() => movePlaylistTrack(playlist.id, index, index + 1)}
                accessibilityLabel="Sposta giu'"
              >
                <Ionicons
                  name="chevron-down"
                  size={22}
                  color={index === tracks.length - 1 ? colors.border : colors.text}
                />
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() => removeFromPlaylist(playlist.id, item.uid)}
                accessibilityLabel="Rimuovi dalla playlist"
              >
                <Ionicons name="remove-circle-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
          )}
        />
      ) : (
        <TrackList
          tracks={tracks}
          header={header}
          fromPlaylistId={playlist.id}
          empty={
            <Empty
              title="Playlist vuota"
              hint="Tieni premuto un brano in una lista e scegli 'Aggiungi a una playlist'."
            />
          }
        />
      )}

      <Modal
        visible={renaming}
        transparent
        animationType="fade"
        onRequestClose={() => setRenaming(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setRenaming(false)} />
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Rinomina</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            style={styles.input}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={() => {
              renamePlaylist(playlist.id, draft);
              setRenaming(false);
            }}
          />
          <Pressable
            style={[styles.cta, !draft.trim() && styles.ctaOff]}
            disabled={!draft.trim()}
            onPress={() => {
              renamePlaylist(playlist.id, draft);
              setRenaming(false);
            }}
          >
            <Text style={styles.ctaText}>Salva</Text>
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  editMeta: { flex: 1, gap: 2 },
  editTitle: { ...type.body, color: colors.text },
  editArtist: { ...type.caption, color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: '#000000AA' },
  dialog: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '30%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dialogTitle: { ...type.title, color: colors.text },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    ...type.body,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaOff: { opacity: 0.4 },
  ctaText: { ...type.body, color: colors.bg },
});
