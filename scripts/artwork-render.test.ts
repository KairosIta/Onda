/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import test from 'node:test';
import { createElement, type ReactNode } from 'react';
import ts from 'typescript';
import { renderedImages } from './doubles/artwork-ui.ts';

const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: ReactNode) => string;
};

const artwork = new URL('../src/components/Artwork.tsx', import.meta.url).href;
const ui = new URL('./doubles/artwork-ui.ts', import.meta.url).href;

// Si esegue il componente vero. Solo View, Image e icona sono sostituiti;
// Node non legge TSX, quindi qui TypeScript toglie tipi e trasforma il JSX.
registerHooks({
  resolve(specifier, context, next) {
    if (['react-native', 'expo-image', '@expo/vector-icons/Ionicons'].includes(specifier)) {
      return { url: ui, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === artwork) {
      return {
        format: 'module',
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const { Artwork } = await import('../src/components/Artwork');

test('il componente passa a expo-image la policy e una chiave distinta per ciascuna sorgente', () => {
  const uri = 'https://example.test/artwork.jpg';
  renderedImages.length = 0;
  for (const source of ['jamendo', 'audius', undefined] as const) {
    renderToStaticMarkup(createElement(Artwork, { uri, source }));
  }
  assert.deepEqual(
    renderedImages.map((props) => props.cachePolicy),
    ['memory-disk', 'memory', 'memory'],
  );
  const keys = renderedImages.map((props) => (props.source as { cacheKey: string }).cacheKey);
  assert.equal(new Set(keys).size, 3, 'lo stesso URL non condivide cache tra sorgenti');
});
