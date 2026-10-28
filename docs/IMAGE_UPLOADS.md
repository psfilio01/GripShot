# Bild-Uploads bis 25 MB

Produktreferenzen, externe Herobilder, Hintergründe und Modellreferenzen dürfen
jeweils bis **25 MiB (26.214.400 Bytes)** groß sein. Die Oberfläche bezeichnet
dies aus Kompatibilitätsgründen als „25 MB“. Unterstützt sind JPEG, PNG und WebP
mit höchstens **25 Millionen Pixeln**. Eine kleine komprimierte Datei kann diese
Pixelgrenze ebenfalls überschreiten.

## Originalqualität und Verarbeitung

- Uploads werden weder automatisch verkleinert noch neu komprimiert. Die
  gespeicherten Bildbytes bleiben unverändert.
- Dateisignatur und Bildabmessungen werden serverseitig geprüft. Diese Prüfung
  ist keine vollständige Dekodierung und keine inhaltliche Bildprüfung.
- Die Mainbild-Verarbeitung akzeptiert ebenfalls bis 25 MiB; ihre vorhandene
  Grenze von 25 Megapixeln bleibt bestehen. Sie dekodiert die Quelle tatsächlich
  und normalisiert wie bisher EXIF-Orientierung und Farbraum.
- Main-Ergebnisse bleiben verlustfreie PNGs in Originalauflösung. Ein Ergebnis
  kann deshalb größer als seine JPEG-Quelle sein. Die 25-MiB-Uploadgrenze gilt
  auch beim erneuten Hochladen; es gibt keine automatische verlustbehaftete
  Verkleinerung besonders großer Ergebnisse.

## Upload-Anfragen

Mehrere ausgewählte Referenzen werden nacheinander in einzelnen HTTP-Anfragen
übertragen. Der Server akzeptiert jeweils genau eine Bilddatei. Die gesamte
Multipart-Anfrage einschließlich Metadaten ist auf **26 MiB** begrenzt; auch
Anfragen ohne `Content-Length` werden beim Lesen begrenzt. So bleibt jede
Anfrage unter der [Cloud-Run-Grenze von 32 MiB für HTTP/1-Server](https://docs.cloud.google.com/run/quotas).

## Übergabe an Gemini

Kleine Bildanfragen verwenden weiterhin den bisherigen Inline-Transport.
Bei größeren Referenzen oder mehreren Bildern wird das gemeinsame
Inline-Datenbudget berücksichtigt, nicht nur die Größe jeder einzelnen Datei.
Bei Bedarf verwendet GripShot die [Gemini Files API](https://ai.google.dev/gemini-api/docs/files)
und referenziert die hochgeladenen Originalbytes statt großer Base64-Blöcke.
Die ursprüngliche Bildreihenfolge und die Generierungs-/Farbprompts bleiben
unverändert. Das ist eine Transportänderung, keine zusätzliche Bildgenerierung.

Temporäre Provider-Dateien werden nach Abschluss, Fehler oder Abbruch zur
Löschung angefragt. Bei einem Netzwerkausfall kann die Löschung scheitern; die
lokale Originaldatei wird durch diese Bereinigung niemals gelöscht. Für
benutzerdefinierte Gemini-Proxy-Adressen wird kein automatischer Upload an
einen anderen Anbieter durchgeführt: überschreitet eine solche Anfrage das
Inline-Budget, wird sie mit einer verständlichen Fehlermeldung abgewiesen.

Die Tests verwenden synthetische Bilddateien und simulierte Provider-Antworten;
sie laden keine privaten Produktbilder hoch und lösen keine bezahlte
Bildgenerierung aus.
