/** MMKV in memoria per i test in Node: tutte le istanze condividono la stessa mappa. */

const memory = new Map<string, string>();

export class MMKV {
  getString(key: string): string | undefined {
    return memory.get(key);
  }

  set(key: string, value: string): void {
    memory.set(key, value);
  }

  delete(key: string): void {
    memory.delete(key);
  }

  getAllKeys(): string[] {
    return [...memory.keys()];
  }
}
