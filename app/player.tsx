import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
  RepeatMode,
  useActiveMediaItem,
  useIsPlaying,
  useProgress,
} from '@rntp/player';
import { HeartButton } from '@/components/HeartButton';
import { AUDIUS_OPEN_MUSIC_LICENSE_URL } from '@/config/legal';
import { resolve } from '@/store/library';
import { cycleRepeat, toggleShuffle, usePlaybackPrefs } from '@/store/playback';
import { cancelSleepTimer, startSleepTimer, useSleepTimer } from '@/store/sleepTimer';
import { colors, formatTime, radius, spacing, type } from '@/theme';
import type { SourceId, Track } from '@/types/track';

const SLEEP_OPTIONS = [15, 30, 45, 60, 90];

function SleepCountdown({ endsAt }: { endsAt: number }) {
  const [minutes, setMinutes] = useState(1);

  useEffect(() => {
    const update = () => {
      setMinutes(Math.max(1, Math.round((endsAt - Date.now()) / 60_000)));
    };
    const firstUpdate = setTimeout(update, 0);
    const interval = setInterval(update, 30_000);
    return () => {
      clearTimeout(firstUpdate);
      clearInterval(interval);
    };
  }, [endsAt]);

  return <Text style={styles.sleepNote}>Pausa tra {minutes} min</Text>;
}

export default function PlayerScreen() {
  const router = useRouter();
  // Android 16 impone l'edge-to-edge: il contenuto disegna sotto la barra
  // di navigazione, e senza questo margine la riga della licenza ci finisce
  // sotto — proprio quella che per Jamendo deve restare leggibile.
  const insets = useSafeAreaInsets();
  const active = useActiveMediaItem();
  const playing = useIsPlaying();
  const { position, duration } = useProgress(0.5);
  const { shuffle, repeat } = usePlaybackPrefs();
  const sleepEndsAt = useSleepTimer();

  // Mentre si trascina, il pallino segue il dito e non il player:
  // altrimenti a ogni tick di useProgress tornerebbe indietro.
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);

  /**
   * useActiveMediaItem() parte da `null` e riceve la traccia un tick dopo,
   * da una promise. Chiudere appena `active` e' vuoto significherebbe
   * chiudere sempre al primo render: la schermata non si aprirebbe mai.
   * Si esce solo dopo aver visto davvero una traccia sparire — cioe' quando
   * la coda finisce mentre il player e' aperto.
   *
   * La navigazione resta in un effetto: farla durante il render fa
   * protestare React e a volte il back si perde nel commit.
   */
  const everHadTrack = useRef(false);

  useEffect(() => {
    if (active) {
      everHadTrack.current = true;
    } else if (everHadTrack.current) {
      router.back();
    }
  }, [active, router]);

  const uid = active?.mediaId;

  /**
   * RNTP conserva solo i campi che gli abbiamo dato. Per il cuoricino
   * serve il nostro modello: prima si prova il catalogo, poi si
   * ricostruisce dal minimo indispensabile.
   */
  const track = useMemo<Track | null>(() => {
    if (!uid || !active) return null;
    const known = resolve(uid);
    if (known) return known;
    const embedded = active.extras?.track as Track | undefined;
    if (embedded?.uid === uid) return embedded;
    const [source, id] = uid.split(':');
    return {
      uid,
      source: (source === 'jamendo' ? 'jamendo' : 'audius') as SourceId,
      id: id ?? '',
      title: String(active.title ?? ''),
      artist: String(active.artist ?? ''),
      artworkUrl: typeof active.artworkUrl === 'string' ? active.artworkUrl : undefined,
      durationSec: Number(active.duration ?? 0),
      streamUrl: String(active.url ?? ''),
    };
  }, [uid, active]);

  if (!active || !track) return null;

  const shown = seekTo ?? position;

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Chiudi">
          <Ionicons name="chevron-down" size={28} color={colors.textMuted} />
        </Pressable>

        <View style={styles.topActions}>
          <Pressable
            onPress={() => setSleepOpen(true)}
            hitSlop={12}
            accessibilityLabel="Timer di spegnimento"
          >
            <Ionicons
              name={sleepEndsAt ? 'moon' : 'moon-outline'}
              size={22}
              color={sleepEndsAt ? colors.accent : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push('/queue')}
            hitSlop={12}
            accessibilityLabel="Coda di riproduzione"
          >
            <Ionicons name="list" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.artWrap}>
        {/* Qui l'immagine e' larga quanto lo schermo: la misura da lista
            ci arriverebbe sgranata. */}
        {(track.artworkLargeUrl ?? track.artworkUrl) ? (
          <Image source={{ uri: track.artworkLargeUrl ?? track.artworkUrl }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artEmpty]} />
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Text numberOfLines={2} style={styles.title}>
            {track.title}
          </Text>
          {track.artistId ? (
            <Pressable
              onPress={() => {
                router.back();
                router.push({
                  pathname: '/artist/[source]/[id]',
                  params: { source: track.source, id: track.artistId! },
                });
              }}
              hitSlop={8}
            >
              <Text numberOfLines={1} style={[styles.artist, styles.artistLink]}>
                {track.artist}
              </Text>
            </Pressable>
          ) : (
            <Text numberOfLines={1} style={styles.artist}>
              {track.artist}
            </Text>
          )}
        </View>
        <HeartButton track={track} size={26} />
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={Math.max(1, duration)}
        value={shown}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.surfaceHigh}
        thumbTintColor={colors.accent}
        onValueChange={setSeekTo}
        onSlidingComplete={(v) => {
          TrackPlayer.seekTo(v);
          setSeekTo(null);
        }}
        accessibilityLabel="Posizione nel brano"
      />

      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(shown)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={toggleShuffle}
          hitSlop={12}
          accessibilityLabel="Riproduzione casuale"
          accessibilityState={{ selected: shuffle }}
        >
          <Ionicons name="shuffle" size={24} color={shuffle ? colors.accent : colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => TrackPlayer.skipToPrevious()}
          hitSlop={16}
          accessibilityLabel="Traccia precedente"
        >
          <Ionicons name="play-skip-back" size={30} color={colors.text} />
        </Pressable>

        <Pressable
          style={styles.playButton}
          onPress={() => (playing ? TrackPlayer.pause() : TrackPlayer.play())}
          accessibilityLabel={playing ? 'Metti in pausa' : 'Riprendi'}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={32} color={colors.bg} />
        </Pressable>

        <Pressable
          onPress={() => TrackPlayer.skipToNext()}
          hitSlop={16}
          accessibilityLabel="Traccia successiva"
        >
          <Ionicons name="play-skip-forward" size={30} color={colors.text} />
        </Pressable>

        <Pressable onPress={cycleRepeat} hitSlop={12} accessibilityLabel="Modalita' di ripetizione">
          <View>
            <Ionicons
              name="repeat"
              size={24}
              color={repeat === RepeatMode.Off ? colors.textMuted : colors.accent}
            />
            {repeat === RepeatMode.One ? <Text style={styles.repeatOne}>1</Text> : null}
          </View>
        </Pressable>
      </View>

      {sleepEndsAt ? <SleepCountdown key={sleepEndsAt} endsAt={sleepEndsAt} /> : null}

      {/* Provenienza e condizioni sono parte dell'attribuzione del contenuto. */}
      <View style={styles.attribution}>
        <Text style={styles.attributionSource}>
          Brano fornito da {track.source === 'audius' ? 'Audius' : 'Jamendo'}
        </Text>
        <View style={styles.attributionLinks}>
          {track.sourceUrl ? (
            <Pressable
              onPress={() => Linking.openURL(track.sourceUrl!)}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.attributionLink}>Pagina del brano</Text>
            </Pressable>
          ) : null}
          {track.licenseUrl ? (
            <Pressable
              onPress={() => Linking.openURL(track.licenseUrl!)}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.attributionLink}>{track.rightsLabel ?? 'Creative Commons'}</Text>
            </Pressable>
          ) : null}
          {track.source === 'audius' ? (
            <>
              <Text style={styles.attributionText}>
                {track.rightsLabel ?? 'Regime di diritti non specificato'}
              </Text>
              <Pressable
                onPress={() => Linking.openURL(AUDIUS_OPEN_MUSIC_LICENSE_URL)}
                hitSlop={8}
                accessibilityRole="link"
              >
                <Text style={styles.attributionLink}>Open Music License</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      <Modal
        visible={sleepOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSleepOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSleepOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: spacing.xxl + insets.bottom }]}>
          <Text style={styles.sheetTitle}>Timer di spegnimento</Text>
          {SLEEP_OPTIONS.map((m) => (
            <Pressable
              key={m}
              style={({ pressed }) => [styles.sheetItem, pressed && styles.sheetItemPressed]}
              onPress={() => {
                startSleepTimer(m);
                setSleepOpen(false);
              }}
            >
              <Text style={styles.sheetItemText}>{m} minuti</Text>
            </Pressable>
          ))}
          {sleepEndsAt ? (
            <Pressable
              style={({ pressed }) => [styles.sheetItem, pressed && styles.sheetItemPressed]}
              onPress={() => {
                cancelSleepTimer();
                setSleepOpen(false);
              }}
            >
              <Text style={[styles.sheetItemText, { color: colors.danger }]}>Annulla il timer</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  artWrap: { alignItems: 'center', marginTop: spacing.md },
  art: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceHigh,
  },
  artEmpty: { borderWidth: 1, borderColor: colors.border },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl },
  meta: { flex: 1, gap: spacing.xs },
  title: { ...type.display, color: colors.text },
  artist: { ...type.body, color: colors.textMuted },
  artistLink: { textDecorationLine: 'underline' },
  slider: { marginTop: spacing.lg, marginHorizontal: -spacing.sm },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { ...type.caption, color: colors.textMuted },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOne: {
    position: 'absolute',
    right: -2,
    bottom: -4,
    ...type.caption,
    fontSize: 10,
    color: colors.accent,
  },
  sleepNote: { ...type.caption, color: colors.accent, textAlign: 'center', marginTop: spacing.lg },
  attribution: {
    marginTop: 'auto',
    marginBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  attributionSource: { ...type.caption, color: colors.textMuted },
  attributionLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  attributionText: { ...type.caption, color: colors.textMuted },
  attributionLink: { ...type.caption, color: colors.textMuted, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: '#000000AA' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetTitle: { ...type.title, color: colors.text, padding: spacing.lg },
  sheetItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  sheetItemPressed: { backgroundColor: colors.surfaceHigh },
  sheetItemText: { ...type.body, color: colors.text },
});
