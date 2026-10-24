package com.onda.playback

import androidx.media3.common.Player
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteCommandsTest {
  @Test
  fun `con tutti i tasti di Onda non si toglie niente`() {
    assertTrue(RemoteCommands.withheld(RemoteCommands.DEFAULT, canBrowse = true).isEmpty())
  }

  @Test
  fun `un tasto non chiesto spegne tutti i suoi comandi`() {
    val withheld = RemoteCommands.withheld(listOf("play-pause", "seek", "stop"), canBrowse = true)
    assertEquals(
      setOf(
        Player.COMMAND_SEEK_TO_NEXT,
        Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
        Player.COMMAND_SEEK_TO_PREVIOUS,
        Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
      ),
      withheld.toSet(),
    )
  }

  @Test
  fun `senza tasti restano solo i comandi che non sono tasti`() {
    val withheld = RemoteCommands.withheld(emptyList(), canBrowse = true).toSet()
    assertTrue(Player.COMMAND_PLAY_PAUSE in withheld)
    assertTrue(Player.COMMAND_STOP in withheld)
    assertTrue(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM in withheld)
    assertTrue(Player.COMMAND_SET_MEDIA_ITEM !in withheld)
  }

  @Test
  fun `un controller soltanto fidato comanda il trasporto ma non sostituisce la coda`() {
    val transportOnly = RemoteCommands.withheld(RemoteCommands.DEFAULT, canBrowse = false).toSet()
    assertEquals(RemoteCommands.QUEUE_COMMANDS.toSet(), transportOnly)
    assertTrue(Player.COMMAND_SET_MEDIA_ITEM in transportOnly)
    assertTrue(Player.COMMAND_CHANGE_MEDIA_ITEMS in transportOnly)
    assertTrue(Player.COMMAND_PLAY_PAUSE !in transportOnly)
    assertTrue(Player.COMMAND_SEEK_TO_NEXT !in transportOnly)

    val browser = RemoteCommands.withheld(RemoteCommands.DEFAULT, canBrowse = true)
    assertTrue(browser.none { it in RemoteCommands.QUEUE_COMMANDS })
  }
}
