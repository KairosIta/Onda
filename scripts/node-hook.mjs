/**
 * Fa risolvere a Node gli import scritti per Metro: l'alias '@/' e le
 * estensioni implicite. Serve solo agli script di collaudo, l'app non
 * passa mai di qui.
 */
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function firstExisting(base) {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(c) && !statSync(c).isDirectory()) return c;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    let target = null;

    if (specifier.startsWith('@/')) {
      target = path.join(ROOT, 'src', specifier.slice(2));
    } else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }

    if (target) {
      const hit = firstExisting(target);
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
