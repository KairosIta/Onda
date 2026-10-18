/** expo-secure-store in memoria per i test in Node: niente Keystore, niente cifratura. */

const secrets = new Map<string, string>();
let deleteHandler: (() => Promise<void>) | null = null;

export function getItem(key: string): string | null {
  return secrets.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  secrets.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (deleteHandler) await deleteHandler();
  secrets.delete(key);
}

/** Simula una cancellazione ancora in corso o rifiutata dal Keystore. */
export const fakeSecureStore = {
  setDeleteHandler(handler: (() => Promise<void>) | null): void {
    deleteHandler = handler;
  },
};
