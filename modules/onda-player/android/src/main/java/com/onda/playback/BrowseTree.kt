package com.onda.playback

import org.json.JSONArray
import org.json.JSONObject

/**
 * Una voce dell'albero di Android Auto (`BrowseItem` nel contratto): un brano,
 * o una cartella con `children`. Le schede in cima sono cartelle anche loro.
 */
internal data class BrowseNode(
  val mediaId: String,
  val title: String,
  val artist: String? = null,
  val artworkUrl: String? = null,
  val url: String? = null,
  val durationSec: Double? = null,
  val children: List<BrowseNode>? = null,
) {
  val isFolder: Boolean
    get() = children != null
}

/**
 * L'albero che il JS manda con `setBrowseTree`, servito ad Android Auto.
 *
 * Lo stesso brano puo' stare in Preferiti, in una playlist e negli ascolti
 * recenti: in macchina il suo id porta anche la cartella
 * ([trackId]), cosi' scelto un brano si sa quali sono i suoi vicini. In
 * coda torna l'uid nudo, come per i brani messi dall'app.
 */
internal class BrowseTree(val categories: List<BrowseNode>) {
  /** Un brano scelto in macchina: i brani della sua cartella e da quale partire. */
  data class Selection(val tracks: List<BrowseNode>, val startIndex: Int)

  private val folders: Map<String, BrowseNode> = buildMap {
    fun index(node: BrowseNode) {
      if (!node.isFolder) return
      putIfAbsent(node.mediaId, node)
      node.children?.forEach(::index)
    }
    categories.forEach(::index)
  }

  /** Le cartelle, schede comprese: chi le guarda in macchina va avvisato quando cambiano. */
  fun folderIds(): Set<String> = folders.keys

  /** I figli di una cartella con il loro id di navigazione, o `null` se la cartella non c'e'. */
  fun children(parentId: String): List<Pair<String, BrowseNode>>? {
    if (parentId == ROOT_ID) return categories.map { it.mediaId to it }
    val folder = folders[parentId] ?: return null
    return folder.children.orEmpty().map { child ->
      (if (child.isFolder) child.mediaId else trackId(parentId, child.mediaId)) to child
    }
  }

  /** La voce con questo id di navigazione. */
  fun item(browseId: String): BrowseNode? {
    if (browseId == ROOT_ID) return ROOT.copy(children = categories)
    folders[browseId]?.let {
      return it
    }
    val (parentId, uid) = splitTrackId(browseId) ?: return null
    return folders[parentId]?.children?.firstOrNull { !it.isFolder && it.mediaId == uid }
  }

  /**
   * I brani da mettere in coda per una scelta: quelli suonabili della stessa
   * cartella. Un uid senza cartella si cerca nell'albero, prima occorrenza.
   */
  fun resolve(browseId: String): Selection? {
    val split = splitTrackId(browseId)
    val folder = (if (split != null) folders[split.first] else folderOf(browseId)) ?: return null
    val uid = split?.second ?: browseId
    val tracks = folder.children.orEmpty().filter { !it.isFolder && it.url != null }
    val start = tracks.indexOfFirst { it.mediaId == uid }
    return if (start < 0) null else Selection(tracks, start)
  }

  /** Un brano dato per uid, ovunque sia. */
  fun track(uid: String): BrowseNode? =
    folderOf(uid)?.children?.firstOrNull { !it.isFolder && it.mediaId == uid && it.url != null }

  private fun folderOf(uid: String): BrowseNode? =
    folders.values.firstOrNull { folder ->
      folder.children.orEmpty().any { !it.isFolder && it.mediaId == uid }
    }

  companion object {
    const val ROOT_ID = "onda:root"
    private const val SEPARATOR = '|'
    private val ROOT = BrowseNode(ROOT_ID, "Onda", children = emptyList())

    val EMPTY = BrowseTree(emptyList())

    fun trackId(parentId: String, uid: String): String = "$parentId$SEPARATOR$uid"

    private fun splitTrackId(browseId: String): Pair<String, String>? {
      val at = browseId.indexOf(SEPARATOR)
      if (at <= 0 || at == browseId.length - 1) return null
      return browseId.substring(0, at) to browseId.substring(at + 1)
    }

    /** Le categorie di `setBrowseTree`, come JSON. Lancia se il JSON non e' valido. */
    fun parse(json: String): BrowseTree {
      val array = JSONArray(json)
      val categories =
        (0 until array.length()).map { i ->
          val category = array.getJSONObject(i)
          BrowseNode(
            mediaId = category.getString("mediaId"),
            title = category.getString("title"),
            children = nodes(category.optJSONArray("items")),
          )
        }
      return BrowseTree(categories)
    }

    private fun nodes(array: JSONArray?): List<BrowseNode> =
      if (array == null) emptyList() else (0 until array.length()).map { node(array.getJSONObject(it)) }

    private fun node(json: JSONObject): BrowseNode =
      BrowseNode(
        mediaId = json.getString("mediaId"),
        title = json.getString("title"),
        artist = json.stringOrNull("artist"),
        artworkUrl = json.stringOrNull("artworkUrl"),
        url = json.stringOrNull("url"),
        durationSec = if (json.isNull("duration")) null else json.optDouble("duration").takeIf { !it.isNaN() },
        children = if (json.has("children")) nodes(json.optJSONArray("children")) else null,
      )

    private fun JSONObject.stringOrNull(key: String): String? = if (isNull(key)) null else getString(key)

    /**
     * Lo stesso JSON senza il Client ID Jamendo negli URL di stream: e' la
     * forma che va su disco. In memoria l'albero tiene gli URL di
     * riproduzione, che il JS manda con il Client ID corrente; a freddo, da
     * questo file, Jamendo suona senza il tag di attribuzione finche' il JS
     * non rimanda l'albero. Stessa regola di `sources/jamendoStream` lato app.
     */
    fun withoutStreamCredentials(json: String): String {
      val array = JSONArray(json)
      scrub(array)
      return array.toString()
    }

    private fun scrub(array: JSONArray) {
      for (i in 0 until array.length()) (array.opt(i) as? JSONObject)?.let(::scrub)
    }

    private fun scrub(node: JSONObject) {
      node.stringOrNull("url")?.let { node.put("url", stripJamendoAppTag(it)) }
      node.optJSONArray("items")?.let(::scrub)
      node.optJSONArray("children")?.let(::scrub)
    }

    private val JAMENDO_HOST = Regex("^https?://(?:[^/?#]*\\.)?jamendo\\.com(?=[/?#]|$)", RegexOption.IGNORE_CASE)

    /** L'URL senza il parametro `from` (`from=app-<client_id>`), solo sugli host Jamendo. */
    fun stripJamendoAppTag(url: String): String {
      if (!JAMENDO_HOST.containsMatchIn(url)) return url
      val at = url.indexOf('?')
      if (at < 0) return url
      val kept = url.substring(at + 1).split('&').filter { it.isNotEmpty() && !it.startsWith("from=", ignoreCase = true) }
      return url.substring(0, at) + if (kept.isEmpty()) "" else "?" + kept.joinToString("&")
    }
  }
}
