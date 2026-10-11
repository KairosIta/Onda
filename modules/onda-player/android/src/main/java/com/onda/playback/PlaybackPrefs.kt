package com.onda.playback

import android.content.Context
import androidx.media3.common.Player

/**
 * Quello che il servizio deve sapere anche quando il JS non e' mai partito,
 * come in Android Auto a freddo: i tasti esposti, l'intervallo del timer di
 * posizione, ripetizione e shuffle.
 */
internal class PlaybackPrefs(context: Context) {
  private val prefs = context.getSharedPreferences("onda_playback", Context.MODE_PRIVATE)

  var remoteCommands: List<String>
    get() = prefs.getString(COMMANDS, null)?.split(',')?.filter { it.isNotEmpty() } ?: RemoteCommands.DEFAULT
    set(value) = prefs.edit().putString(COMMANDS, value.joinToString(",")).apply()

  var progressIntervalMs: Long
    get() = prefs.getLong(PROGRESS_INTERVAL, DEFAULT_PROGRESS_INTERVAL_MS)
    set(value) = prefs.edit().putLong(PROGRESS_INTERVAL, value).apply()

  var repeatMode: Int
    get() = prefs.getInt(REPEAT, Player.REPEAT_MODE_OFF)
    set(value) = prefs.edit().putInt(REPEAT, value).apply()

  var shuffle: Boolean
    get() = prefs.getBoolean(SHUFFLE, false)
    set(value) = prefs.edit().putBoolean(SHUFFLE, value).apply()

  private companion object {
    const val COMMANDS = "remoteCommands"
    const val PROGRESS_INTERVAL = "progressIntervalMs"
    const val REPEAT = "repeatMode"
    const val SHUFFLE = "shuffle"
    const val DEFAULT_PROGRESS_INTERVAL_MS = 5_000L
  }
}
