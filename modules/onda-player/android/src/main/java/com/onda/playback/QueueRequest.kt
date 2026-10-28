package com.onda.playback

/**
 * La coda che una richiesta di un controller produce (`onSetMediaItems` in
 * [PlaybackService]), decisa sull'albero di Android Auto prima dei tipi
 * Media3.
 *
 * Un solo elemento senza URL e' un brano scelto in macchina: in coda vanno i
 * brani suonabili della sua cartella, a partire da lui, e la posizione di
 * partenza la lascia decidere al player. Altrimenti ogni elemento con il suo
 * URL resta com'e' e quelli senza si cercano nell'albero uno per uno.
 *
 * Senza nemmeno un brano riconosciuto la richiesta e' [Unresolved] e deve
 * fallire: una lista vuota Media3 la applicherebbe al player, cancellando la
 * coda in ascolto. Succede con una ricerca vocale, che arriva come elemento
 * senza id ne' URL, o con un id di Auto rimasto indietro rispetto all'albero.
 */
internal object QueueRequest {
  /** Un elemento richiesto: con il suo URL, oppure solo un id da cercare nell'albero. */
  data class Item(val mediaId: String, val hasUrl: Boolean)

  sealed interface Outcome

  /**
   * Gli elementi da mettere in coda, nell'ordine, e da quale partire. Con
   * [fromTree] la coda viene dalla cartella di un brano scelto in macchina e
   * la posizione di partenza spetta al player; altrimenti vale quella chiesta.
   */
  data class Resolved(val entries: List<Entry>, val startIndex: Int, val fromTree: Boolean) : Outcome

  /** Nessun brano riconosciuto: la coda in ascolto non si tocca. */
  data object Unresolved : Outcome

  sealed interface Entry {
    /** L'elemento richiesto cosi' com'era, per indice nella richiesta. */
    data class Given(val index: Int) : Entry

    /** Un brano dell'albero al posto di un elemento senza URL. */
    data class FromTree(val node: BrowseNode) : Entry
  }

  fun plan(tree: BrowseTree, items: List<Item>, startIndex: Int): Outcome {
    val picked = items.singleOrNull()
    if (picked != null && !picked.hasUrl) {
      tree.resolve(picked.mediaId)?.let { selection ->
        return Resolved(selection.tracks.map(Entry::FromTree), selection.startIndex, fromTree = true)
      }
    }
    val entries =
      items.mapIndexedNotNull { index, item ->
        if (item.hasUrl) Entry.Given(index) else lookup(tree, item.mediaId)?.let(Entry::FromTree)
      }
    if (entries.isEmpty()) return Unresolved
    val start = if (startIndex in entries.indices) startIndex else 0
    return Resolved(entries, start, fromTree = false)
  }

  /** Un elemento senza URL: la sua voce di navigazione se e' un brano, altrimenti l'uid nudo. */
  fun lookup(tree: BrowseTree, mediaId: String): BrowseNode? =
    tree.item(mediaId)?.takeIf { !it.isFolder && it.url != null } ?: tree.track(mediaId)
}
