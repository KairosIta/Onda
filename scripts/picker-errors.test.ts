/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { isPickerCancelled } from '@/services/pickerErrors';

/** La forma dell'errore che expo-modules-core costruisce per il JS: `code` piu' il messaggio. */
class CodedError extends Error {
  code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

test("il selettore annullato si riconosce in ogni forma in cui Expo l'ha segnalato", () => {
  // Il codice nudo, come lo ricava Expo dal nome della classe Kotlin.
  assert.equal(isPickerCancelled(new CodedError('ERR_PICKER_CANCELLED', 'annullato')), true);
  // L'errore incartato visto su device il 18 ottobre 2026 (Android 16, expo-file-system 57.0.7).
  assert.equal(
    isPickerCancelled(
      new CodedError(
        'ERR_FUNCTION_CALL',
        "Call to function 'FileSystem.pickDirectoryAsync' has been rejected.\n→ Caused by: The file picker was cancelled by the user",
      ),
    ),
    true,
  );
  // Il codice giusto solo nella causa.
  assert.equal(
    isPickerCancelled(
      new Error('rifiutata', { cause: new CodedError('ERR_PICKER_CANCELLED', 'annullato') }),
    ),
    true,
  );
});

test('un guasto vero del selettore resta un errore da mostrare', () => {
  assert.equal(isPickerCancelled(new CodedError('ERR_FILESYSTEM', 'Permission denied')), false);
  assert.equal(isPickerCancelled(new Error('ENOSPC: no space left on device')), false);
  assert.equal(isPickerCancelled('stringa'), false);
  assert.equal(isPickerCancelled(null), false);
  // Una catena di cause circolare non manda in loop.
  const loop: { cause?: unknown; message: string } = { message: 'x' };
  loop.cause = loop;
  assert.equal(isPickerCancelled(loop), false);
});
