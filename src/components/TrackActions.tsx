import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueue } from '@/hooks/useQueue';
import {
  addToPlaylist,
  createPlaylist,
  removeFromPlaylist,
  toggleFavorite,
  useLibrary,
} from '@/store/library';
import { colors, radius, spacing, type } from '@/theme';
import type { Track } from '@/types/track';

interface Props {
  track: Track | null;
  onClose: () => void;
  /** Se la traccia arriva da una playlist, il menu offre "rimuovi da qui". */
  fromPlaylistId?: string;
}

type Pane = 'menu' | 'playlists' | 'new';

/**
 * Menu contestuale della traccia. Tre pannelli nello stesso foglio invece
 * di tre modali annidate: su Android le modali sovrapposte si chiudono a
 * catena e l'utente si ritrova alla schermata di partenza.
 */
export function TrackActions({ track, onClose, fromPlaylistId }: Props) {
  if (!track) return null;
  return (
    <TrackActionsSheet
      key={track.uid}
      track={track}
      onClose={onClose}
      fromPlaylistId={fromPlaylistId}
    />
  );
}

function TrackActionsSheet({
  track,
  onClose,
  fromPlaylistId,
}: Omit<Props, 'track'> & { track: Track }) {
  const [pane, setPane] = useState<Pane>('menu');
  const [name, setName] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const { playNext, addLast } = useQueue();
  const { playlists, favorites } = useLibrary();
  const router = useRouter();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Senza, l'ultima voce del menu finisce sotto la barra di navigazione.
  const insets = useSafeAreaInsets();

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const close = useCallback(() => {
    cancelScheduledClose();
    setToast(null);
    onClose();
  }, [cancelScheduledClose, onClose]);

  useEffect(() => {
    return cancelScheduledClose;
  }, [cancelScheduledClose]);

  const done = useCallback(
    (message: string) => {
      cancelScheduledClose();
      setToast(message);
      closeTimer.current = setTimeout(close, 550);
    },
    [cancelScheduledClose, close],
  );

  const isFav = favorites.includes(track.uid);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Chiudi il menu" />

      <View style={[styles.sheet, { paddingBottom: spacing.xxl + insets.bottom }]}>
        <View style={styles.grabber} />

        <View style={styles.head}>
          <Text numberOfLines={1} style={styles.headTitle}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={styles.headArtist}>
            {track.artist}
          </Text>
        </View>

        {toast ? <Text style={styles.toast}>{toast}</Text> : null}

        {pane === 'menu' ? (
          <View>
            <Item
              icon="play-forward-outline"
              label="Riproduci dopo"
              onPress={() => playNext(track).then(() => done('Aggiunta dopo la traccia corrente'))}
            />
            <Item
              icon="list-outline"
              label="Aggiungi in fondo alla coda"
              onPress={() => addLast(track).then(() => done('Accodata'))}
            />
            <Item
              icon={isFav ? 'heart' : 'heart-outline'}
              label={isFav ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}
              tint={isFav ? colors.accent : undefined}
              onPress={() => {
                toggleFavorite(track);
                done(isFav ? 'Rimossa dai preferiti' : 'Aggiunta ai preferiti');
              }}
            />
            <Item
              icon="albums-outline"
              label="Aggiungi a una playlist"
              chevron
              onPress={() => setPane('playlists')}
            />
            {track.artistId ? (
              <Item
                icon="person-outline"
                label={`Vai a ${track.artist}`}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/artist/[source]/[id]',
                    params: { source: track.source, id: track.artistId! },
                  });
                }}
              />
            ) : null}
            {track.albumId ? (
              <Item
                icon="disc-outline"
                label={track.albumName ? `Album: ${track.albumName}` : "Vai all'album"}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/album/[source]/[id]',
                    params: { source: track.source, id: track.albumId! },
                  });
                }}
              />
            ) : null}
            {fromPlaylistId ? (
              <Item
                icon="remove-circle-outline"
                label="Rimuovi da questa playlist"
                tint={colors.danger}
                onPress={() => {
                  removeFromPlaylist(fromPlaylistId, track.uid);
                  close();
                }}
              />
            ) : null}
          </View>
        ) : null}

        {pane === 'playlists' ? (
          <View>
            <Item icon="add-outline" label="Nuova playlist" onPress={() => setPane('new')} />
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              {playlists.length === 0 ? (
                <Text style={styles.hint}>Nessuna playlist. Creane una qui sopra.</Text>
              ) : (
                playlists.map((p) => (
                  <Item
                    key={p.id}
                    icon="musical-notes-outline"
                    label={p.name}
                    detail={`${p.trackUids.length}`}
                    onPress={() => {
                      const added = addToPlaylist(p.id, track);
                      done(added ? `Aggiunta a ${p.name}` : `Gia' presente in ${p.name}`);
                    }}
                  />
                ))
              )}
            </ScrollView>
          </View>
        ) : null}

        {pane === 'new' ? (
          <View style={styles.newPane}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nome della playlist"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!name.trim()) return;
                createPlaylist(name, [track]);
                done(`Creata ${name.trim()}`);
              }}
            />
            <Pressable
              style={[styles.cta, !name.trim() && styles.ctaOff]}
              disabled={!name.trim()}
              onPress={() => {
                createPlaylist(name, [track]);
                done(`Creata ${name.trim()}`);
              }}
            >
              <Text style={styles.ctaText}>Crea e aggiungi</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Item({
  icon,
  label,
  detail,
  tint,
  chevron,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  tint?: string;
  chevron?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={tint ?? colors.textMuted} />
      <Text numberOfLines={1} style={[styles.itemLabel, tint ? { color: tint } : null]}>
        {label}
      </Text>
      {detail ? <Text style={styles.itemDetail}>{detail}</Text> : null}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000AA' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  head: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  headTitle: { ...type.title, color: colors.text },
  headArtist: { ...type.caption, color: colors.textMuted },
  toast: {
    ...type.caption,
    color: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  scroll: { maxHeight: 260 },
  hint: { ...type.caption, color: colors.textMuted, padding: spacing.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  itemPressed: { backgroundColor: colors.surfaceHigh },
  itemLabel: { ...type.body, color: colors.text, flex: 1 },
  itemDetail: { ...type.caption, color: colors.textMuted },
  newPane: { padding: spacing.lg, gap: spacing.md },
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
