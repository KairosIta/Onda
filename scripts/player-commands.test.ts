/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { togglePlayback } from '@/services/playerCommands';
import { derivePlaybackStatus, describePlayButton } from '@/services/playbackStatus';
import { backend, fakePlayer } from './doubles/player';

test('durante il buffering si puo mettere in pausa e poi riprendere prima che arrivi audio', () => {
  fakePlayer.emit({ type: 'playbackStateChanged', state: 'buffering' });
  fakePlayer.emit({ type: 'isPlayingChanged', playing: false });
  fakePlayer.emit({ type: 'playWhenReadyChanged', playWhenReady: true });
  fakePlayer.clearCalls();
  const status = () =>
    derivePlaybackStatus({
      state: backend.usePlaybackState(),
      playing: backend.useIsPlaying(),
      playWhenReady: backend.usePlayWhenReady(),
      hasItem: true,
      pending: false,
      fault: false,
    });

  assert.equal(status(), 'buffering');
  togglePlayback(status());
  assert.deepEqual(fakePlayer.calls(), ['pause']);

  // Media3 cambia playWhenReady, ma resta in BUFFERING e isPlaying e' ancora falso.
  const paused = status();
  assert.equal(paused, 'paused');
  assert.deepEqual(describePlayButton(paused), { icon: 'play', label: 'Riprendi', busy: false });
  togglePlayback(paused);
  assert.deepEqual(fakePlayer.calls(), ['pause', 'play']);
  assert.equal(status(), 'buffering');

  fakePlayer.emit({ type: 'playbackStateChanged', state: 'ready' });
  fakePlayer.emit({ type: 'isPlayingChanged', playing: true });
  assert.equal(status(), 'playing');
});
