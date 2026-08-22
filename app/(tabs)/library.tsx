import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Empty } from '@/components/StateViews';
import { createPlaylist, useLibrary } from '@/store/library';
import { colors, radius, spacing, type } from '@/theme';

/**
 * Tutto locale, nessun account. Le playlist vivono su MMKV e sono escluse
 * dal backup cloud e dal trasferimento Android.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const { favorites, history, playlists } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = () => {
    if (!name.trim()) return;
    const id = createPlaylist(name);
    setName('');
    setCreating(false);
    router.push({ pathname: '/playlist/[id]', params: { id } });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Libreria</Text>
        </View>

        <Shelf
          icon="heart"
          tint={colors.accent}
          label="Preferiti"
          detail={`${favorites.length} ${favorites.length === 1 ? 'brano' : 'brani'}`}
          onPress={() => router.push('/collection/favorites')}
        />
        <Shelf
          icon="time-outline"
          label="Ascoltati di recente"
          detail={`${history.length} ${history.length === 1 ? 'brano' : 'brani'}`}
          onPress={() => router.push('/collection/history')}
        />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Playlist</Text>
          <Pressable
            onPress={() => setCreating(true)}
            hitSlop={12}
            accessibilityLabel="Nuova playlist"
          >
            <Ionicons name="add" size={24} color={colors.accent} />
          </Pressable>
        </View>

        {playlists.length === 0 ? (
          <Empty
            title="Nessuna playlist"
            hint="Tocca + qui sopra, oppure tieni premuto un brano e scegli 'Aggiungi a una playlist'."
          />
        ) : (
          playlists.map((p) => (
            <Shelf
              key={p.id}
              icon="musical-notes-outline"
              label={p.name}
              detail={`${p.trackUids.length} ${p.trackUids.length === 1 ? 'brano' : 'brani'}`}
              onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: p.id } })}
            />
          ))
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Onda</Text>
        </View>
        <Shelf
          icon="information-circle-outline"
          label="Informazioni e privacy"
          detail="Dati, sorgenti, licenze e versione"
          onPress={() => router.push('../about')}
        />
      </ScrollView>

      <Modal
        visible={creating}
        transparent
        animationType="fade"
        onRequestClose={() => setCreating(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCreating(false)} />
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Nuova playlist</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Come la chiamiamo?"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={create}
          />
          <Pressable
            style={[styles.cta, !name.trim() && styles.ctaOff]}
            disabled={!name.trim()}
            onPress={create}
          >
            <Text style={styles.ctaText}>Crea</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function Shelf({
  icon,
  label,
  detail,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shelf, pressed && styles.shelfPressed]}
      accessibilityRole="button"
    >
      <View style={styles.shelfIcon}>
        <Ionicons name={icon} size={22} color={tint ?? colors.textMuted} />
      </View>
      <View style={styles.shelfMeta}>
        <Text numberOfLines={1} style={styles.shelfLabel}>
          {label}
        </Text>
        <Text style={styles.shelfDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...type.display, color: colors.text },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...type.title, color: colors.text },
  shelf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  shelfPressed: { backgroundColor: colors.surface },
  shelfIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfMeta: { flex: 1, gap: 2 },
  shelfLabel: { ...type.body, color: colors.text },
  shelfDetail: { ...type.caption, color: colors.textMuted },
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
