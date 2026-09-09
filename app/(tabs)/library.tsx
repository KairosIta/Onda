import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { Empty } from '@/components/StateViews';
import { haptics } from '@/services/haptics';
import { exportLibrary, pickBackup, saveLibrary } from '@/services/libraryBackup';
import { createPlaylist, getLibrary, importLibrary, useLibrary } from '@/store/library';
import { previewImport, type ImportPreview } from '@/store/libraryExport';
import type { LibraryState } from '@/store/librarySchema';
import { colors, motion, radius, spacing, touch, type } from '@/theme';

/** Righe dell'anteprima: si mostra solo cio' che cambia davvero. */
function previewLines(p: ImportPreview): string[] {
  const righe: string[] = [];
  const n = (v: number, uno: string, molti: string) => `${v} ${v === 1 ? uno : molti}`;
  if (p.newFavorites) righe.push(n(p.newFavorites, 'nuovo preferito', 'nuovi preferiti'));
  if (p.newPlaylists) righe.push(n(p.newPlaylists, 'nuova playlist', 'nuove playlist'));
  if (p.grownPlaylists) righe.push(n(p.grownPlaylists, 'playlist ampliata', 'playlist ampliate'));
  if (p.newTracks) righe.push(n(p.newTracks, 'nuovo brano', 'nuovi brani'));
  if (p.newHistory) righe.push(n(p.newHistory, 'voce di cronologia', 'voci di cronologia'));
  return righe;
}

/**
 * Tutto locale, nessun account. Le playlist vivono su MMKV e sono escluse
 * dal backup cloud e dal trasferimento Android.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const { favorites, history, playlists } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // L'import non parte finche' non si e' visto cosa entra.
  const [pending, setPending] = useState<{ library: LibraryState; preview: ImportPreview } | null>(
    null,
  );

  const doExport = async () => {
    setBusy(true);
    const esito = await exportLibrary(getLibrary());
    setBusy(false);
    if (!esito.ok) {
      haptics.reject();
      setMessage(`Export non riuscito: ${esito.reason}`);
    } else if (!esito.shared) {
      haptics.success();
      setMessage(`File scritto in ${esito.uri}`);
    }
    // Con il menu di condivisione la promessa si risolve al ritorno
    // nell'app, anche se l'utente ha solo chiuso il menu: non sappiamo
    // se la copia e' uscita davvero, quindi niente conferma tattile.
  };

  const doSave = async () => {
    setBusy(true);
    const esito = await saveLibrary(getLibrary());
    setBusy(false);
    if (esito.ok) {
      haptics.success();
      setMessage(`Salvata come ${esito.name}.`);
      return;
    }
    // Un ripensamento non e' un errore: si tace.
    if ('canceled' in esito) return;
    haptics.reject();
    setMessage(`Salvataggio non riuscito: ${esito.reason}`);
  };

  const doPick = async () => {
    setBusy(true);
    const esito = await pickBackup();
    setBusy(false);
    if (esito.ok) {
      setPending({ library: esito.library, preview: previewImport(getLibrary(), esito.library) });
    } else if (!('canceled' in esito)) {
      haptics.reject();
      setMessage(esito.reason);
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    const fatto = importLibrary(pending.library);
    setPending(null);
    // Un file che non aggiunge niente non e' un errore: si tace.
    if (!fatto.empty) haptics.success();
    setMessage(fatto.empty ? 'Niente da aggiungere.' : 'Libreria importata.');
  };

  // La vibrazione sta qui e non sul bottone: da tastiera (Invio) e da
  // "Crea" la playlist nasce allo stesso modo, con lo stesso `success`
  // di "Crea e aggiungi" nel menu contestuale.
  const create = () => {
    if (!name.trim()) return;
    const id = createPlaylist(name);
    haptics.success();
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
          {/* Icona sola, senza sfondo: si ritrae piu' di un bottone pieno,
              altrimenti il movimento non si vede. Senza `haptic`: apre una
              finestra, e le aperture nell'app non vibrano. */}
          <PressableScale
            onPress={() => setCreating(true)}
            containerStyle={touch.target}
            scaleTo={motion.iconPressScale}
            accessibilityRole="button"
            accessibilityLabel="Nuova playlist"
          >
            <Ionicons name="add" size={24} color={colors.accent} />
          </PressableScale>
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
        {/* Due gesti diversi, due righe: «dove lo metto» non e' «a chi lo
            mando», e la seconda strada fa uscire i dati dal telefono. */}
        <Shelf
          icon="save-outline"
          label="Salva la libreria"
          detail="Un file JSON in una cartella che scegli tu"
          onPress={doSave}
          disabled={busy}
        />
        <Shelf
          icon="share-outline"
          label="Condividi una copia"
          detail="La manda a un'altra app: i dati escono dal telefono"
          onPress={doExport}
          disabled={busy}
        />
        <Shelf
          icon="download-outline"
          label="Importa una libreria"
          detail="Aggiunge a quella attuale, senza togliere niente"
          onPress={doPick}
          disabled={busy}
        />
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
          {/* L'opacita' da spento sta sul contenitore che si anima, cosi' il
              bottone resta un pezzo solo anche mentre si ritrae. */}
          <PressableScale
            style={[styles.cta, !name.trim() && styles.ctaOff]}
            disabled={!name.trim()}
            onPress={create}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Crea</Text>
          </PressableScale>
        </View>
      </Modal>

      {/* Anteprima: chiedere "importo?" senza dire cosa entra non e' una
          conferma, e questa e' l'unica azione che tocca dati non
          recuperabili. */}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPending(null)} />
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Importare questo file?</Text>
          {pending?.preview.empty ? (
            <Text style={styles.dialogBody}>
              {'Il file non aggiunge niente: è già tutto in libreria.'}
            </Text>
          ) : (
            <Text style={styles.dialogBody}>
              {previewLines(pending?.preview ?? EMPTY_PREVIEW).join('\n')}
            </Text>
          )}
          <Text style={styles.dialogNote}>
            {"Niente viene tolto: l'import si aggiunge alla libreria attuale."}
          </Text>
          <View style={styles.dialogActions}>
            <Pressable onPress={() => setPending(null)} style={touch.target}>
              <Text style={styles.dialogCancel}>Annulla</Text>
            </Pressable>
            {/* Senza `haptic`: il feedback lo da' l'esito dell'import, non il tocco. */}
            <PressableScale
              style={[styles.cta, pending?.preview.empty && styles.ctaOff]}
              disabled={pending?.preview.empty}
              onPress={confirmImport}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Importa</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      <Modal
        visible={message !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMessage(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMessage(null)} />
        <View style={styles.dialog}>
          <Text style={styles.dialogBody} selectable>
            {message}
          </Text>
          {/* Senza `haptic`: chiude un dialogo, come "Annulla" e i backdrop. */}
          <PressableScale
            style={styles.cta}
            onPress={() => setMessage(null)}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Ho capito</Text>
          </PressableScale>
        </View>
      </Modal>
    </View>
  );
}

const EMPTY_PREVIEW: ImportPreview = {
  newFavorites: 0,
  newPlaylists: 0,
  grownPlaylists: 0,
  newTracks: 0,
  newHistory: 0,
  empty: true,
};

function Shelf({
  icon,
  label,
  detail,
  tint,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  tint?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.shelf,
        pressed && styles.shelfPressed,
        disabled && styles.shelfOff,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
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
  shelfOff: { opacity: 0.4 },
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
  dialogBody: { ...type.body, color: colors.text, lineHeight: 24 },
  dialogNote: { ...type.caption, color: colors.textMuted },
  dialogActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  dialogCancel: { ...type.body, color: colors.textMuted },
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
