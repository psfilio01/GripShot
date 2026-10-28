# Farbregeln und weiße Mainbilder

## Bedienung

1. Produkt öffnen, **Farbregeln für Hero** speichern. Für einen einfarbigen Ball die Option aktivieren, dass alle sichtbaren Bestandteile der Zielfarbe folgen.
2. Ergänzender Beispielhinweis: „Ballkörper, Ventileinsatz und Ventilrand haben dieselbe jeweilige Zielfarbe. Kein schwarzer Kunststoffeinsatz. Öffnung, Tiefe, Logo, Nähte und Oberflächenstruktur beibehalten; natürliche Schatten in der Öffnung erhalten.“
3. Bei Bedarf pro Farbe eine Ausnahme in den Farbnotizen ergänzen. Diese gelten für die betreffende Variante. Allgemeine Bildanweisungen werden in der vorhandenen Szenenanalyse auf relevante Material-/Farbfakten beschränkt; Licht- oder Hintergrundänderungen gehören nicht in den Recolor-Schritt.
4. Hero wählen oder hochladen und Farben generieren. Jede Variante verwendet denselben Hero. Mit Korrekturregeln wird auch die erkannte Originalfarbe verarbeitet, damit z. B. ein weißer Ball mit falschem schwarzem Ventil korrigiert werden kann. Die normale Gemini-Abrechnung bleibt bestehen.
5. Das passende Ergebnis wählen und **Mainbild · Hintergrund weiß** anklicken. Optional den natürlichen Kontaktschatten übernehmen. Die Verarbeitung benötigt keine generativen API-Tokens oder Bild-Credits.
6. Im Main-Filter Original/Ergebnis in voller Auflösung vergleichen, insbesondere Ventil, Logo, Kontur und Schatten. Nach Sichtprüfung als geprüft markieren. Eine fehlerhafte Main-Kopie kann separat gelöscht werden; sie überschreibt nie das Original und wird beim Löschen ihres Hero-Ursprungs nicht mitgelöscht.

Eine Änderung von Produkt-Referenzbildern ersetzt kein bereits ausgewähltes Hero. Für einen anderen Bildaufbau muss ein neues Hero gewählt werden. Generative Farbbearbeitung bleibt probabilistisch; eindeutige Regeln verbessern die Vorgaben, garantieren aber nicht pixelgleiche Bildgeometrie.

## Was die lokale Aufbereitung prüft

- Fest gepinntes BiRefNet-lite-Modell, lokales ONNX CPU-Inferencing. Kein Foto wird dafür an einen Freistell-API-Anbieter übertragen.
- Unterstützter Ausgangspunkt: ein einzelnes, vollständig sichtbares, opakes Produkt auf hellem, ruhigem Studiohintergrund. Transparente Produkte, durchscheinende Materialien, komplexe Szenen und unsichere Masken sind nicht zuverlässig unterstützt.
- Produktmaske plus schmaler weicher Rand; gemessener Kontaktschatten wird separat auf Weiß übertragen. Es wird kein neues Produkt oder künstlicher Schlagschatten generiert.
- Außerhalb von Produkt-, Rand- und Schattenmaske exakt RGB 255/255/255. Schattenpixel sind absichtlich nicht weiß. Natürliche Schattierung auf dem Produkt wird nicht aufgehellt.
- Unveränderte Pixel im sicher erkannten Produktinneren; Kantenpixel werden beim Freistellen gegen den neuen Hintergrund verrechnet. JPEG-Artefakte oder ursprüngliche Produktfehler werden nicht retuschiert.
- Verlustfreie RGB-PNG-Ausgabe und erneutes Dekodieren der PNG zur Integritätsprüfung. ICC-Quellen werden vorab nach sRGB konvertiert, EXIF-Orientierung normalisiert.
- Die Prüfung beweist nicht, dass die semantische Produktmaske richtig ist. Daher ist jedes Ergebnis zunächst eine Vorschau mit ausdrücklicher menschlicher Freigabe. Keine automatische, kostenpflichtige Wiederholungsschleife.
- Cache-Schlüssel enthalten Quelldatei, Worker-Version/Inhalt, Modell und Schattenoption. Cache-Treffer werden auf Integrität geprüft; die Bilder werden nicht erneut generiert. Maximal acht Ausgabe-Caches pro Instanz.

## Lokal starten

Node 22, pnpm und Python 3.11–3.13 werden benötigt. Einmalig im Repository:

```bash
pnpm install --frozen-lockfile
pnpm setup:main-image
pnpm build:core
pnpm dev
```

Wenn mehrere Python-Versionen installiert sind:

```bash
MAIN_IMAGE_SETUP_PYTHON=/absoluter/pfad/zu/python3.12 pnpm setup:main-image
```

Das Setup erstellt `vendor/main-image/.venv`, installiert gepinnte CPU-Bibliotheken, lädt das Modell mit SHA256-Prüfung und führt einen echten ONNX-Inferenz-Selbsttest aus. Es ist keine `sharp`-Installation für dieses Feature erforderlich. Bereits installierte Modelle werden wiederverwendet. Das Setup benötigt Internet; die anschließende Main-Aufbereitung nicht.

Die App findet Worker und lokale Umgebung automatisch. Für abweichende Installationen: `MAIN_IMAGE_PYTHON`, `MAIN_IMAGE_WORKER_PATH`, `MAIN_IMAGE_MODEL_PATH` setzen. Bilddaten/Metadaten verwenden unverändert die vorhandene `WORKFLOW_DATA_ROOT`- bzw. GCS-Konfiguration.

## Tests

```bash
pnpm -C packages/workflow-core exec vitest run
pnpm test:web
vendor/main-image/.venv/bin/python -m unittest discover -s scripts/main-image -p 'test_*.py'
vendor/main-image/.venv/bin/python scripts/main-image/worker.py --self-test --model vendor/main-image/birefnet.onnx
```

`packages/web/e2e/main-image.spec.ts` prüft mit bestehendem E2E-Testkonto die Dialoge, explizite Freigabe und Löschung. Die Bildaktionen sind simuliert: keine produktiven Datenänderungen und keine Gemini-Kosten. Worker-Kompositionstests verwenden synthetische Bilder; private Produktfotos sind nicht im Repository.

## Deployment und Betrieb

Der Docker-Build enthält einen separaten Python-Worker samt Modell und testet echte Linux-CPU-Inferenz. Bibliotheken werden nicht in den Next-Bundle gezogen. Modell-Download findet ausschließlich beim Build statt.

Die lokale reale Inferenz benötigt im Test rund 7 GB Spitzen-RAM. Das Deployment verwendet deshalb 16 GiB RAM / 4 vCPU mit Reserve für Node und große Fotos, maximal eine Instanz und maximal einen gleichzeitigen Main-Worker. HTTP-Anfragen können parallel bearbeitet werden. Der Cloud-Build benötigt ebenfalls genügend RAM; `scripts/cloudbuild-web.yaml` verwendet dafür einen 32-GB-Build-Worker. Die gespeicherte Modell-Datei ist nur ungefähr 213 MB groß, was nicht dem RAM-Bedarf während der Berechnung entspricht.

Main-Jobs werden pro Instanz seriell verarbeitet (maximal acht wartende Aufträge). Läufe sind abbrechbar; ein beendeter oder gelöschter Quelllauf darf kein verspätetes Ergebnis veröffentlichen. Prozess-Timeout acht Minuten, maximale Warteschlangenzeit 90 Sekunden. Cloud-Run-Request-Timeout mindestens 600 Sekunden. Für `after()`-Arbeit muss CPU auch nach der HTTP-Antwort verfügbar sein; das Deployment aktiviert deshalb instanzbasierte CPU-Zuteilung. Sie verursacht Cloud-Rechenkosten auch während der Lebensdauer einer noch nicht heruntergefahrenen Instanz. Mindestinstanzen bleiben null.

Wichtig: Die bestehende Job-/Bild-Metadatenverwaltung ist eine lokale JSON-Datei. Dieses Feature migriert sie nicht nach Firestore. Cloud-Run-Dateien sind ohne gesonderte persistente Speicheranbindung flüchtig und nicht für geteilten Mehrinstanzbetrieb geeignet; lokal bleibt das konfigurierte Datenverzeichnis erhalten. GCS-Blob-Speicherung alleine macht die JSON-Metadaten nicht persistent. Vor dauerhaftem produktivem Cloud-Einsatz ist eine gesonderte Speichermigration erforderlich.

Modell und Lizenzquellen: [BiRefNet (MIT)](https://github.com/ZhengPeng7/BiRefNet), [rembg-Modellverteilung](https://github.com/danielgatis/rembg). Genaues Gewicht/Hash und Implementierungsdetails stehen in `scripts/main-image/README.md` und `worker.py`.
