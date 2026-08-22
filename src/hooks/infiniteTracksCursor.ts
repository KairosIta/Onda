export interface CursorPage {
  offset: number;
  trackCount: number;
  failedCount: number;
}

/** Mantiene l'offset su una pagina parziale; avanza solo dopo un successo completo. */
export function nextTracksOffset(page: CursorPage, pageSize: number): number | undefined {
  if (page.trackCount === 0 && page.failedCount === 0) return undefined;
  return page.failedCount > 0 ? page.offset : page.offset + pageSize;
}
