@file:OptIn(UnstableApi::class)

package com.onda.playback

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionError
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Il servizio della riproduzione: notifica, schermata di blocco, cuffie e
 * Android Auto parlano con la sua sessione. Il player e' quello di
 * [PlaybackCore], che puo' essere nato prima del servizio (dall'app) o con
 * lui (da Android Auto a freddo).
 */
class PlaybackService : MediaLibraryService() {
  private var session: MediaLibrarySession? = null

  override fun onCreate() {
    super.onCreate()
    PlaybackCore.init(this)
    setMediaNotificationProvider(
      DefaultMediaNotificationProvider.Builder(this).build().apply {
        setSmallIcon(R.drawable.onda_playback_notification)
      }
    )
    setListener(
      object : Listener {
        override fun onForegroundServiceStartNotAllowedException() {
          // Android 12+ rifiuta un foreground service avviato dal background
          // (per esempio un play dopo dieci minuti di pausa): niente notifica.
          Log.w(TAG, "Foreground service non consentito")
        }
      }
    )
    val librarySession =
      MediaLibrarySession.Builder(this, PlaybackCore.ensurePlayer(), LibraryCallback())
        .setSessionActivity(openPlayer())
        .build()
    session = librarySession
    PlaybackCore.session = librarySession
    addSession(librarySession)
  }

  /**
   * La sessione si consegna a chiunque la chieda al binding: chi e' davvero
   * lo decide [LibraryCallback.onConnect], che vede il controller vero. Per
   * i browser legacy (Android Auto, Automotive, i comandi Bluetooth) Media3
   * chiama questo metodo con un segnaposto, package
   * `ControllerInfo.LEGACY_CONTROLLER_PACKAGE_NAME` e non fidato, e senza
   * sessione non restituisce nessun binder: respingerlo qui lasciava l'auto
   * fuori prima ancora che potesse presentarsi.
   */
  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? =
    session

  /** Tolta dai recenti, Onda si ferma (contratto). */
  override fun onTaskRemoved(rootIntent: Intent?) {
    PlaybackCore.onTaskRemoved()
    pauseAllPlayersAndStopSelf()
  }

  override fun onDestroy() {
    session?.release()
    session = null
    PlaybackCore.onServiceDestroyed()
    clearListener()
    super.onDestroy()
  }

  /** Il tocco sulla notifica: `app/+native-intent.ts` porta questo URL al player. */
  private fun openPlayer(): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("onda://notification.click")).setPackage(packageName)
    return PendingIntent.getActivity(
      this,
      0,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }

  /**
   * Chi si collega e comanda la riproduzione: Onda, la sua notifica,
   * Android Auto, Automotive e i controller che Media3 dichiara fidati.
   * `isTrusted` comprende il sistema (schermata di blocco, Bluetooth) ma
   * anche qualunque app con un servizio di ascolto delle notifiche attivo,
   * come un'app per smartwatch o un widget multimediale: comanda il
   * trasporto come fa la schermata di blocco, ma non sostituisce la coda ne'
   * legge la libreria (vedi [canBrowse]). Ogni altra app e' respinta.
   */
  private fun isOurs(session: MediaSession, controller: MediaSession.ControllerInfo): Boolean =
    controller.packageName == packageName ||
      controller.isTrusted ||
      session.isMediaNotificationController(controller) ||
      session.isAutoCompanionController(controller) ||
      session.isAutomotiveController(controller)

  /**
   * La libreria privata (preferiti, playlist, ascolti recenti) la sfogliano
   * soltanto Onda, Android Auto e Automotive, e soltanto loro possono mandare
   * una coda: a un controller soltanto fidato [onConnect] toglie i comandi
   * che impostano o cambiano gli elementi ([RemoteCommands.QUEUE_COMMANDS])
   * e [onSetMediaItems] e [onAddMediaItems] rifiutano comunque. Comanda la
   * riproduzione, non legge la libreria e non le manda una coda sua.
   */
  private fun canBrowse(session: MediaSession, controller: MediaSession.ControllerInfo): Boolean =
    controller.packageName == packageName ||
      session.isAutoCompanionController(controller) ||
      session.isAutomotiveController(controller)

  private inner class LibraryCallback : MediaLibrarySession.Callback {
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
    ): MediaSession.ConnectionResult {
      if (!isOurs(session, controller)) return MediaSession.ConnectionResult.reject()
      val result = MediaSession.ConnectionResult.AcceptedResultBuilder(session, controller)
      val commands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
      RemoteCommands.withheld(PlaybackCore.remoteCommands(), canBrowse(session, controller))
        .forEach { commands.remove(it) }
      result.setAvailablePlayerCommands(commands.build())
      return result.build()
    }

    override fun onGetLibraryRoot(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<MediaItem>> {
      return respond(access(session, browser).root()) { root ->
        LibraryResult.ofItem(ItemCodec.browseItem(BrowseTree.ROOT_ID, root), params)
      }
    }

    override fun onGetChildren(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
      return respond(access(session, browser).children(parentId, page, pageSize)) { children ->
        LibraryResult.ofItemList(children.map { (id, node) -> ItemCodec.browseItem(id, node) }, params)
      }
    }

    override fun onGetItem(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      mediaId: String,
    ): ListenableFuture<LibraryResult<MediaItem>> {
      return respond(access(session, browser).item(mediaId)) { node ->
        LibraryResult.ofItem(ItemCodec.browseItem(mediaId, node), null)
      }
    }

    private fun access(session: MediaSession, browser: MediaSession.ControllerInfo) =
      LibraryAccess(canBrowse(session, browser), PlaybackCore::browseTree)

    private fun <T, R : Any> respond(
      result: BrowseResult<T>,
      found: (T) -> LibraryResult<R>,
    ): ListenableFuture<LibraryResult<R>> {
      val response: LibraryResult<R> = when (result) {
        BrowseResult.Denied -> LibraryResult.ofError(SessionError.ERROR_PERMISSION_DENIED)
        BrowseResult.Missing -> LibraryResult.ofError(SessionError.ERROR_BAD_VALUE)
        is BrowseResult.Found -> found(result.value)
      }
      return Futures.immediateFuture(response)
    }

    /**
     * Un brano scelto in macchina arriva senza URL: in coda vanno i brani
     * della sua cartella, a partire da lui (contratto, `setBrowseTree`). La
     * decisione e' di [QueueRequest]; qui si traduce nei tipi Media3.
     */
    override fun onSetMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
      startIndex: Int,
      startPositionMs: Long,
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      if (!canBrowse(mediaSession, controller)) return refused()
      val request = mediaItems.map { QueueRequest.Item(it.mediaId, it.localConfiguration != null) }
      return when (val outcome = QueueRequest.plan(PlaybackCore.browseTree(), request, startIndex)) {
        QueueRequest.Unresolved -> unresolved()
        is QueueRequest.Resolved ->
          Futures.immediateFuture(
            MediaSession.MediaItemsWithStartPosition(
              outcome.entries.map { entry ->
                when (entry) {
                  is QueueRequest.Entry.Given -> mediaItems[entry.index]
                  is QueueRequest.Entry.FromTree -> ItemCodec.fromBrowse(entry.node)
                }
              },
              outcome.startIndex,
              if (outcome.fromTree) C.TIME_UNSET else startPositionMs,
            )
          )
      }
    }

    override fun onAddMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
    ): ListenableFuture<MutableList<MediaItem>> {
      if (!canBrowse(mediaSession, controller)) return refused()
      val tree = PlaybackCore.browseTree()
      val resolved =
        mediaItems.mapNotNull { item ->
          if (item.localConfiguration != null) item
          else QueueRequest.lookup(tree, item.mediaId)?.let(ItemCodec::fromBrowse)
        }
      return Futures.immediateFuture(resolved.toMutableList())
    }

    /**
     * Seconda barriera dietro ai comandi tolti in [onConnect]: una richiesta
     * di coda da chi non sfoglia la libreria fallisce, Media3 risponde con un
     * errore al controller e il player non cambia.
     */
    private fun <T> refused(): ListenableFuture<T> =
      Futures.immediateFailedFuture(SecurityException("Il controller non puo' cambiare la coda"))

    /**
     * Nessun brano riconosciuto nella richiesta: fallisce come sopra e la coda
     * in ascolto resta. Una lista vuota, invece, Media3 l'avrebbe data al
     * player, che l'avrebbe applicata cancellando la coda.
     */
    private fun <T> unresolved(): ListenableFuture<T> =
      Futures.immediateFailedFuture(
        IllegalArgumentException("Nessun brano riconosciuto nella richiesta di coda")
      )
  }

  private companion object {
    const val TAG = "OndaPlayback"
  }
}
