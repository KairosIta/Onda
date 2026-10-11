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
   * I tasti di Onda vanno a notifica, Android Auto, Onda stessa e ai
   * controller di sistema fidati. Gli altri, compresa qualunque app
   * installata, leggono soltanto (Media3 1.11 li tratta cosi' di suo).
   */
  private fun isOurs(session: MediaSession, controller: MediaSession.ControllerInfo): Boolean =
    controller.packageName == packageName ||
      controller.isTrusted ||
      session.isMediaNotificationController(controller) ||
      session.isAutoCompanionController(controller) ||
      session.isAutomotiveController(controller)

  private inner class LibraryCallback : MediaLibrarySession.Callback {
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
    ): MediaSession.ConnectionResult {
      val result = MediaSession.ConnectionResult.AcceptedResultBuilder(session, controller)
      if (isOurs(session, controller)) {
        val commands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
        RemoteCommands.withheld(PlaybackCore.remoteCommands()).forEach { commands.remove(it) }
        result.setAvailablePlayerCommands(commands.build())
      }
      return result.build()
    }

    override fun onGetLibraryRoot(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<MediaItem>> {
      if (!isOurs(session, browser)) {
        return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_PERMISSION_DENIED))
      }
      val root = PlaybackCore.browseTree().item(BrowseTree.ROOT_ID)!!
      return Futures.immediateFuture(
        LibraryResult.ofItem(ItemCodec.browseItem(BrowseTree.ROOT_ID, root), params)
      )
    }

    override fun onGetChildren(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
      val children =
        PlaybackCore.browseTree().children(parentId)
          ?: return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE))
      val from = (page.toLong() * pageSize).coerceAtMost(children.size.toLong()).toInt()
      val to = (from.toLong() + pageSize).coerceAtMost(children.size.toLong()).toInt()
      val items = children.subList(from, to).map { (id, node) -> ItemCodec.browseItem(id, node) }
      return Futures.immediateFuture(LibraryResult.ofItemList(items, params))
    }

    override fun onGetItem(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      mediaId: String,
    ): ListenableFuture<LibraryResult<MediaItem>> {
      val node =
        PlaybackCore.browseTree().item(mediaId)
          ?: return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE))
      return Futures.immediateFuture(LibraryResult.ofItem(ItemCodec.browseItem(mediaId, node), null))
    }

    /**
     * Un brano scelto in macchina arriva senza URL: in coda vanno i brani
     * della sua cartella, a partire da lui (contratto, `setBrowseTree`).
     */
    override fun onSetMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
      startIndex: Int,
      startPositionMs: Long,
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      val picked = mediaItems.singleOrNull()
      if (picked != null && picked.localConfiguration == null) {
        PlaybackCore.browseTree().resolve(picked.mediaId)?.let { selection ->
          return Futures.immediateFuture(
            MediaSession.MediaItemsWithStartPosition(
              selection.tracks.map(ItemCodec::fromBrowse),
              selection.startIndex,
              C.TIME_UNSET,
            )
          )
        }
      }
      val resolved = mediaItems.mapNotNull(::resolve)
      val start = if (startIndex in resolved.indices) startIndex else 0
      return Futures.immediateFuture(
        MediaSession.MediaItemsWithStartPosition(resolved, start, startPositionMs)
      )
    }

    override fun onAddMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
    ): ListenableFuture<MutableList<MediaItem>> =
      Futures.immediateFuture(mediaItems.mapNotNull(::resolve).toMutableList())

    /** Un elemento con il suo URL resta com'e'; senza, si cerca nell'albero. */
    private fun resolve(item: MediaItem): MediaItem? {
      if (item.localConfiguration != null) return item
      val tree = PlaybackCore.browseTree()
      val node = tree.item(item.mediaId)?.takeIf { !it.isFolder && it.url != null } ?: tree.track(item.mediaId)
      return node?.let(ItemCodec::fromBrowse)
    }
  }

  private companion object {
    const val TAG = "OndaPlayback"
  }
}
