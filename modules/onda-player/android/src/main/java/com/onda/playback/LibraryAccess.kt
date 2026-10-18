package com.onda.playback

/** Risposte di navigazione prima della conversione nei tipi Android/Media3. */
internal sealed interface BrowseResult<out T> {
  data object Denied : BrowseResult<Nothing>
  data object Missing : BrowseResult<Nothing>
  data class Found<T>(val value: T) : BrowseResult<T>
}

/** Le tre letture della libreria condividono lo stesso confine di accesso. */
internal class LibraryAccess(private val allowed: Boolean, private val tree: () -> BrowseTree) {
  fun root(): BrowseResult<BrowseNode> = item(BrowseTree.ROOT_ID)

  fun item(id: String): BrowseResult<BrowseNode> = read { it.item(id) }

  fun children(parentId: String, page: Int, pageSize: Int): BrowseResult<List<Pair<String, BrowseNode>>> =
    read { current ->
      if (page < 0 || pageSize <= 0) return@read null
      val children = current.children(parentId) ?: return@read null
      val from = (page.toLong() * pageSize).coerceAtMost(children.size.toLong()).toInt()
      val to = (from.toLong() + pageSize).coerceAtMost(children.size.toLong()).toInt()
      children.subList(from, to)
    }

  private fun <T> read(query: (BrowseTree) -> T?): BrowseResult<T> {
    // Negare la sola radice non basta: un browser puo' chiedere id noti.
    if (!allowed) return BrowseResult.Denied
    return query(tree())?.let { BrowseResult.Found(it) } ?: BrowseResult.Missing
  }
}
