import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AccessibilityActionEvent,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import TrackPlayer, { Event, type MediaItem } from '@rntp/player';
import { Artwork } from '@/components/Artwork';
import { PressableScale } from '@/components/PressableScale';
import { type Snack, Snackbar } from '@/components/Snackbar';
import { Empty } from '@/components/StateViews';
import { haptics } from '@/services/haptics';
import { usePlaybackPrefs } from '@/store/playback';
import { colors, formatTime, motion, spacing, touch, type } from '@/theme';
import { describeQueue } from '@/utils/queueSummary';
import { dropIndex, rowShift } from '@/utils/reorder';

/** Copertina da 44 piu' 8 di padding sopra e sotto: fissa, cosi' il riordino e' aritmetica. */
const ROW_HEIGHT = 44 + spacing.sm * 2;
const LIST_TOP = spacing.md;
const SHIFT = { duration: 120, reduceMotion: ReduceMotion.System };

const ACTIONS = [
  { name: 'moveUp', label: 'Sposta su' },
  { name: 'moveDown', label: 'Sposta giù' },
  { name: 'remove', label: 'Togli dalla coda' },
];

interface DragState {
  /** Indice della riga trascinata, -1 quando nessuna. */
  from: SharedValue<number>;
  /** Posizione su cui la riga trascinata sta passando. */
  to: SharedValue<number>;
  /** Corsa del dito dalla partenza. */
  y: SharedValue<number>;
  length: SharedValue<number>;
}

interface RowProps {
  item: MediaItem;
  index: number;
  isActive: boolean;
  isPast: boolean;
  drag: DragState;
  onPress: (index: number) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDragStart: () => void;
}

/**
 * Una riga della coda. Si riordina con la maniglia a destra: il gesto sta
 * solo li', cosi' il resto della riga continua a rispondere al tocco e la
 * lista a scorrere. Le righe fra la partenza e l'arrivo scalano di un
 * posto (`rowShift`), la riga trascinata segue il dito.
 *
 * Per TalkBack, che non trascina, le stesse mosse sono azioni della riga.
 */
const QueueRow = memo(function QueueRow({
  item,
  index,
  isActive,
  isPast,
  drag,
  onPress,
  onRemove,
  onMove,
  onDragStart,
}: RowProps) {
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-2, 2])
        .onBegin(() => {
          drag.from.set(index);
          drag.to.set(index);
          drag.y.set(0);
          scheduleOnRN(onDragStart);
        })
        .onUpdate((e) => {
          drag.y.set(e.translationY);
          drag.to.set(dropIndex(index, e.translationY, ROW_HEIGHT, drag.length.get()));
        })
        .onFinalize(() => {
          const from = drag.from.get();
          const to = drag.to.get();
          drag.from.set(-1);
          drag.to.set(-1);
          drag.y.set(0);
          scheduleOnRN(onMove, from, to);
        }),
    [drag, index, onDragStart, onMove],
  );

  const animated = useAnimatedStyle(() => {
    const from = drag.from.get();
    if (from < 0) return { transform: [{ translateY: 0 }], zIndex: 0 };
    if (from === index) {
      return { transform: [{ translateY: drag.y.get() }, { scale: 1.02 }], zIndex: 10 };
    }
    return {
      transform: [
        { translateY: withTiming(rowShift(index, from, drag.to.get(), ROW_HEIGHT), SHIFT) },
      ],
      zIndex: 0,
    };
  });

  const onAction = useCallback(
    ({ nativeEvent }: AccessibilityActionEvent) => {
      if (nativeEvent.actionName === 'moveUp') onMove(index, index - 1);
      else if (nativeEvent.actionName === 'moveDown') onMove(index, index + 1);
      else if (nativeEvent.actionName === 'remove' && !isActive) onRemove(index);
    },
    [index, isActive, onMove, onRemove],
  );

  return (
    <Animated.View style={[styles.rowWrap, animated]}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed, isPast && styles.past]}
        onPress={() => onPress(index)}
        accessibilityLabel={`Passa a ${item.title}`}
        accessibilityActions={ACTIONS}
        onAccessibilityAction={onAction}
      >
        {/* In RNTP l'artwork puo' essere anche una risorsa locale, non
            solo un URL: qui si mostra solo la stringa. */}
        <Artwork
          uri={typeof item.artworkUrl === 'string' ? item.artworkUrl : undefined}
          size={44}
          recyclingKey={String(item.mediaId ?? '') + ':' + index}
          fade={false}
        />

        <View style={styles.meta}>
          <Text numberOfLines={1} style={[styles.rowTitle, isActive && styles.rowTitleActive]}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.rowArtist}>
            {item.artist}
          </Text>
        </View>

        <Text style={styles.duration}>{formatTime(Number(item.duration ?? 0))}</Text>

        {/* RNTP non permette di rimuovere la traccia in riproduzione.
            Togliere un brano vibra `reject` come in playlist: stessa
            azione, stesso feedback. */}
        <Pressable
          disabled={isActive}
          style={({ pressed }) => [touch.target, pressed && styles.textPressed]}
          onPress={() => onRemove(index)}
          accessibilityRole="button"
          accessibilityLabel={`Togli ${item.title} dalla coda`}
        >
          <Ionicons name="close" size={20} color={isActive ? colors.border : colors.textMuted} />
        </Pressable>

        <GestureDetector gesture={pan}>
          <View
            style={[styles.handle, touch.target]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons name="reorder-three" size={22} color={colors.textMuted} />
          </View>
        </GestureDetector>
      </Pressable>
    </Animated.View>
  );
});

/**
 * La coda vive dentro RNTP, non in uno store nostro: e' l'unica fonte
 * di verita' anche quando i comandi arrivano dalla notifica. Qui la si
 * legge e basta, ricaricandola a ogni cambio di traccia.
 */
export default function QueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shuffle } = usePlaybackPrefs();
  const [items, setItems] = useState<MediaItem[]>(() => TrackPlayer.getQueue());
  const [activeIndex, setActiveIndex] = useState<number | null>(() =>
    TrackPlayer.getActiveMediaItemIndex(),
  );
  const [snack, setSnack] = useState<Snack | null>(null);
  // La lista non scorre mentre una riga e' in mano: lo scroll e il
  // trascinamento sullo stesso asse si ruberebbero il gesto a vicenda.
  const [dragging, setDragging] = useState(false);

  const dragFrom = useSharedValue(-1);
  const dragTo = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const dragLength = useSharedValue(0);
  const drag = useMemo<DragState>(
    () => ({ from: dragFrom, to: dragTo, y: dragY, length: dragLength }),
    [dragFrom, dragTo, dragY, dragLength],
  );

  const load = useCallback(() => {
    setItems(TrackPlayer.getQueue());
    setActiveIndex(TrackPlayer.getActiveMediaItemIndex());
  }, []);

  useEffect(() => {
    drag.length.set(items.length);
  }, [drag, items.length]);

  // RNTP non emette un evento "coda cambiata" per la transizione: il
  // cambio di traccia e' il momento in cui vale la pena rileggerla.
  useEffect(() => {
    const queueSub = TrackPlayer.addEventListener(Event.QueueChanged, load);
    const trackSub = TrackPlayer.addEventListener(Event.MediaItemTransition, load);
    return () => {
      queueSub.remove();
      trackSub.remove();
    };
  }, [load]);

  const summary = describeQueue({ length: items.length, activeIndex, shuffle });

  const dismissSnack = useCallback(() => setSnack(null), []);

  /**
   * Svuotare non e' definitivo: i brani tolti restano in mano per
   * qualche secondo e "Annulla" li rimette dopo il brano che suona
   * adesso — che nel frattempo puo' essere cambiato, per questo l'indice
   * si rilegge al momento.
   */
  const clearBelow = () => {
    if (activeIndex === null) return;
    if (activeIndex >= items.length - 1) return;
    haptics.reject();
    const removed = items.slice(activeIndex + 1);
    TrackPlayer.removeMediaItems(activeIndex + 1, items.length);
    load();
    setSnack({
      message: `${removed.length} ${removed.length === 1 ? 'brano tolto' : 'brani tolti'} dalla coda`,
      action: {
        label: 'Annulla',
        onPress: () => {
          const current = TrackPlayer.getActiveMediaItemIndex() ?? -1;
          TrackPlayer.insertMediaItems(current + 1, removed);
          haptics.success();
          load();
        },
      },
    });
  };

  const onPress = useCallback(
    (index: number) => {
      haptics.tap();
      TrackPlayer.skipToIndex(index);
      TrackPlayer.play();
      load();
    },
    [load],
  );

  const onRemove = useCallback(
    (index: number) => {
      haptics.reject();
      TrackPlayer.removeMediaItem(index);
      load();
    },
    [load],
  );

  const onDragStart = useCallback(() => setDragging(true), []);

  const onMove = useCallback(
    (from: number, to: number) => {
      setDragging(false);
      const length = TrackPlayer.getQueue().length;
      if (from < 0 || to < 0 || from >= length || to >= length || from === to) return;
      haptics.gestureEnd();
      // Media3 sposta l'elemento senza toccare quello in riproduzione.
      TrackPlayer.moveMediaItem(from, to);
      load();
    },
    [load],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <PressableScale
          onPress={() => router.back()}
          containerStyle={touch.target}
          scaleTo={motion.iconPressScale}
          accessibilityRole="button"
          accessibilityLabel="Chiudi"
        >
          <Ionicons name="chevron-down" size={28} color={colors.textMuted} />
        </PressableScale>
        {summary.clearLabel ? (
          <Pressable
            onPress={clearBelow}
            style={({ pressed }) => [touch.target, pressed && styles.textPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.clear}>{summary.clearLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.title}>In coda</Text>
      <Text style={styles.subtitle}>{summary.subtitle}</Text>
      {/* Con lo shuffle l'elenco non e' l'ordine di ascolto e non
          possiamo ricavarlo: meglio dirlo che lasciarlo intuire. */}
      {summary.notice ? <Text style={styles.notice}>{summary.notice}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(t, i) => `${String(t.mediaId ?? 'x')}:${i}`}
        scrollEnabled={!dragging}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: LIST_TOP + ROW_HEIGHT * index,
          index,
        })}
        // La coda e' una modale sopra lo Stack: il SafeAreaView radice
        // copre solo il bordo alto, quindi il fondo se lo paga da se'.
        // Va nel contentContainerStyle e non sullo schermo, altrimenti la
        // lista smetterebbe di scorrere sotto la navigation bar e l'ultima
        // riga resterebbe comunque irraggiungibile con la X di rimozione.
        contentContainerStyle={[styles.list, { paddingBottom: spacing.xxl + insets.bottom }]}
        ListEmptyComponent={<Empty title="Coda vuota" hint="Scegli un brano per iniziare." />}
        renderItem={({ item, index }) => (
          <QueueRow
            item={item}
            index={index}
            isActive={index === activeIndex}
            isPast={summary.dimPlayed && activeIndex !== null && index < activeIndex}
            drag={drag}
            onPress={onPress}
            onRemove={onRemove}
            onMove={onMove}
            onDragStart={onDragStart}
          />
        )}
      />

      <Snackbar snack={snack} onDismiss={dismissSnack} bottom={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  clear: { ...type.caption, color: colors.accent },
  // Testo e icone dentro le righe: evidenziazione, non scala, come le righe.
  textPressed: { opacity: 0.5 },
  title: {
    ...type.display,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  subtitle: { ...type.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },
  notice: {
    ...type.caption,
    color: colors.accent,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  list: { paddingTop: LIST_TOP, flexGrow: 1 },
  rowWrap: { backgroundColor: colors.bg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    height: ROW_HEIGHT,
  },
  pressed: { backgroundColor: colors.surface },
  past: { opacity: 0.45 },
  meta: { flex: 1, gap: 2 },
  rowTitle: { ...type.body, color: colors.text },
  rowTitleActive: { color: colors.accent },
  rowArtist: { ...type.caption, color: colors.textMuted },
  duration: {
    ...type.caption,
    ...type.tabular,
    color: colors.textMuted,
  },
  handle: { paddingLeft: spacing.xs },
});
