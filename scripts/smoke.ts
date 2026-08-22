/**
 * Collaudo degli adapter contro le API vere, senza device.
 *
 *   npm run smoke
 *
 * Usa il codice dell'app, non una copia: gli adapter sono TypeScript puro,
 * senza React Native dentro, quindi girano in Node cosi' come sono. Questo
 * script ha gia' trovato tre bug che il typecheck non poteva vedere — le
 * API si collaudano solo interrogandole.
 */
import { GENRES, genreFor } from '@/services/genres';
import { SOURCES, searchAll } from '@/services/sources';
import type { Track } from '@/types/track';

let failures = 0;

const ok = (label: string, extra = '') =>
  console.log(`  PASS  ${label}${extra ? `  ${extra}` : ''}`);
const bad = (label: string, why: string) => {
  failures++;
  console.log(`  FAIL  ${label}  ${why}`);
};

/** Un Track e' valido se l'app puo' davvero riprodurlo e disegnarlo. */
function validate(label: string, tracks: Track[], min = 1): Track | null {
  if (tracks.length < min) {
    bad(label, `attese >=${min} tracce, ricevute ${tracks.length}`);
    return null;
  }
  const problems: string[] = [];
  for (const t of tracks) {
    if (!t.uid.includes(':')) problems.push(`uid malformato: ${t.uid}`);
    if (!t.streamUrl?.startsWith('http')) problems.push(`streamUrl assente su ${t.uid}`);
    if (!t.title) problems.push(`titolo vuoto su ${t.uid}`);
    if (!t.artist) problems.push(`artista vuoto su ${t.uid}`);
    if (!(t.durationSec > 0)) problems.push(`durata ${t.durationSec} su ${t.uid}`);
  }
  if (problems.length) {
    bad(label, problems.slice(0, 3).join('; '));
    return null;
  }
  ok(label, `${tracks.length} tracce`);
  return tracks[0];
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    bad(label, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Il player chiede i byte con un header Range: senza risposta 206 lo slider
 * non puo' saltare. Si campiona piu' di una traccia perche' qualche file
 * morto nel catalogo e' fisiologico — il salto automatico lo gestisce
 * playbackService.
 */
async function probeStreams(tracks: Track[]) {
  const sample = tracks.slice(0, 5);
  let alive = 0;
  let ranged = 0;

  for (const t of sample) {
    try {
      const res = await fetch(t.streamUrl, { headers: { Range: 'bytes=0-1023' } });
      if (res.ok) {
        alive++;
        if (res.status === 206) ranged++;
        await res.arrayBuffer();
      }
    } catch {
      /* conta come morto */
    }
  }

  const label = 'stream riproducibili';
  if (alive === 0) bad(label, `0 su ${sample.length}: sorgente irraggiungibile`);
  else if (ranged < alive)
    bad(label, `${alive}/${sample.length} vivi ma solo ${ranged} accettano Range`);
  else ok(label, `${alive}/${sample.length} vivi, tutti con Range`);
}

for (const { source } of Object.values(SOURCES)) {
  console.log(`\n=== ${source.label} (${source.id}) ===`);

  const trending = await step('trending', () => source.trending({ limit: 5 }));
  const first = trending ? validate('trending', trending) : null;

  const search = await step('search "love"', () => source.search({ query: 'love', limit: 5 }));
  if (search) validate('search "love"', search);

  // Se l'offset non funziona, lo scroll infinito ripete le stesse tracce.
  const p2 = await step('paginazione (offset 5)', () => source.trending({ limit: 5, offset: 5 }));
  if (p2 && trending) {
    const overlap = p2.filter((t) => trending.some((x) => x.uid === t.uid)).length;
    if (overlap === 0) ok('paginazione (offset 5)', 'nessuna ripetizione');
    else bad('paginazione (offset 5)', `${overlap}/${p2.length} tracce ripetute dalla pagina 1`);
  }

  if (first?.artistId) {
    const at = await step('artistTracks', () => source.artistTracks(first.artistId!, { limit: 5 }));
    if (at) validate('artistTracks', at);
    const info = await step('artistInfo', () => source.artistInfo(first.artistId!));
    if (info) ok('artistInfo', `"${info.name}" — ${info.detail ?? 'nessun dettaglio'}`);
  } else {
    bad('artistId sulle tracce', 'mancante: la voce "Vai a ..." non comparirebbe mai');
  }

  const withAlbum = trending?.find((t) => t.albumId);
  if (source.albumTracks && source.albumInfo) {
    if (withAlbum) {
      const al = await step('albumTracks', () =>
        source.albumTracks!(withAlbum.albumId!, { limit: 10 }),
      );
      if (al) validate('albumTracks', al);
      const ai = await step('albumInfo', () => source.albumInfo!(withAlbum.albumId!));
      if (ai) ok('albumInfo', `"${ai.name}" di ${ai.artist}`);
    } else {
      bad('albumId sulle tracce', 'nessuna traccia in trending ha un album');
    }
  } else {
    console.log('  ----  album: non supportato da questa sorgente (previsto)');
  }

  if (trending) await probeStreams(trending);
}

console.log('\n=== federazione ===');
const fed = await step('searchAll "jazz"', () => searchAll('jazz', { limit: 6 }));
if (fed) {
  fed.failed.forEach((f) => bad(`sorgente ${f.source}`, f.message));
  const seen = new Set(fed.tracks.map((t) => t.source));
  if (seen.size === 2)
    ok('searchAll "jazz"', `${fed.tracks.length} tracce da ${[...seen].join(' + ')}`);
  else bad('searchAll "jazz"', `solo ${[...seen].join(',') || 'nessuna sorgente'}`);

  // Se le prime righe vengono tutte dalla stessa sorgente, interleave non
  // sta facendo il suo lavoro e Jamendo sparisce sotto la piega.
  const firstTwo = new Set(fed.tracks.slice(0, 2).map((t) => t.source));
  if (firstTwo.size === 2) ok('alternanza', 'le prime due righe sono di sorgenti diverse');
  else bad('alternanza', 'le prime due righe vengono dalla stessa sorgente');
}

console.log('\n=== generi ===');
for (const g of GENRES) {
  const per = await Promise.all(
    Object.values(SOURCES).map(async ({ source }) => {
      try {
        const t = await source.trending({ limit: 3, genre: genreFor(g.key, source.id) });
        return `${source.id}:${t.length}`;
      } catch {
        return `${source.id}:ERR`;
      }
    }),
  );
  const empty = per.filter((p) => p.endsWith(':0') || p.endsWith(':ERR'));
  const line = `${g.label.padEnd(14)} ${per.join('  ')}`;
  if (empty.length === per.length) {
    failures++;
    console.log(`  FAIL  ${line}  (vuoto ovunque)`);
  } else {
    console.log(`  ${empty.length ? 'warn' : 'PASS'}  ${line}`);
  }
}

console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} PROBLEMI`);
process.exit(failures === 0 ? 0 : 1);
