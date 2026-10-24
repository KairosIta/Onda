package com.onda.playback

import androidx.media3.common.PlaybackException
import org.junit.Assert.assertEquals
import org.junit.Test

class ErrorCategoryTest {
  @Test
  fun `la rete che cade si riprova`() {
    assertEquals(
      "network",
      ErrorCategory.of(PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED),
    )
    assertEquals(
      "network",
      ErrorCategory.of(PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT),
    )
    assertEquals("network", ErrorCategory.of(PlaybackException.ERROR_CODE_TIMEOUT))
  }

  @Test
  fun `una risposta HTTP passeggera si riprova, una definitiva salta il brano`() {
    val http = PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
    assertEquals("network", ErrorCategory.of(http, 503))
    assertEquals("network", ErrorCategory.of(http, 429))
    assertEquals("network", ErrorCategory.of(http, 408))
    assertEquals("source", ErrorCategory.of(http, 404))
    assertEquals("source", ErrorCategory.of(http, 403))
    assertEquals("source", ErrorCategory.of(http, null))
  }

  @Test
  fun `un 416 dopo un seek salta il brano e dice dove si era`() {
    val http = PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
    assertEquals("source", ErrorCategory.of(http, ErrorCategory.HTTP_RANGE_NOT_SATISFIABLE))
    assertEquals(
      "Source error (HTTP 416 a 4020.5 s di 5208.0 s dichiarati)",
      ErrorCategory.describe("Source error", "ERROR_CODE_IO_BAD_HTTP_STATUS", 416, 4020.5, 5208.0),
    )
    assertEquals(
      "Source error (HTTP 404)",
      ErrorCategory.describe("Source error", "ERROR_CODE_IO_BAD_HTTP_STATUS", 404, 12.0, 100.0),
    )
    assertEquals(
      "ERROR_CODE_TIMEOUT",
      ErrorCategory.describe(null, "ERROR_CODE_TIMEOUT", null, 12.0, 100.0),
    )
  }

  @Test
  fun `uno stream illeggibile salta il brano`() {
    assertEquals("source", ErrorCategory.of(PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND))
    assertEquals("source", ErrorCategory.of(PlaybackException.ERROR_CODE_IO_UNSPECIFIED))
    assertEquals(
      "source",
      ErrorCategory.of(PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED),
    )
  }

  @Test
  fun `decoder e uscita audio sono del renderer, il resto e' ignoto`() {
    assertEquals("renderer", ErrorCategory.of(PlaybackException.ERROR_CODE_DECODING_FAILED))
    assertEquals(
      "renderer",
      ErrorCategory.of(PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED),
    )
    assertEquals("unknown", ErrorCategory.of(PlaybackException.ERROR_CODE_UNSPECIFIED))
    assertEquals("unknown", ErrorCategory.of(PlaybackException.ERROR_CODE_DRM_UNSPECIFIED))
  }
}
