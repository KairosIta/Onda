package com.onda.playback

/** Valutata sul main thread al momento del recupero, dopo i comandi gia' in coda. */
internal object SourceRecovery {
  fun skip(
    playRequested: Boolean,
    hasError: Boolean,
    hasNext: Boolean,
    recover: () -> Unit,
  ): Boolean {
    if (!playRequested || !hasError || !hasNext) return false
    recover()
    return true
  }
}
