import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, { Event, type MediaItem } from '@rntp/player';
import { Empty } from '@/components/StateViews';
import { usePlaybackPrefs } from '@/store/playback';
import { colors, formatTime, radius, spacing, type } from '@/theme';
import { describeQueue } from '@/utils/queueSummary';

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

  const load = useCallback(() => {
    setItems(TrackPlayer.getQueue());
    setActiveIndex(TrackPlayer.getActiveMediaItemIndex());
  }, []);

  // RNTP non emette un evento "coda cambiata": il cambio di traccia e'
  // il momento in cui vale la pena rileggerla.
  useEffect(() => {
    const queueSub = TrackPlayer.addEventListener(Event.QueueChanged, load);
    const trackSub = TrackPlayer.addEventListener(Event.MediaItemTransition, load);
    return () => {
      queueSub.remove();
      trackSub.remove();
    };
  }, [load]);

  const summary = describeQueue({ length: items.length, activeIndex, shuffle });

  const clearBelow = () => {
    if (activeIndex === null) return;
    if (activeIndex >= items.length - 1) return;
    TrackPlayer.removeMediaItems(activeIndex + 1, items.length);
    load();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Chiudi">
          <Ionicons name="chevron-down" size={28} color={colors.textMuted} />
        </Pressable>
        {summary.clearLabel ? (
          <Pressable onPress={clearBelow} hitSlop={12}>
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
        // La coda e' una modale sopra lo Stack: il SafeAreaView radice
        // copre solo il bordo alto, quindi il fondo se lo paga da se'.
        // Va nel contentContainerStyle e non sullo schermo, altrimenti la
        // lista smetterebbe di scorrere sotto la navigation bar e l'ultima
        // riga resterebbe comunque irraggiungibile con la X di rimozione.
        contentContainerStyle={[styles.list, { paddingBottom: spacing.xxl + insets.bottom }]}
        ListEmptyComponent={<Empty title="Coda vuota" hint="Scegli un brano per iniziare." />}
        renderItem={({ item, index }) => {
          const isActive = index === activeIndex;
          const isPast = summary.dimPlayed && activeIndex !== null && index < activeIndex;

          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                pressed && styles.pressed,
                isPast && styles.past,
              ]}
              onPress={() => {
                TrackPlayer.skipToIndex(index);
                TrackPlayer.play();
                load();
              }}
              accessibilityLabel={`Passa a ${item.title}`}
            >
              {typeof item.artworkUrl === 'string' ? (
                <Image source={{ uri: item.artworkUrl }} style={styles.art} />
              ) : (
                <View style={[styles.art, styles.artEmpty]} />
              )}

              <View style={styles.meta}>
                <Text
                  numberOfLines={1}
                  style={[styles.rowTitle, isActive && styles.rowTitleActive]}
                >
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.rowArtist}>
                  {item.artist}
                </Text>
              </View>

              <Text style={styles.duration}>{formatTime(Number(item.duration ?? 0))}</Text>

              {/* RNTP non permette di rimuovere la traccia in riproduzione. */}
              <Pressable
                hitSlop={10}
                disabled={isActive}
                onPress={() => {
                  TrackPlayer.removeMediaItem(index);
                  load();
                }}
                accessibilityLabel={`Togli ${item.title} dalla coda`}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={isActive ? colors.border : colors.textMuted}
                />
              </Pressable>
            </Pressable>
          );
        }}
      />
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
  list: { paddingTop: spacing.md, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: { backgroundColor: colors.surface },
  past: { opacity: 0.45 },
  art: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  artEmpty: { borderWidth: 1, borderColor: colors.border },
  meta: { flex: 1, gap: 2 },
  rowTitle: { ...type.body, color: colors.text },
  rowTitleActive: { color: colors.accent },
  rowArtist: { ...type.caption, color: colors.textMuted },
  duration: { ...type.caption, color: colors.textMuted },
});
