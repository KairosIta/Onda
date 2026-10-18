package com.onda.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class LibraryAccessTest {
  private val tree = BrowseTree(listOf(
    BrowseNode("onda:favorites", "Preferiti", children = listOf(
      BrowseNode("audius:a", "A", url = "https://example.test/a"),
      BrowseNode("audius:b", "B", url = "https://example.test/b"),
    )),
    BrowseNode("onda:history", "Recenti", children = listOf(
      BrowseNode("jamendo:1", "Uno", url = "https://example.test/1"),
    )),
    BrowseNode("onda:playlist:p1", "Privata", children = emptyList()),
  ))

  @Test
  fun `un chiamante non fidato non legge figli o elementi con id noti`() {
    var loaded = false
    val access = LibraryAccess(false) { loaded = true; tree }
    assertEquals(BrowseResult.Denied, access.root())
    for (id in listOf(BrowseTree.ROOT_ID, "onda:favorites", "onda:history", "onda:playlist:p1")) {
      assertEquals(BrowseResult.Denied, access.children(id, 0, 100))
      assertEquals(BrowseResult.Denied, access.item(id))
    }
    assertEquals(BrowseResult.Denied, access.item("onda:favorites|audius:a"))
    assertFalse("nessuna lettura dei dati privati", loaded)
  }

  @Test
  fun `un controller autorizzato naviga e pagina senza perdere i metadati`() {
    val access = LibraryAccess(true) { tree }
    val root = access.root() as BrowseResult.Found
    assertEquals(3, root.value.children?.size)
    val page = access.children("onda:favorites", 1, 1) as BrowseResult.Found
    assertEquals(listOf("onda:favorites|audius:b"), page.value.map { it.first })
    val item = access.item(page.value.single().first) as BrowseResult.Found
    assertEquals("B", item.value.title)
    assertEquals("https://example.test/b", item.value.url)
    assertEquals(BrowseResult.Found(emptyList<Pair<String, BrowseNode>>()), access.children("onda:favorites", Int.MAX_VALUE, Int.MAX_VALUE))
  }

  @Test
  fun `id sconosciuti e pagine invalide non espongono altri elementi`() {
    val access = LibraryAccess(true) { tree }
    assertEquals(BrowseResult.Missing, access.item("sconosciuto"))
    assertEquals(BrowseResult.Missing, access.children("sconosciuto", 0, 1))
    assertEquals(BrowseResult.Missing, access.children("onda:favorites", -1, 1))
    assertEquals(BrowseResult.Missing, access.children("onda:favorites", 0, 0))
  }
}
