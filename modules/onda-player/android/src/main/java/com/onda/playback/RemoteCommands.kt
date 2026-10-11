package com.onda.playback

import androidx.media3.common.Player

/**
 * I tasti esposti a notifica, schermata di blocco, cuffie e Android Auto
 * (`RemoteCommand` nel contratto) e i comandi Media3 che li accendono.
 */
internal object RemoteCommands {
  /** Quelli di `setupPlayer`, validi finche' il JS non ne ha mai mandati. */
  val DEFAULT: List<String> = listOf("play-pause", "next", "previous", "seek", "stop")

  private val PLAYER_COMMANDS: Map<String, List<Int>> =
    mapOf(
      "play-pause" to listOf(Player.COMMAND_PLAY_PAUSE),
      "next" to listOf(Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM),
      "previous" to
        listOf(Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM),
      "seek" to listOf(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM),
      "stop" to listOf(Player.COMMAND_STOP),
    )

  /** I comandi da togliere: quelli dei tasti che il JS non ha chiesto. */
  fun withheld(enabled: Collection<String>): List<Int> =
    PLAYER_COMMANDS.filterKeys { it !in enabled }.values.flatten()
}
