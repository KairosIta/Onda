/// <reference types="node" />

import { delimiter, posix, win32 } from 'node:path';

export const MINIMUM_NODE_VERSION = [22, 15, 0] as const;

export interface VersionCheck {
  actual: string;
  supported: boolean;
}

/** Cosa passare a `spawnSync`: comando, argomenti e se serve la shell. */
export interface CommandSpec {
  command: string;
  args: string[];
  shell: boolean;
}

export function parseVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/u, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function isVersionAtLeast(actual: string, minimum: readonly number[]): boolean {
  const parsed = parseVersion(actual);
  for (let index = 0; index < minimum.length; index += 1) {
    const difference = (parsed[index] ?? 0) - minimum[index];
    if (difference !== 0) return difference > 0;
  }
  return true;
}

export function checkNodeVersion(actual = process.versions.node): VersionCheck {
  return {
    actual,
    supported: isVersionAtLeast(actual, MINIMUM_NODE_VERSION),
  };
}

export function parseJavaMajor(output: string): number | undefined {
  const match = /version\s+"(\d+)(?:[.](\d+))?/iu.exec(output);
  if (!match) return undefined;
  const major = Number.parseInt(match[1], 10);
  return major === 1 && match[2] ? Number.parseInt(match[2], 10) : major;
}

/**
 * Un argomento sulla riga di comando di cmd.exe: fra virgolette se ha spazi
 * o caratteri che cmd interpreta (`& | < > ^ ( ) % !`). Dentro le virgolette
 * cmd li lascia passare; le virgolette stesse e gli a capo non hanno una
 * forma affidabile, e un argomento che li contiene si rifiuta.
 */
export function quoteForCmd(arg: string): string {
  if (/["\r\n]/u.test(arg)) {
    throw new Error(`Argomento non rappresentabile per cmd.exe: ${JSON.stringify(arg)}`);
  }
  if (arg === '') return '""';
  return /[\s&|<>^()%!]/u.test(arg) ? `"${arg}"` : arg;
}

/**
 * Come lanciare un comando. Su Windows `.cmd` e `.bat` passano da cmd.exe,
 * e con `shell: true` Node incolla gli argomenti con uno spazio e senza
 * virgolette: un percorso come `C:\Users\Mario Rossi\Onda` diventa due
 * argomenti e cmd cerca `C:\Users\Mario`. Qui la riga si compone con ogni
 * pezzo fra virgolette quando serve e si passa intera, senza argomenti: e'
 * anche la forma che Node 24 chiede (DEP0190). Altrove niente shell.
 */
export function commandSpec(
  command: string,
  args: readonly string[],
  platform = process.platform,
): CommandSpec {
  if (platform === 'win32' && /[.](?:cmd|bat)$/iu.test(command)) {
    return { command: [command, ...args].map(quoteForCmd).join(' '), args: [], shell: true };
  }
  return { command, args: [...args], shell: false };
}

export function npmExecutable(platform = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function npxExecutable(platform = process.platform): string {
  return platform === 'win32' ? 'npx.cmd' : 'npx';
}

export function gradleWrapper(root: string, platform = process.platform): string {
  const path = platform === 'win32' ? win32 : posix;
  return path.join(root, 'android', platform === 'win32' ? 'gradlew.bat' : 'gradlew');
}

export function androidExecutable(name: string, platform = process.platform): string {
  return platform === 'win32' ? `${name}.exe` : name;
}

export function apksignerExecutable(platform = process.platform): string {
  return platform === 'win32' ? 'apksigner.bat' : 'apksigner';
}

export function androidSdkCandidates(
  env: NodeJS.ProcessEnv,
  platform = process.platform,
): string[] {
  const explicit = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].filter((value): value is string =>
    Boolean(value?.trim()),
  );
  const path = platform === 'win32' ? win32 : posix;
  const defaults =
    platform === 'win32'
      ? [env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Android', 'Sdk') : undefined]
      : platform === 'darwin'
        ? [env.HOME ? path.join(env.HOME, 'Library', 'Android', 'sdk') : undefined]
        : [env.HOME ? path.join(env.HOME, 'Android', 'Sdk') : undefined];

  return [
    ...new Set([...explicit, ...defaults].filter((value): value is string => Boolean(value))),
  ];
}

export function pathContains(directory: string, pathValue = process.env.PATH ?? ''): boolean {
  const normalized = directory.toLocaleLowerCase();
  return pathValue
    .split(delimiter)
    .some((entry) => entry.replace(/[\\/]+$/u, '').toLocaleLowerCase() === normalized);
}
