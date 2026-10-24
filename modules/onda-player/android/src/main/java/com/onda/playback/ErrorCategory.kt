package com.onda.playback

import androidx.media3.common.PlaybackException
import java.util.Locale

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

  /**
   * `Range` oltre la fine del file: la posizione chiesta non esiste sul
   * server. Media3 lo tratta come fine del brano solo se la posizione
   * coincide con la lunghezza del file; oltre, e' un errore. E' successo
   * dopo un seek avanzato su un lungo stream Audius (registro, 13 ottobre
   * 2026): il brano si salta come una sorgente illeggibile, ma il messaggio
   * porta posizione e durata dichiarata, cosi' sul device si capisce se il
   * file reale e' piu' corto della durata o se l'offset stimato l'ha
   * superata.
   */
  const val HTTP_RANGE_NOT_SATISFIABLE = 416

  /**
   * Il messaggio dell'evento: Media3 dice solo «Source error», quindi con una
   * risposta HTTP rifiutata si aggiunge lo stato e, per un 416, dove si era.
   */
  fun describe(
    message: String?,
    errorCodeName: String,
    httpStatus: Int?,
    positionSec: Double,
    durationSec: Double,
  ): String {
    val base = message ?: errorCodeName
    if (httpStatus == null) return base
    val where =
      if (httpStatus == HTTP_RANGE_NOT_SATISFIABLE) {
        String.format(Locale.ROOT, " a %.1f s di %.1f s dichiarati", positionSec, durationSec)
      } else {
        ""
      }
    return "$base (HTTP $httpStatus$where)"
  }
}
