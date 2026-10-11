package com.onda.playback

/**
 * Il timer di spegnimento, senza Handler: chi lo usa pianifica lo scatto,
 * qui si decide se lo scatto vale. I secondi sono di orologio
 * (`elapsedRealtime`) e passano anche a riproduzione ferma e in sonno
 * profondo.
 *
 * Un Handler conta invece il tempo da sveglio: a player fermo il telefono
 * puo' dormire e lo scatto arrivare tardi. Una pausa in ritardo a player
 * fermo non fa niente; il caso da evitare e' una ripresa successiva fermata
 * da un timer gia' scaduto, e per quello c'e' [onPlaybackResumed].
 */
internal class SleepTimer(private val clock: () -> Long) {
  private var deadline: Long? = null

  val isArmed: Boolean
    get() = deadline != null

  /** Arma il timer, sostituendo quello di prima; ritorna fra quanti ms scatta. */
  fun start(seconds: Double): Long {
    val delay = (seconds * 1000).toLong().coerceAtLeast(0)
    deadline = clock() + delay
    return delay
  }

  fun cancel() {
    deadline = null
  }

  /** Lo scatto pianificato: `true` se va messa la pausa. */
  fun onFire(): Boolean {
    val due = deadline ?: return false
    if (clock() < due) return false
    deadline = null
    return true
  }

  /** La musica riparte: un timer scaduto mentre era ferma si chiude senza pausa. */
  fun onPlaybackResumed() {
    val due = deadline ?: return
    if (clock() >= due) deadline = null
  }

  /** Quanto manca, per ripianificare uno scatto arrivato in anticipo. */
  fun remainingMs(): Long? = deadline?.let { (it - clock()).coerceAtLeast(0) }
}
