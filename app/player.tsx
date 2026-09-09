import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import TrackPlayer, { RepeatMode } from '@rntp/player';
import { Artwork } from '@/components/Artwork';
import { HeartButton } from '@/components/HeartButton';
import { PressableScale } from '@/components/PressableScale';
import { AUDIUS_OPEN_MUSIC_LICENSE_URL } from '@/config/legal';
import { usePlaybackStatus } from '@/hooks/usePlaybackStatus';
import { useUpNext } from '@/hooks/useUpNext';
import { haptics } from '@/services/haptics';
import { trackFromMediaItem } from '@/services/mediaItems';
import { notificationRemedy } from '@/services/notificationPolicy';
import { describePlayButton } from '@/services/playbackStatus';
import { artworkLayout } from '@/services/playerLayout';
import {
  retryPlayback,
  skipToNext,
  skipToPrevious,
  togglePlayback,
} from '@/services/playerCommands';
import { resolve } from '@/store/library';
import {
  resolveNotificationPermission,
  useNotificationPermission,
} from '@/store/notificationPermission';
import { cycleRepeat, toggleShuffle, usePlaybackPrefs } from '@/store/playback';
import { useProgress } from '@/store/progress';
import { activateSession, seekPending, useNowPlaying } from '@/store/session';
import { cancelSleepTimer, startSleepTimer, useSleepTimer } from '@/store/sleepTimer';
import { colors, formatTime, motion, radius, spacing, touch, type } from '@/theme';
import type { Track } from '@/types/track';
import { upNextLabel } from '@/utils/upNext';

const SLEEP_OPTIONS = [15, 30, 45, 60, 90];

/** La stessa molla dei bottoni: copertina e foglio rispondono con la stessa mano. */
const SPRING = { ...motion.press, reduceMotion: ReduceMotion.System };
/**
 * Il ritorno del foglio non supera lo zero. La molla condivisa ha un
 * leggero overshoot (~8%) che su un bottone e' invisibile, ma su 120dp di
 * corsa porterebbe il pannello sopra il bordo e, con la route trasparente,
 * scoprirebbe per qualche frame in basso la schermata sotto.
 */
const SHEET_SPRING = { ...SPRING, overshootClamping: true };
/** Spegne lo scrim in fretta, prima che lo Stack porti via la schermata. */
const FADE = { duration: 120, reduceMotion: ReduceMotion.System };

/** Oltre questa corsa, o con uno strappo deciso, il trascinamento chiude. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
/** In pausa la copertina si ritrae di poco: il "respiro" dei player di riferimento. */
const PAUSED_SCALE = 0.92;
/**
 * Rientro orizzontale e altezza della traccia della SeekBar Android
 * (stile AppCompat): la nostra traccia di sfondo, con la porzione
 * bufferizzata, deve sovrapporsi a quella nativa.
 */
const SLIDER_INSET = 16;
const SLIDER_TRACK_HEIGHT = 4;

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
  // La copertina si adatta a quel che resta dello schermo, cosi' controlli
  // e licenza non finiscono mai fuori; se non basta, il pannello scorre.
  const window = useWindowDimensions();
  const art = artworkLayout({
    width: window.width,
    height: window.height,
    fontScale: window.fontScale,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    horizontalPadding: spacing.xl,
  });
  // Il brano puo' venire dal player nativo o dalla coda ripristinata dopo
  // un riavvio: finche' e' `pending` il player non lo conosce ancora.
  const { item: active, pending } = useNowPlaying();
  const status = usePlaybackStatus();
  const notificationFix = notificationRemedy(useNotificationPermission());
  const { position, duration, buffered } = useProgress();
  const { shuffle, repeat } = usePlaybackPrefs();
  const sleepEndsAt = useSleepTimer();
  const upNext = useUpNext();

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

  /**
   * Il foglio scende sotto il dito; lo scrim dietro si schiarisce con la
   * corsa, cosi' quello che sta sotto si intravede (la route e' un
   * transparentModal, vedi _layout). `scrimFade` serve solo alla chiusura:
   * se lo scrim restasse acceso, la fascia scura sopra il foglio scenderebbe
   * insieme a lui durante l'animazione dello Stack.
   */
  const translateY = useSharedValue(0);
  const scrimFade = useSharedValue(1);
  // Anche il buffering tiene la copertina a misura piena: e' un brano che
  // sta andando avanti, non una pausa, e un respiro a ogni buco di rete
  // racconterebbe una pausa che nessuno ha chiesto.
  const engaged = status === 'playing' || status === 'buffering';
  const artScale = useSharedValue(engaged ? 1 : PAUSED_SCALE);

  useEffect(() => {
    artScale.set(withSpring(engaged ? 1 : PAUSED_SCALE, SPRING));
  }, [artScale, engaged]);

  // La Coda legge il player nativo: la coda ripristinata va caricata
  // prima, senza far partire niente.
  const openQueue = useCallback(() => {
    activateSession({ play: false });
    router.push('/queue');
  }, [router]);

  const dismiss = useCallback(() => {
    // Aperto da un deep link senza niente sotto, `back()` non farebbe nulla
    // e il foglio resterebbe a mezz'aria: meglio riportarlo a posto.
    if (!router.canGoBack()) {
      translateY.set(withSpring(0, SHEET_SPRING));
      return;
    }
    scrimFade.set(withTiming(0, FADE));
    haptics.gestureEnd();
    router.back();
  }, [router, scrimFade, translateY]);

  /**
   * Il gesto copre solo la parte sopra lo slider: su tutta la schermata
   * ruberebbe i trascinamenti orizzontali del pallino. La soglia verticale
   * e il fallimento su X lasciano passare i tocchi a bottoni e link.
   */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          translateY.set(Math.max(0, e.translationY));
        })
        .onEnd((e) => {
          if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
            scheduleOnRN(dismiss);
          } else {
            translateY.set(withSpring(0, SHEET_SPRING));
          }
        }),
    [dismiss, translateY],
  );

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(translateY.get(), [0, 300], [0.55, 0], Extrapolation.CLAMP) * scrimFade.get(),
  }));
  const artStyle = useAnimatedStyle(() => ({ transform: [{ scale: artScale.get() }] }));

  const uid = active?.mediaId;

  /**
   * RNTP conserva solo i campi che gli abbiamo dato. Per il cuoricino
   * serve il nostro modello: prima si prova il catalogo, poi la copia
   * che viaggia dentro l'elemento della coda.
   */
  const track = useMemo<Track | null>(() => {
    if (!uid || !active) return null;
    return resolve(uid) ?? trackFromMediaItem(active);
  }, [uid, active]);

  if (!active || !track) return null;

  const shown = seekTo ?? position;
  const bufferedPct = duration > 0 ? Math.min(1, Math.max(0, buffered / duration)) : 0;
  const playButton = describePlayButton(status);
  const nextLabel = upNextLabel(upNext);

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom }, panelStyle]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={art.cramped}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <GestureDetector gesture={pan}>
            <View>
              {/* Icone sole: tutte con la scala da icona, cosi' nella stessa
                riga niente risponde in modo diverso dal vicino. */}
              <View style={styles.topBar}>
                <PressableScale
                  onPress={() => router.back()}
                  containerStyle={touch.target}
                  scaleTo={motion.iconPressScale}
                  accessibilityRole="button"
                  accessibilityLabel="Chiudi"
                >
                  <Ionicons name="chevron-down" size={28} color={colors.textMuted} />
                </PressableScale>

                <View style={styles.topActions}>
                  <PressableScale
                    onPress={() => setSleepOpen(true)}
                    containerStyle={touch.target}
                    scaleTo={motion.iconPressScale}
                    accessibilityRole="button"
                    accessibilityLabel="Timer di spegnimento"
                  >
                    <Ionicons
                      name={sleepEndsAt ? 'moon' : 'moon-outline'}
                      size={22}
                      color={sleepEndsAt ? colors.accent : colors.textMuted}
                    />
                  </PressableScale>
                  <PressableScale
                    onPress={openQueue}
                    containerStyle={touch.target}
                    scaleTo={motion.iconPressScale}
                    accessibilityRole="button"
                    accessibilityLabel="Coda di riproduzione"
                  >
                    <Ionicons name="list" size={24} color={colors.textMuted} />
                  </PressableScale>
                </View>
              </View>

              <Animated.View style={[styles.artWrap, artStyle]}>
                {/* Qui l'immagine e' larga quanto lo schermo: la misura da lista
                  ci arriverebbe sgranata. */}
                <Artwork
                  uri={track.artworkLargeUrl ?? track.artworkUrl}
                  radius={radius.lg}
                  priority="high"
                  style={{ width: art.size, height: art.size }}
                />
              </Animated.View>

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
                      accessibilityRole="link"
                      accessibilityLabel={`Vai alla pagina di ${track.artist}`}
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
            </View>
          </GestureDetector>

          {/* La porzione gia' scaricata sta dietro lo slider, che disegna
            solo la parte suonata e il pallino: la traccia di sfondo e' la
            nostra, cosi' ci si puo' disegnare sopra il buffer. */}
          <View style={styles.sliderWrap}>
            <View style={styles.sliderTrack} pointerEvents="none">
              <View style={[styles.sliderBuffered, { transform: [{ scaleX: bufferedPct }] }]} />
            </View>
            <Slider
              minimumValue={0}
              maximumValue={Math.max(1, duration)}
              value={shown}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor="transparent"
              thumbTintColor={colors.accent}
              onValueChange={setSeekTo}
              onSlidingComplete={(v) => {
                // Prima del primo play il brano non e' nel player: si
                // ricorda solo da dove ripartira'.
                if (pending) seekPending(v);
                else TrackPlayer.seekTo(v);
                setSeekTo(null);
              }}
              accessibilityLabel="Posizione nel brano"
            />
          </View>

          <View style={styles.times}>
            <Text style={styles.time}>{formatTime(shown)}</Text>
            <Text style={styles.time}>{formatTime(duration)}</Text>
          </View>

          <View style={styles.controls}>
            <PressableScale
              onPress={() => {
                haptics.toggle(!shuffle);
                toggleShuffle();
              }}
              containerStyle={touch.target}
              scaleTo={motion.iconPressScale}
              accessibilityRole="button"
              accessibilityLabel="Riproduzione casuale"
              accessibilityState={{ selected: shuffle }}
            >
              <Ionicons
                name="shuffle"
                size={24}
                color={shuffle ? colors.accent : colors.textMuted}
              />
            </PressableScale>

            <PressableScale
              onPress={skipToPrevious}
              containerStyle={touch.target}
              scaleTo={motion.iconPressScale}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel="Traccia precedente"
            >
              <Ionicons name="play-skip-back" size={30} color={colors.text} />
            </PressableScale>

            <PressableScale
              style={styles.playButton}
              onPress={() => togglePlayback(status)}
              scaleTo={motion.iconPressScale}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel={playButton.label}
              accessibilityState={{ busy: playButton.busy }}
            >
              {playButton.busy ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Ionicons name={playButton.icon} size={32} color={colors.bg} />
              )}
            </PressableScale>

            <PressableScale
              onPress={skipToNext}
              containerStyle={touch.target}
              scaleTo={motion.iconPressScale}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel="Traccia successiva"
            >
              <Ionicons name="play-skip-forward" size={30} color={colors.text} />
            </PressableScale>

            <PressableScale
              onPress={() => haptics.toggle(cycleRepeat() !== RepeatMode.Off)}
              containerStyle={touch.target}
              scaleTo={motion.iconPressScale}
              accessibilityRole="button"
              accessibilityLabel="Modalità di ripetizione"
              accessibilityState={{ selected: repeat !== RepeatMode.Off }}
            >
              <View>
                <Ionicons
                  name="repeat"
                  size={24}
                  color={repeat === RepeatMode.Off ? colors.textMuted : colors.accent}
                />
                {repeat === RepeatMode.One ? <Text style={styles.repeatOne}>1</Text> : null}
              </View>
            </PressableScale>
          </View>

          {/* Cosa viene dopo, senza aprire la Coda: e' la domanda piu'
            frequente davanti a un player, e la risposta sta in una riga. */}
          {nextLabel ? (
            <Pressable
              onPress={openQueue}
              style={({ pressed }) => [styles.upNext, pressed && styles.upNextPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Prossimo: ${nextLabel}. Apri la coda di riproduzione`}
            >
              <Ionicons name="list-outline" size={16} color={colors.textMuted} />
              <Text numberOfLines={1} style={styles.upNextText}>
                <Text style={styles.upNextKey}>Prossimo · </Text>
                {nextLabel}
              </Text>
            </Pressable>
          ) : null}

          {/* L'errore si dice e si risolve qui, non solo con un'icona: il
            budget di salti (playbackPolicy) copre i brani rotti, ma una
            rete caduta lascia il player fermo in attesa di qualcuno. */}
          {status === 'error' ? (
            <View style={styles.problem} accessibilityLiveRegion="polite">
              <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
              <Text style={styles.problemText}>Il brano non risponde. Controlla la rete.</Text>
              <PressableScale
                onPress={retryPlayback}
                haptic="tap"
                style={styles.problemAction}
                accessibilityRole="button"
                accessibilityLabel="Riprova a riprodurre"
              >
                <Text style={styles.problemActionText}>Riprova</Text>
              </PressableScale>
            </View>
          ) : null}

          {/* Senza permesso la notifica non compare e nessuno lo dice: qui si
            spiega cosa manca e si offre la via per rimediare. */}
          {notificationFix ? (
            <View style={styles.problem} accessibilityLiveRegion="polite">
              <Ionicons name="notifications-off-outline" size={18} color={colors.danger} />
              <Text style={styles.problemText}>
                Notifiche disattivate: niente controlli nella schermata di blocco.
              </Text>
              <PressableScale
                onPress={resolveNotificationPermission}
                haptic="tap"
                style={styles.problemAction}
                accessibilityRole="button"
                accessibilityLabel={
                  notificationFix.kind === 'request'
                    ? 'Consenti le notifiche'
                    : 'Apri le impostazioni delle notifiche'
                }
              >
                <Text style={styles.problemActionText}>{notificationFix.label}</Text>
              </PressableScale>
            </View>
          ) : null}

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
                  <Text style={styles.attributionLink}>
                    {track.rightsLabel ?? 'Creative Commons'}
                  </Text>
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
        </ScrollView>

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
                  haptics.success();
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
                  haptics.reject();
                  setSleepOpen(false);
                }}
              >
                <Text style={[styles.sheetItemText, { color: colors.danger }]}>
                  Annulla il timer
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Modal>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { backgroundColor: '#000000', pointerEvents: 'none' },
  // Lo sfondo sta qui e non sulla route: la route e' trasparente perche'
  // sotto il foglio trascinato si veda la schermata precedente. Gli angoli
  // in alto danno al foglio la sua identita' anche da aperto; sotto la
  // safe area restano quasi invisibili.
  panel: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
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
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  artWrap: { alignItems: 'center', marginTop: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl },
  meta: { flex: 1, gap: spacing.xs },
  title: { ...type.display, color: colors.text },
  artist: { ...type.body, color: colors.textMuted },
  artistLink: { textDecorationLine: 'underline' },
  sliderWrap: { marginTop: spacing.lg, marginHorizontal: -spacing.sm, justifyContent: 'center' },
  sliderTrack: {
    position: 'absolute',
    left: SLIDER_INSET,
    right: SLIDER_INSET,
    top: '50%',
    marginTop: -SLIDER_TRACK_HEIGHT / 2,
    height: SLIDER_TRACK_HEIGHT,
    borderRadius: SLIDER_TRACK_HEIGHT / 2,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  sliderBuffered: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.border,
    transformOrigin: 'left',
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { ...type.caption, ...type.tabular, color: colors.textMuted },
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
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
    minHeight: touch.target.minHeight,
  },
  upNextPressed: { opacity: 0.5 },
  upNextText: { ...type.caption, color: colors.text, flex: 1 },
  upNextKey: { color: colors.textMuted },
  problem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderLeftWidth: 2,
    borderLeftColor: colors.danger,
  },
  problemText: { ...type.caption, color: colors.textMuted, flex: 1 },
  problemAction: {
    justifyContent: 'center',
    minHeight: touch.target.minHeight - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
  },
  problemActionText: { ...type.label, fontSize: 13, color: colors.text },
  sleepNote: {
    ...type.caption,
    ...type.tabular,
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
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
