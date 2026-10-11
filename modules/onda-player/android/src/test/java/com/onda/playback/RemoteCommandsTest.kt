package com.onda.playback

import androidx.media3.common.Player
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteCommandsTest {
  @Test
  fun `con tutti i tasti di Onda non si toglie niente`() {
    assertTrue(RemoteCommands.withheld(RemoteCommands.DEFAULT).isEmpty())
  }

  @Test
  fun `un tasto non chiesto spegne tutti i suoi comandi`() {
    val withheld = RemoteCommands.withheld(listOf("play-pause", "seek", "stop"))
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
    val withheld = RemoteCommands.withheld(emptyList()).toSet()
    assertTrue(Player.COMMAND_PLAY_PAUSE in withheld)
    assertTrue(Player.COMMAND_STOP in withheld)
    assertTrue(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM in withheld)
    assertTrue(Player.COMMAND_SET_MEDIA_ITEM !in withheld)
  }
}
