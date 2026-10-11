package com.onda.playback

import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata

/**
 * Quello che un elemento in coda porta per il JS e che non serve a nessun
 * altro: la chiave con cui il JS ritrova il suo oggetto e gli `extras` come
 * JSON. Sta nel tag, che resta nel processo: in `MediaMetadata.extras`
 * viaggerebbe a ogni controller (notifica, Bluetooth, Android Auto).
 */
internal data class ItemTag(val key: String?, val extras: String?)

/** `MediaItem` del contratto (tempi in secondi) da e verso Media3. */
internal object ItemCodec {
  /** Un elemento mandato dal JS: chiavi come `NativeMediaItem` in `modules/onda-player`. */
  fun fromJs(map: Map<String, Any?>): MediaItem {
    val metadata =
      MediaMetadata.Builder()
        .setTitle(map["title"] as? String)
        .setArtist(map["artist"] as? String)
        .setArtworkUri((map["artworkUrl"] as? String)?.let(Uri::parse))
        .setDurationMs((map["duration"] as? Number)?.let { (it.toDouble() * 1000).toLong() })
        .setIsBrowsable(false)
        .setIsPlayable(true)
        .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
        .build()
    return MediaItem.Builder()
      .setMediaId(map["mediaId"] as? String ?: "")
      .setUri(map["url"] as? String ?: "")
      .setTag(ItemTag(map["key"] as? String, map["extras"] as? String))
      .setMediaMetadata(metadata)
      .build()
  }

  fun toJs(item: MediaItem): Map<String, Any?> {
    val tag = item.localConfiguration?.tag as? ItemTag
    val metadata = item.mediaMetadata
    return mapOf(
      "key" to tag?.key,
      "mediaId" to item.mediaId,
      "url" to (item.localConfiguration?.uri?.toString() ?: ""),
      "title" to metadata.title?.toString(),
      "artist" to metadata.artist?.toString(),
      "artworkUrl" to metadata.artworkUri?.toString(),
      "duration" to metadata.durationMs?.let { it / 1000.0 },
      "extras" to tag?.extras,
    )
  }

  /** Un brano scelto in Android Auto, pronto per la coda: l'id e' l'uid nudo. */
  fun fromBrowse(node: BrowseNode): MediaItem =
    MediaItem.Builder()
      .setMediaId(node.mediaId)
      .setUri(node.url ?: "")
      .setTag(ItemTag(key = null, extras = null))
      .setMediaMetadata(metadata(node, browsable = false))
      .build()

  /** Una voce da mostrare in Android Auto, con il suo id di navigazione. */
  fun browseItem(browseId: String, node: BrowseNode): MediaItem =
    MediaItem.Builder()
      .setMediaId(browseId)
      .setMediaMetadata(metadata(node, browsable = node.isFolder))
      .build()

  private fun metadata(node: BrowseNode, browsable: Boolean): MediaMetadata =
    MediaMetadata.Builder()
      .setTitle(node.title)
      .setArtist(node.artist)
      .setArtworkUri(node.artworkUrl?.let(Uri::parse))
      .setDurationMs(node.durationSec?.let { (it * 1000).toLong() })
      .setIsBrowsable(browsable)
      .setIsPlayable(!browsable)
      .setMediaType(
        if (browsable) MediaMetadata.MEDIA_TYPE_FOLDER_MIXED else MediaMetadata.MEDIA_TYPE_MUSIC
      )
      .build()
}
