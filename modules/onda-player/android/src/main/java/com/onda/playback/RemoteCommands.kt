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

  /**
   * I comandi che sostituiscono o cambiano la coda. Li tiene soltanto chi
   * puo' anche sfogliare la libreria (Onda, Android Auto, Automotive): un
   * controller soltanto fidato comanda il trasporto della coda che c'e', non
   * ne manda una sua. Senza questo confine qualunque app con l'accesso alle
   * notifiche potrebbe far suonare a Onda un URL qualsiasi, con titolo e
   * copertina scelti da lei, o mettere in coda una cartella della libreria
   * indovinandone l'id.
   */
  val QUEUE_COMMANDS: List<Int> =
    listOf(Player.COMMAND_SET_MEDIA_ITEM, Player.COMMAND_CHANGE_MEDIA_ITEMS)

  /**
   * I comandi da togliere a un controller: quelli dei tasti che il JS non ha
   * chiesto e, se non puo' sfogliare la libreria, quelli della coda.
   */
  fun withheld(enabled: Collection<String>, canBrowse: Boolean): List<Int> =
    PLAYER_COMMANDS.filterKeys { it !in enabled }.values.flatten() +
      if (canBrowse) emptyList() else QUEUE_COMMANDS
}
