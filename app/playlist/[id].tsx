import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CollectionHeader } from '@/components/CollectionHeader';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Empty } from '@/components/StateViews';
import { TrackList } from '@/components/TrackList';
import { useQueue } from '@/hooks/useQueue';
import { haptics } from '@/services/haptics';
import {
  deletePlaylist,
  movePlaylistTrack,
  removeFromPlaylist,
  renamePlaylist,
  tracksOf,
  useLibrary,
} from '@/store/library';
import { colors, motion, radius, spacing, type } from '@/theme';
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
            haptics.reject();
            deletePlaylist(playlist.id);
            router.back();
          },
        },
      ],
    );

  // Le frecce agli estremi sono gia' disabilitate; il controllo resta
  // perche' il feedback deve seguire uno spostamento avvenuto, non un tocco.
  const move = (from: number, to: number) => {
    if (to < 0 || to >= tracks.length) return;
    haptics.tap();
    movePlaylistTrack(playlist.id, from, to);
  };

  // Lo stesso salvataggio da bottone e da tastiera, con lo stesso feedback:
  // `success` come "Crea e aggiungi" del menu contestuale. Un nome vuoto
  // lascia quello vecchio, quindi non c'e' niente di riuscito da segnalare.
  const save = () => {
    if (draft.trim()) haptics.success();
    renamePlaylist(playlist.id, draft);
    setRenaming(false);
  };

  const header = (
    <CollectionHeader
      title={playlist.name}
      subtitle={`${tracks.length} ${tracks.length === 1 ? 'brano' : 'brani'}`}
      count={tracks.length}
      onPlay={() => playList(tracks, 0)}
      onShuffle={() => playList(shuffled(tracks), 0)}
      actions={
        <>
          {/* Il riordino e' un interruttore: vibra come gli altri toggle
              (preferito, shuffle), non come un bottone. */}
          {tracks.length > 1 ? (
            <PressableScale
              hitSlop={12}
              scaleTo={motion.iconPressScale}
              onPress={() => {
                haptics.toggle(!editing);
                setEditing((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: editing }}
              accessibilityLabel={editing ? 'Fine riordino' : 'Riordina i brani'}
            >
              <Ionicons
                name={editing ? 'checkmark' : 'swap-vertical'}
                size={22}
                color={editing ? colors.accent : colors.textMuted}
              />
            </PressableScale>
          ) : null}
          <PressableScale
            hitSlop={12}
            scaleTo={motion.iconPressScale}
            onPress={() => {
              setDraft(playlist.name);
              setRenaming(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Rinomina la playlist"
          >
            <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
          </PressableScale>
          <PressableScale
            hitSlop={12}
            scaleTo={motion.iconPressScale}
            onPress={confirmDelete}
            accessibilityRole="button"
            accessibilityLabel="Elimina la playlist"
          >
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </PressableScale>
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
                onPress={() => move(index, index - 1)}
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
                onPress={() => move(index, index + 1)}
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
                onPress={() => {
                  haptics.reject();
                  removeFromPlaylist(playlist.id, item.uid);
                }}
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
            onSubmitEditing={save}
          />
          {/* L'opacita' da spento sta sul contenitore che si anima, cosi' il
              bottone resta un pezzo solo anche mentre si ritrae. */}
          <PressableScale
            style={[styles.cta, !draft.trim() && styles.ctaOff]}
            disabled={!draft.trim()}
            onPress={save}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Salva</Text>
          </PressableScale>
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
  ctaText: { ...type.label, color: colors.bg },
});
