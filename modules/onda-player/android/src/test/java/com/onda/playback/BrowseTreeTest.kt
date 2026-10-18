package com.onda.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BrowseTreeTest {
  /** La forma di `buildBrowseTree` (src/services/browseTree.ts), con lo stesso brano in due posti. */
  private val json =
    """
    [
      {"mediaId": "onda:favorites", "title": "Preferiti", "items": [
        {"mediaId": "audius:a", "title": "A", "artist": "X", "url": "https://x.test/a", "duration": 120},
        {"mediaId": "audius:b", "title": "B", "url": "https://x.test/b"}
      ]},
      {"mediaId": "onda:playlists", "title": "Playlist", "items": [
        {"mediaId": "onda:playlist:p1", "title": "Corsa", "children": [
          {"mediaId": "jamendo:1", "title": "Uno", "url": "https://x.test/1"},
          {"mediaId": "audius:a", "title": "A", "url": "https://x.test/a"},
          {"mediaId": "audius:c", "title": "C", "url": null}
        ]}
      ]}
    ]
    """

  private val tree = BrowseTree.parse(json)

  @Test
  fun `la radice mostra le schede`() {
    assertEquals(
      listOf("onda:favorites", "onda:playlists"),
      tree.children(BrowseTree.ROOT_ID)?.map { it.first },
    )
  }

  @Test
  fun `un brano porta la sua cartella nell'id, una cartella no`() {
    assertEquals(
      listOf("onda:favorites|audius:a", "onda:favorites|audius:b"),
      tree.children("onda:favorites")?.map { it.first },
    )
    assertEquals(listOf("onda:playlist:p1"), tree.children("onda:playlists")?.map { it.first })
    assertNull(tree.children("onda:nessuna"))
  }

  @Test
  fun `scelto un brano in coda vanno i suoi vicini, da lui`() {
    val selection = tree.resolve("onda:playlist:p1|audius:a")!!
    assertEquals(listOf("jamendo:1", "audius:a"), selection.tracks.map { it.mediaId })
    assertEquals(1, selection.startIndex)

    val fromFavorites = tree.resolve("onda:favorites|audius:a")!!
    assertEquals(listOf("audius:a", "audius:b"), fromFavorites.tracks.map { it.mediaId })
    assertEquals(0, fromFavorites.startIndex)
  }

  @Test
  fun `un uid senza cartella si cerca nell'albero`() {
    val selection = tree.resolve("jamendo:1")!!
    assertEquals(0, selection.startIndex)
    assertEquals("Uno", tree.track("jamendo:1")?.title)
  }

  @Test
  fun `un brano senza stream non si suona`() {
    assertNull(tree.resolve("onda:playlist:p1|audius:c"))
    assertNull(tree.track("audius:c"))
  }

  @Test
  fun `campi letti e voci ritrovate per id`() {
    val a = tree.item("onda:favorites|audius:a")!!
    assertEquals("X", a.artist)
    assertEquals(120.0, a.durationSec!!, 0.0)
    assertNull(tree.item("onda:favorites|audius:b")?.durationSec)
    assertTrue(tree.item("onda:playlist:p1")!!.isFolder)
    assertEquals(2, tree.item(BrowseTree.ROOT_ID)?.children?.size)
    assertEquals(setOf("onda:favorites", "onda:playlists", "onda:playlist:p1"), tree.folderIds())
  }
}

class BrowseTreeCredentialsTest {
  private val tagged = "https://prod-1.storage.jamendo.com/?trackid=1&format=mp32&from=app-id-di-prova"
  private val clean = "https://prod-1.storage.jamendo.com/?trackid=1&format=mp32"

  @Test
  fun `il parametro from si toglie solo dagli URL Jamendo`() {
    assertEquals(clean, BrowseTree.stripJamendoAppTag(tagged))
    assertEquals("https://mp3l.jamendo.com/", BrowseTree.stripJamendoAppTag("https://mp3l.jamendo.com/?from=app-x"))
    assertEquals(clean, BrowseTree.stripJamendoAppTag(clean))
    assertEquals("https://x.test/a?from=app-x", BrowseTree.stripJamendoAppTag("https://x.test/a?from=app-x"))
    assertEquals("https://evil.test/jamendo.com/?from=app-x", BrowseTree.stripJamendoAppTag("https://evil.test/jamendo.com/?from=app-x"))
  }

  @Test
  fun `su disco l'albero non porta il Client ID e conserva struttura e brani`() {
    val json =
      """
      [
        {"mediaId": "onda:favorites", "title": "Preferiti", "items": [
          {"mediaId": "jamendo:1", "title": "Uno", "url": "$tagged", "duration": 120},
          {"mediaId": "audius:a", "title": "A", "url": "https://x.test/a?from=app-x", "artist": null}
        ]},
        {"mediaId": "onda:playlists", "title": "Playlist", "items": [
          {"mediaId": "onda:playlist:p1", "title": "Corsa", "children": [
            {"mediaId": "jamendo:1", "title": "Uno", "url": "$tagged"},
            {"mediaId": "audius:c", "title": "C", "url": null}
          ]}
        ]}
      ]
      """
    val stored = BrowseTree.withoutStreamCredentials(json)
    assertTrue("nessun Client ID su disco", !stored.contains("id-di-prova"))
    val tree = BrowseTree.parse(stored)
    assertEquals(clean, tree.item("onda:favorites|jamendo:1")?.url)
    assertEquals(clean, tree.item("onda:playlist:p1|jamendo:1")?.url)
    assertEquals("https://x.test/a?from=app-x", tree.item("onda:favorites|audius:a")?.url)
    assertNull(tree.item("onda:playlist:p1|audius:c")?.url)
    assertEquals(120.0, tree.item("onda:favorites|jamendo:1")?.durationSec)
    assertEquals(2, tree.children("onda:playlist:p1")?.size)
  }
}
