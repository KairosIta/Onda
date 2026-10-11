package com.onda.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SleepTimerTest {
  private var now = 1_000_000L
  private val timer = SleepTimer { now }

  @Test
  fun `scatta alla scadenza e una volta sola`() {
    assertEquals(900_000L, timer.start(900.0))
    now += 900_000
    assertTrue(timer.onFire())
    assertFalse(timer.onFire())
    assertFalse(timer.isArmed)
  }

  @Test
  fun `uno scatto in anticipo non mette in pausa e dice quanto manca`() {
    timer.start(60.0)
    now += 59_000
    assertFalse(timer.onFire())
    assertEquals(1_000L, timer.remainingMs())
  }

  @Test
  fun `scaduto a player fermo non ferma una ripresa`() {
    timer.start(60.0)
    now += 120_000
    timer.onPlaybackResumed()
    assertFalse(timer.isArmed)
    assertFalse(timer.onFire())
  }

  @Test
  fun `una ripresa prima della scadenza non lo tocca`() {
    timer.start(60.0)
    now += 30_000
    timer.onPlaybackResumed()
    assertTrue(timer.isArmed)
    now += 30_000
    assertTrue(timer.onFire())
  }

  @Test
  fun `un timer nuovo sostituisce il vecchio, e si puo' annullare`() {
    timer.start(60.0)
    timer.start(120.0)
    now += 60_000
    assertFalse(timer.onFire())
    timer.cancel()
    assertNull(timer.remainingMs())
  }
}
