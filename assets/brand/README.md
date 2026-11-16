# Spivra by Andrea Spina

La S è un nastro continuo con due solchi trasparenti: richiama un'onda sonora
e i solchi di un disco. Il segno funziona anche in un solo colore.

- `spivra-icon-master.svg` e `spivra-icon.png`: icona completa, 1024 × 1024.
- `spivra-adaptive-foreground.svg` e `.png`: primo piano trasparente per
  l'icona adattiva Android e lo splash, con margine per le maschere del launcher.
- `spivra-monochrome.svg` e `.png`: silhouette bianca trasparente per le
  icone a tema Android.
- `spivra-mark.svg` e `.png`: solo il segno, per l'intestazione dell'app.
- `spivra-lockup.svg`: segno, nome e firma per sfondi scuri.
- `spivra-lockup-mono.svg`: composizione nera trasparente per stampa,
  adesivi e merchandising. È interamente a tracciati, senza font da installare.
- `spivra-preview.png`: anteprima del marchio su fondo inchiostro.

Colori: inchiostro `#0E1116`, ambra `#FFB03A`, bianco `#ECEFF4`, firma
grigio `#8B94A7`. Conservare le proporzioni e uno spazio libero attorno al
segno pari almeno allo spessore del suo nastro esterno.

Righteous dà al nome e ai titoli di navigazione il carattere geometrico delle
copertine musicali. Manrope resta per firma, brani, azioni e testi lunghi.
Entrambi sono incorporati nell'app; le licenze OFL sono in `assets/fonts/`
e negli avvisi di terze parti. Righteous proviene dal
[repository Google Fonts](https://github.com/google/fonts/tree/main/ofl/righteous),
file originale non modificato `Righteous-Regular.ttf`, SHA-256
`2ffb3fe5c27d7e6571210b800448c4e234e651b46c6b4426c1bb567e5341348a`.

Gli SVG sono i master; i PNG sono esportati con Inkscape, a 1024 px salvo il
segno nell'app (384 px) e l'anteprima (1200 px). Tutti i tracciati hanno
vuoti reali e funzionano su fondi diversi, senza maschere o immagini incorporate.

## Compatibilità dell'aggiornamento

Il nome nel launcher è **Spivra**, la firma completa compare in Scopri,
benvenuto e Informazioni. Il package Android `com.onda.player`, lo schema
`onda://`, il modulo nativo, gli ID di archiviazione, il formato di backup
`onda.library` e la chiave personale in `.onda/` conservano la loro identità
storica. Rinominare questi elementi separatamente dal marchio potrebbe
rompere gli aggiornamenti o rendere irraggiungibili i dati esistenti.

## Diritti sul brand

Salvo diversa autorizzazione, il nome e gli asset originali di questa cartella
non sono concessi sotto MIT. Copyright © 2026 KairosIta. Tutti i diritti
riservati. Le build personali possono mantenere il brand; la licenza del
sorgente non concede il diritto di presentare una distribuzione come ufficiale.
