package com.onda.playback

import androidx.media3.common.Player
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Il player di Onda visto dal JS (`modules/onda-player/index.ts`). Le
 * funzioni sono sincrone e girano sul thread del JS: i comandi si accodano
 * sul main thread e tornano subito, le letture aspettano la loro risposta
 * (vedi [PlaybackCore]). I tempi sono in secondi, come nel contratto.
 */
class OndaPlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OndaPlayer")

    Events(EVENT)

    OnCreate {
      PlaybackCore.init(appContext.reactContext ?: throw Exceptions.ReactContextLost())
      PlaybackCore.events = { body -> sendEvent(EVENT, body) }
    }

    OnDestroy { PlaybackCore.events = null }

    OnActivityEntersForeground { PlaybackCore.post { onAppForeground() } }

    Function("setup") { progressIntervalSeconds: Double, commands: List<String> ->
      PlaybackCore.post { setup(progressIntervalSeconds, commands) }
    }

    Function("play") { PlaybackCore.post { play() } }
    Function("pause") { PlaybackCore.post { pause() } }
    Function("seekTo") { seconds: Double -> PlaybackCore.post { seekTo(seconds) } }
    Function("skipToNext") { PlaybackCore.post { skipToNext() } }
    Function("skipToPrevious") { PlaybackCore.post { skipToPrevious() } }
    Function("skipToIndex") { index: Int -> PlaybackCore.post { skipToIndex(index) } }
    Function("retry") { PlaybackCore.post { retry() } }
    Function("scheduleRetry") { seconds: Double -> PlaybackCore.post { scheduleRetry(seconds) } }
    Function("cancelRetry") { PlaybackCore.post { cancelRetry() } }

    Function("setMediaItems") { items: List<Map<String, Any?>>, startIndex: Int ->
      val built = items.map(ItemCodec::fromJs)
      PlaybackCore.post { setMediaItems(built, startIndex) }
    }
    Function("addMediaItem") { item: Map<String, Any?> ->
      val built = ItemCodec.fromJs(item)
      PlaybackCore.post { addMediaItem(built) }
    }
    Function("insertMediaItems") { index: Int, items: List<Map<String, Any?>> ->
      val built = items.map(ItemCodec::fromJs)
      PlaybackCore.post { insertMediaItems(index, built) }
    }
    Function("removeMediaItems") { from: Int, to: Int ->
      PlaybackCore.post { removeMediaItems(from, to) }
    }
    Function("moveMediaItem") { from: Int, to: Int -> PlaybackCore.post { moveMediaItem(from, to) } }

    Function("getQueue") { PlaybackCore.read(emptyList()) { queue() } }
    Function("getActiveIndex") { PlaybackCore.read<Int?>(null) { activeIndex() } }
    Function("getActiveMediaItem") { PlaybackCore.read<Map<String, Any?>?>(null) { activeItem() } }
    Function("getProgress") {
      PlaybackCore.read(mapOf("position" to 0.0, "duration" to 0.0, "buffered" to 0.0)) { progress() }
    }
    // Senza passare dal main: valgono come li ha annunciati l'ultimo evento.
    Function("isPlaying") { PlaybackCore.playingNow }
    Function("getPlaybackState") { PlaybackCore.stateNow }

    Function("setRepeatMode") { mode: String ->
      val repeat =
        when (mode) {
          "one" -> Player.REPEAT_MODE_ONE
          "all" -> Player.REPEAT_MODE_ALL
          else -> Player.REPEAT_MODE_OFF
        }
      PlaybackCore.post { setRepeatMode(repeat) }
    }
    Function("setShuffleModeEnabled") { enabled: Boolean ->
      PlaybackCore.post { setShuffleModeEnabled(enabled) }
    }

    Function("sleepAfter") { seconds: Double -> PlaybackCore.post { sleepAfter(seconds) } }
    Function("cancelSleep") { PlaybackCore.post { cancelSleep() } }

    Function("setBrowseTree") { json: String ->
      val parsed = PlaybackCore.storeBrowseTree(json)
      PlaybackCore.post { applyBrowseTree(parsed) }
    }
  }

  private companion object {
    const val EVENT = "onPlayerEvent"
  }
}
