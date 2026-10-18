@file:OptIn(UnstableApi::class)

package com.onda.playback

import android.content.ComponentName
import android.content.Context
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.annotation.OptIn
import androidx.core.os.HandlerCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.util.Util
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaController
import androidx.media3.session.MediaLibraryService.MediaLibrarySession
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import java.io.File
import java.util.concurrent.Executor
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * Il player di Onda, uno per processo, sul main thread: la strada che Media3
 * documenta per notifica, servizio e controller come Android Auto.
 *
 * Il player nasce solo quando serve: al primo comando di coda o di play
 * dall'app, o quando Android Auto avvia il servizio a freddo. Fino ad allora
 * non c'e' sessione, servizio ne' notifica, e all'avvio la coda ripristinata
 * resta in attesa senza aprire lo stream (`store/session`).
 *
 * Il JS chiama da un altro thread: [post] accoda i comandi in ordine e
 * torna subito, [read] passa dalla stessa coda e aspetta. Cosi' una lettura
 * vede tutti i comandi dati prima, perche' ExoPlayer aggiorna lo stato
 * visibile appena riceve un comando.
 */
internal object PlaybackCore {
  private const val TAG = "OndaPlayback"
  private const val READ_TIMEOUT_MS = 2_000L
  private const val TREE_FILE = "onda-browse-tree.json"

  private val handler = HandlerCompat.createAsync(Looper.getMainLooper())
  private val mainExecutor = Executor { handler.post(it) }
  private lateinit var context: Context
  private lateinit var prefs: PlaybackPrefs

  /** Chi riceve gli eventi: il modulo Expo, finche' c'e' un JS. */
  @Volatile var events: ((Map<String, Any?>) -> Unit)? = null

  /** La sessione del servizio, finche' il servizio e' vivo. */
  var session: MediaLibrarySession? = null

  /**
   * Audio in uscita e stato del player, come li ha annunciati l'ultimo
   * evento: si leggono da qualunque thread senza aspettare il main, perche'
   * non dipendono dai comandi appena dati (un play diventa audio quando lo
   * decide la rete). Servono alle schermate e al JS appena caricato.
   */
  @Volatile
  var playingNow = false
    private set

  @Volatile
  var stateNow = "idle"
    private set

  private var player: ExoPlayer? = null
  private var controller: ListenableFuture<MediaController>? = null
  private var tree: BrowseTree? = null
  private var progressIntervalMs = 5_000L
  private val sleepTimer = SleepTimer(SystemClock::elapsedRealtime)
  private var pendingRetry: Runnable? = null

  /**
   * L'app e' stata tolta dai recenti: la musica si e' fermata e non deve
   * ripartire da sola (per esempio da un tentativo dopo un errore) finche'
   * l'utente non torna in Onda.
   */
  private var stoppedByUser = false

  @Synchronized
  fun init(context: Context) {
    if (::context.isInitialized) return
    this.context = context.applicationContext
    prefs = PlaybackPrefs(this.context)
    progressIntervalMs = prefs.progressIntervalMs
  }

  // --- thread -----------------------------------------------------------

  fun post(command: PlaybackCore.() -> Unit) {
    handler.post {
      try {
        command()
      } catch (e: RuntimeException) {
        Log.e(TAG, "Comando del player non eseguito", e)
      }
    }
  }

  /**
   * Una lettura dal JS. Il main thread di solito risponde in meno di un
   * millisecondo; se non risponde in due secondi e' un guasto da
   * correggere, e intanto si ripiega su un valore neutro, mai su uno vecchio.
   */
  fun <T> read(fallback: T, query: PlaybackCore.() -> T): T {
    if (Looper.myLooper() == Looper.getMainLooper()) return query()
    val task = FutureTask { query() }
    handler.post(task)
    return try {
      task.get(READ_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    } catch (e: Exception) {
      task.cancel(false)
      Log.e(TAG, "Lettura del player non riuscita", e)
      fallback
    }
  }

  // --- player e servizio ------------------------------------------------

  fun ensurePlayer(): ExoPlayer = player ?: createPlayer().also { player = it }

  private fun createPlayer(): ExoPlayer {
    val http =
      DefaultHttpDataSource.Factory()
        .setUserAgent(Util.getUserAgent(context, "Onda"))
        .setAllowCrossProtocolRedirects(true)
    val audio =
      AudioAttributes.Builder()
        .setUsage(C.USAGE_MEDIA)
        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
        .build()
    return ExoPlayer.Builder(context)
      .setAudioAttributes(audio, /* handleAudioFocus= */ true)
      .setHandleAudioBecomingNoisy(true)
      // Gli stream passano dalla rete: CPU e Wi-Fi svegli a schermo spento.
      .setWakeMode(C.WAKE_MODE_NETWORK)
      .setMediaSourceFactory(DefaultMediaSourceFactory(DefaultDataSource.Factory(context, http)))
      .build()
      .apply {
        repeatMode = prefs.repeatMode
        shuffleModeEnabled = prefs.shuffle
        addListener(listener)
      }
  }

  /**
   * Avvia il servizio e ci resta legato: cosi' la sessione esiste quando la
   * musica parte, e Media3 ne fa un foreground service con la notifica. I
   * comandi vanno comunque direttamente al player.
   */
  private fun bindService() {
    if (controller != null) return
    val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
    val future =
      MediaController.Builder(context, token)
        .setListener(
          object : MediaController.Listener {
            override fun onDisconnected(controller: MediaController) {
              this@PlaybackCore.controller = null
            }
          }
        )
        .buildAsync()
    controller = future
    future.addListener(
      { if (controller === future && runCatching { future.get() }.isFailure) controller = null },
      mainExecutor,
    )
  }

  private fun releaseController() {
    controller?.let(MediaController::releaseFuture)
    controller = null
  }

  fun remoteCommands(): List<String> = prefs.remoteCommands

  /** Lo swipe dai recenti, prima che il servizio si fermi. */
  fun onTaskRemoved() {
    stoppedByUser = true
    cancelRetry()
    releaseController()
  }

  /**
   * Il servizio e' finito, il processo e il JS forse no: coda e posizione
   * restano, cosi' riaprendo l'app il mini-player le mostra in pausa.
   */
  fun onServiceDestroyed() {
    session = null
    player?.stop()
  }

  fun onAppForeground() {
    stoppedByUser = false
  }

  // --- comandi ------------------------------------------------------------

  fun setup(progressIntervalSeconds: Double, commands: List<String>) {
    progressIntervalMs = (progressIntervalSeconds * 1000).toLong().coerceAtLeast(1_000)
    prefs.progressIntervalMs = progressIntervalMs
    // Valgono alla prossima connessione di un controller: i tasti non
    // cambiano mentre l'app gira.
    prefs.remoteCommands = commands
  }

  /**
   * Prepara il player se e' fermo in `idle`, anche dopo un errore: l'errore
   * resta attaccato al player finche' non lo si riprepara, pure se nel
   * frattempo la coda e' cambiata.
   */
  fun play() {
    if (stoppedByUser) return
    val p = player ?: return
    bindService()
    if (p.playbackState == Player.STATE_IDLE && p.mediaItemCount > 0) p.prepare()
    p.play()
  }

  fun pause() {
    cancelRetry()
    player?.pause()
  }

  fun seekTo(seconds: Double) {
    player?.seekTo((seconds * 1000).toLong())
  }

  fun skipToNext() {
    player?.seekToNextMediaItem()
  }

  /** Un solo comando: nessun play JS puo' scavalcare una pausa arrivata nel frattempo. */
  fun skipToNextAfterError(): Boolean {
    val p = player ?: return false
    return SourceRecovery.skip(
      playRequested = p.playWhenReady && !stoppedByUser,
      hasError = p.playerError != null,
      hasNext = p.hasNextMediaItem(),
    ) {
      p.seekToNextMediaItem()
      retry()
      play()
    }
  }

  /** Oltre i primi 3 secondi riavvolge (`maxSeekToPreviousPosition` di Media3). */
  fun skipToPrevious() {
    player?.seekToPrevious()
  }

  fun skipToIndex(index: Int) {
    val p = player ?: return
    if (index in 0 until p.mediaItemCount) p.seekToDefaultPosition(index)
  }

  /** Dopo un errore il player e' fermo in `idle`: lo si riprepara, senza ripartire. */
  fun retry() {
    val p = player ?: return
    if (p.playerError == null) return
    p.playWhenReady = false
    p.prepare()
  }

  fun scheduleRetry(seconds: Double) {
    cancelRetry()
    // Un errore puo' arrivare dopo la pausa, mentre finisce un caricamento.
    if (player?.playWhenReady != true) return
    val attempt = Runnable {
      pendingRetry = null
      if (player?.playWhenReady != true) return@Runnable
      retry()
      play()
    }
    pendingRetry = attempt
    handler.postDelayed(attempt, (seconds * 1000).toLong().coerceAtLeast(0))
  }

  fun cancelRetry() {
    pendingRetry?.let { handler.removeCallbacks(it) }
    pendingRetry = null
  }

  /**
   * Non prepara: lo fa `play()`. L'app carica la coda ripristinata anche
   * senza suonare (per inserirci un brano o aprire la Coda), e allora non
   * deve aprire servizio e notifica ne' scaricare niente.
   */
  fun setMediaItems(items: List<MediaItem>, startIndex: Int) {
    ensurePlayer().setMediaItems(items, startIndex.coerceIn(0, maxOf(items.size - 1, 0)), 0)
  }

  fun insertMediaItems(index: Int, items: List<MediaItem>) {
    val p = ensurePlayer()
    p.addMediaItems(index.coerceIn(0, p.mediaItemCount), items)
  }

  fun addMediaItem(item: MediaItem) {
    ensurePlayer().addMediaItem(item)
  }

  fun removeMediaItems(from: Int, to: Int) {
    val p = player ?: return
    if (from < 0 || to <= from) return
    p.removeMediaItems(from, minOf(to, p.mediaItemCount))
  }

  fun moveMediaItem(from: Int, to: Int) {
    val p = player ?: return
    val range = 0 until p.mediaItemCount
    if (from in range && to in range) p.moveMediaItem(from, to)
  }

  fun setRepeatMode(mode: Int) {
    prefs.repeatMode = mode
    player?.repeatMode = mode
  }

  fun setShuffleModeEnabled(enabled: Boolean) {
    prefs.shuffle = enabled
    player?.shuffleModeEnabled = enabled
  }

  fun sleepAfter(seconds: Double) {
    handler.removeCallbacks(sleepTick)
    handler.postDelayed(sleepTick, sleepTimer.start(seconds))
  }

  fun cancelSleep() {
    sleepTimer.cancel()
    handler.removeCallbacks(sleepTick)
  }

  // --- letture ------------------------------------------------------------

  fun queue(): List<Map<String, Any?>> {
    val p = player ?: return emptyList()
    return (0 until p.mediaItemCount).map { ItemCodec.toJs(p.getMediaItemAt(it)) }
  }

  fun activeIndex(): Int? = player?.takeIf { it.mediaItemCount > 0 }?.currentMediaItemIndex

  fun activeItem(): Map<String, Any?>? = player?.currentMediaItem?.let(ItemCodec::toJs)

  fun progress(): Map<String, Double> {
    val p = player ?: return mapOf("position" to 0.0, "duration" to 0.0, "buffered" to 0.0)
    return mapOf(
      "position" to p.currentPosition / 1000.0,
      "duration" to durationSec(p),
      "buffered" to p.bufferedPosition / 1000.0,
    )
  }

  // --- Android Auto -------------------------------------------------------

  fun browseTree(): BrowseTree = tree ?: loadTree().also { tree = it }

  /**
   * Salva l'albero per il servizio a freddo e lo ritorna gia' letto. Gira sul
   * thread del JS: il file e' piccolo, e un JSON sbagliato fallisce qui,
   * davanti a chi lo ha mandato.
   */
  fun storeBrowseTree(json: String): BrowseTree {
    val parsed = BrowseTree.parse(json)
    val file = File(context.filesDir, TREE_FILE)
    val partial = File(context.filesDir, "$TREE_FILE.tmp")
    partial.writeText(json)
    if (!partial.renameTo(file)) Log.w(TAG, "Albero di Android Auto non salvato")
    return parsed
  }

  fun applyBrowseTree(parsed: BrowseTree) {
    tree = parsed
    val s = session ?: return
    s.notifyChildrenChanged(BrowseTree.ROOT_ID, parsed.categories.size, null)
    parsed.folderIds().forEach { id ->
      s.notifyChildrenChanged(id, parsed.children(id)?.size ?: 0, null)
    }
  }

  private fun loadTree(): BrowseTree {
    val file = File(context.filesDir, TREE_FILE)
    if (!file.exists()) return BrowseTree.EMPTY
    return try {
      BrowseTree.parse(file.readText())
    } catch (e: Exception) {
      Log.w(TAG, "Albero di Android Auto illeggibile", e)
      BrowseTree.EMPTY
    }
  }

  // --- eventi -------------------------------------------------------------

  private fun emit(type: String, vararg payload: Pair<String, Any?>) {
    events?.invoke(mapOf("type" to type, *payload))
  }

  private fun emitProgress() {
    val p = player ?: return
    val item = p.currentMediaItem ?: return
    emit(
      "progressUpdated",
      "mediaId" to item.mediaId,
      "position" to p.currentPosition / 1000.0,
      "duration" to durationSec(p),
    )
  }

  private val progressTick =
    object : Runnable {
      override fun run() {
        emitProgress()
        handler.postDelayed(this, progressIntervalMs)
      }
    }

  private val sleepTick =
    object : Runnable {
      override fun run() {
        // Uno scatto in anticipo sull'orologio si ripianifica per il resto.
        if (sleepTimer.onFire()) pause()
        else sleepTimer.remainingMs()?.let { handler.postDelayed(this, it) }
      }
    }

  private val listener =
    object : Player.Listener {
      override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
        // Notifica e controller chiamano ExoPlayer direttamente, anche quando
        // non suona gia' piu': onIsPlayingChanged non annuncerebbe la pausa.
        if (!playWhenReady) cancelRetry()
      }

      override fun onIsPlayingChanged(isPlaying: Boolean) {
        playingNow = isPlaying
        emit("isPlayingChanged", "playing" to isPlaying)
        handler.removeCallbacks(progressTick)
        if (isPlaying) {
          sleepTimer.onPlaybackResumed()
          if (!sleepTimer.isArmed) handler.removeCallbacks(sleepTick)
          handler.postDelayed(progressTick, progressIntervalMs)
        } else {
          // Un ultimo colpo alla pausa: e' la posizione da cui riprendere.
          emitProgress()
        }
      }

      override fun onPlaybackStateChanged(playbackState: Int) {
        stateNow = stateName(playbackState)
        emit("playbackStateChanged", "state" to stateNow)
      }

      override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
        cancelRetry()
        emit("mediaItemTransition", "item" to mediaItem?.let(ItemCodec::toJs))
      }

      override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {
        emit("mediaMetadataChanged")
      }

      override fun onTimelineChanged(timeline: Timeline, reason: Int) {
        if (reason == Player.TIMELINE_CHANGE_REASON_PLAYLIST_CHANGED) emit("queueChanged")
      }

      override fun onPlayerError(error: PlaybackException) {
        val status = (error.cause as? HttpDataSource.InvalidResponseCodeException)?.responseCode
        emit(
          "playbackError",
          "code" to ErrorCategory.of(error.errorCode, status),
          "message" to (error.message ?: error.errorCodeName),
        )
      }
    }

  private fun durationSec(p: Player): Double =
    p.duration.let { if (it == C.TIME_UNSET || it < 0) 0.0 else it / 1000.0 }

  private fun stateName(state: Int): String =
    when (state) {
      Player.STATE_BUFFERING -> "buffering"
      Player.STATE_READY -> "ready"
      Player.STATE_ENDED -> "ended"
      // Anche dopo un errore: il contratto lo dice, ed e' cio' che fa Media3.
      else -> "idle"
    }
}
