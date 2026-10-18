package com.onda.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SourceRecoveryTest {
  @Test
  fun `la pausa revoca il recupero anche con un errore ancora presente`() {
    val calls = mutableListOf<String>()
    assertFalse(SourceRecovery.skip(false, true, true) { calls += "riparti" })
    assertTrue(calls.isEmpty())
  }

  @Test
  fun `un errore gia' superato o la fine coda non fanno saltare un brano sano`() {
    var attempts = 0
    assertFalse(SourceRecovery.skip(true, false, true) { attempts++ })
    assertFalse(SourceRecovery.skip(true, true, false) { attempts++ })
    assertEquals(0, attempts)
  }

  @Test
  fun `il buffering non revoca un play richiesto e il recupero avviene una volta`() {
    var attempts = 0
    assertTrue(SourceRecovery.skip(true, true, true) { attempts++ })
    assertEquals(1, attempts)
  }
}
