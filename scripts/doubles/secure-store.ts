/** expo-secure-store in memoria per i test in Node: niente Keystore, niente cifratura. */

const secrets = new Map<string, string>();

export function getItem(key: string): string | null {
  return secrets.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  secrets.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  secrets.delete(key);
}
