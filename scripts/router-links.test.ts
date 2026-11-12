/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { getPathFromState } from 'expo-router/build/react-navigation/core/getPathFromState.js';
import { getStateFromPath } from 'expo-router/build/react-navigation/core/getStateFromPath.js';

test('Expo Router legge e riscrive un link con Unicode, spazi e un segno più', () => {
  const screens = { search: 'search' };
  const state = getStateFromPath('/search?q=caff%C3%A8+%2B+mare', { screens });
  assert.ok(state);
  assert.deepEqual(state.routes[0].params, { q: 'caffè + mare' });
  assert.equal(getPathFromState(state, { screens }), '/search?q=caff%C3%A8%20%2B%20mare');
});
