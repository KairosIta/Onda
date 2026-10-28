package com.onda.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class QueueRequestTest {
  private val a = BrowseNode("audius:a", "A", url = "https://example.test/a")
  private val b = BrowseNode("audius:b", "B", url = "https://example.test/b")
  private val tree =
    BrowseTree(
      listOf(
        BrowseNode(
          "onda:favorites",
          "Preferiti",
          children = listOf(a, b, BrowseNode("audius:c", "C", url = null)),
        )
      )
    )

  private fun given(mediaId: String) = QueueRequest.Item(mediaId, hasUrl = true)

  private fun fromTree(mediaId: String) = QueueRequest.Item(mediaId, hasUrl = false)

  @Test
  fun `un brano scelto in macchina porta la sua cartella, da lui, e lascia la posizione al player`() {
    val outcome =
      QueueRequest.plan(tree, listOf(fromTree("onda:favorites|audius:b")), 0)
        as QueueRequest.Resolved
    assertEquals(
      listOf(QueueRequest.Entry.FromTree(a), QueueRequest.Entry.FromTree(b)),
      outcome.entries,
    )
    assertEquals(1, outcome.startIndex)
    assertTrue(outcome.fromTree)
  }

  @Test
  fun `gli elementi con URL restano, quelli senza si cercano, e l'indice chiesto vale se esiste`() {
    val items = listOf(given("x"), fromTree("audius:a"), fromTree("sconosciuto"), given("y"))
    val outcome = QueueRequest.plan(tree, items, 2) as QueueRequest.Resolved
    assertEquals(
      listOf(
        QueueRequest.Entry.Given(0),
        QueueRequest.Entry.FromTree(a),
        QueueRequest.Entry.Given(3),
      ),
      outcome.entries,
    )
    assertEquals(2, outcome.startIndex)
    assertFalse(outcome.fromTree)

    val outOfRange = QueueRequest.plan(tree, items, 7) as QueueRequest.Resolved
    assertEquals(0, outOfRange.startIndex)
  }

  @Test
  fun `senza nessun brano riconosciuto la richiesta fallisce invece di svuotare la coda`() {
    val unresolved =
      listOf(
        emptyList(),
        // Una ricerca vocale arriva senza id ne' URL.
        listOf(fromTree("")),
        // Un id di Auto rimasto indietro rispetto all'albero.
        listOf(fromTree("onda:playlist:vecchia|audius:a")),
        // Una cartella non e' un brano.
        listOf(fromTree("onda:favorites")),
        // Un brano senza URL non si suona.
        listOf(fromTree("audius:c")),
        listOf(fromTree("sconosciuto"), fromTree("onda:favorites|audius:c")),
      )
    for (items in unresolved) {
      assertEquals("$items", QueueRequest.Unresolved, QueueRequest.plan(tree, items, 0))
    }
  }
}
