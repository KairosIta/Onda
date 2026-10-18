/// <reference types="node" />

import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { getStoredCredentials, subscribeCredentials } from '@/services/credentials';
import type { Credentials } from '@/services/sourceSettings';
import { getSources, setCredential } from '@/store/sources';
import { fakeSecureStore, getItem } from './doubles/secure-store';

// Valori finti: questi test usano soltanto il Keystore in memoria.
const initial: Credentials = {
  jamendoClientId: 'client-id-di-prova',
  audiusApiKey: 'api-key-di-prova',
};
const keys: Record<keyof Credentials, string> = {
  jamendoClientId: 'onda.jamendo.client-id',
  audiusApiKey: 'onda.audius.api-key',
};

beforeEach(async () => {
  fakeSecureStore.setDeleteHandler(null);
  await setCredential('jamendoClientId', initial.jamendoClientId);
  await setCredential('audiusApiKey', initial.audiusApiKey);
});

afterEach(() => fakeSecureStore.setDeleteHandler(null));

for (const name of Object.keys(initial) as (keyof Credentials)[]) {
  test(`${name}: la rimozione si conferma solo dopo la cancellazione dal Keystore`, async (t) => {
    const credentials = getStoredCredentials();
    const sources = getSources();
    let notifications = 0;
    t.after(subscribeCredentials(() => notifications++));

    let release: () => void = () => {};
    const deleting = new Promise<void>((resolve) => {
      release = resolve;
    });
    fakeSecureStore.setDeleteHandler(() => deleting);

    const removal = setCredential(name, '');
    try {
      assert.strictEqual(getStoredCredentials(), credentials, 'nessuna rimozione anticipata');
      assert.strictEqual(getSources(), sources, 'le sorgenti restano nello stato precedente');
      assert.equal(getItem(keys[name]), initial[name]);
      assert.equal(notifications, 0);
    } finally {
      release();
      await removal;
    }

    assert.equal(getItem(keys[name]), null, 'il valore non può ricomparire al riavvio');
    assert.deepEqual(getStoredCredentials(), { ...initial, [name]: '' });
    assert.equal(notifications, 1, 'un solo aggiornamento dopo il completamento');
    assert.equal(getSources().active.jamendo, name !== 'jamendoClientId');
    assert.equal(getSources().active.audius, true, 'Audius funziona anche senza API key');
  });

  test(`${name}: una cancellazione fallita conserva lo stato e si può ritentare`, async (t) => {
    const credentials = getStoredCredentials();
    const sources = getSources();
    let notifications = 0;
    t.after(subscribeCredentials(() => notifications++));
    fakeSecureStore.setDeleteHandler(async () => {
      throw new Error('Keystore di prova non disponibile');
    });

    await assert.rejects(async () => {
      await setCredential(name, '');
    }, /Keystore di prova non disponibile/);
    assert.strictEqual(getStoredCredentials(), credentials);
    assert.strictEqual(getSources(), sources);
    assert.equal(getItem(keys[name]), initial[name]);
    assert.equal(notifications, 0, 'un fallimento non viene annunciato come rimozione');

    fakeSecureStore.setDeleteHandler(null);
    await setCredential(name, '');
    assert.equal(getItem(keys[name]), null);
    assert.deepEqual(getStoredCredentials(), { ...initial, [name]: '' });
    assert.equal(notifications, 1);
  });
}
