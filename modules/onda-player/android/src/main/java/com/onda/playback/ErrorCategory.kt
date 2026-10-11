package com.onda.playback

import androidx.media3.common.PlaybackException

/**
 * La categoria di un errore di riproduzione, come la intende il contratto
 * (`PlaybackErrorCode` in `src/player/types.ts`): da li' l'app decide se
 * riprovare o saltare il brano.
 */
internal object ErrorCategory {
  const val NETWORK = "network"
  const val SOURCE = "source"
  const val RENDERER = "renderer"
  const val UNKNOWN = "unknown"

  /** `httpStatus` conta solo per una risposta HTTP rifiutata. */
  fun of(errorCode: Int, httpStatus: Int? = null): String =
    when (errorCode) {
      // Un server sovraccarico o un limite di richieste passano: si riprova.
      // Un 404 o un 403 restano tali, e il brano si salta.
      PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS ->
        if (httpStatus != null && isTransientHttp(httpStatus)) NETWORK else SOURCE
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
      PlaybackException.ERROR_CODE_TIMEOUT -> NETWORK
      // Il resto dell'IO e il parsing: lo stream non si legge.
      in 2000..3999 -> SOURCE
      // Decoder e uscita audio.
      in 4000..5999 -> RENDERER
      else -> UNKNOWN
    }

  private fun isTransientHttp(status: Int): Boolean = status >= 500 || status == 408 || status == 429
}
