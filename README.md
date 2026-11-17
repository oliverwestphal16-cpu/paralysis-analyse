# ParalysisAnalyse

Wer grübelt am längsten? ParalysisAnalyse misst beim Brettspielen die Zugzeit jedes Spielers und wertet sie am Ende aus: Treppchen nach Gesamtzeit, Verteilung über das Spiel, Punkte im Verhältnis zur Zeit und ein Tab voller Statistiken für Zahlenfans.

Die App ist eine offline-fähige Web-App (PWA) für **ein Gerät in der Tischmitte**. Alle Daten bleiben im Browser dieses Geräts; es gibt keinen Server.

## Funktionen

- **Spieler**: Profile mit Name, Meeple-Avatar (eigene Zeichnungen) oder Foto und Farbe; 2–8 Spieler pro Partie
- **Vorbereitung**: Nach dem Start laufen „Aufbau“ und optional „Regelerklärung“ mit eigener Uhr; danach wird der Startspieler gewählt oder ausgelost
- **Zugreihenfolge** per Drag & Drop, im Spiel jederzeit änderbar; jeder Spieler lässt sich direkt als Nächster antippen
- **Während des Spiels**: ein Tipp beendet den Zug (mit Doppeltipp-Schutz und kurzer Vibration); Pause hält sofort an, Art (Regelklärung / Essen / Sonstiges) wählbar; Rundenzähler mit ±1-Korrektur; Rückgängig, Zeit umbuchen („eigentlich ist Anna schon seit 1:40 dran“), optionales weiches Zeitlimit, Gesamtzeiten standardmäßig verborgen, Bildschirm bleibt an
- **Nach dem Spiel**: Punkte, dann optional Fotos (aufnehmen oder aus der Galerie; direkt aufgenommene lassen sich in die Galerie sichern)
- **Auswertung**: Treppchen (kürzeste Gesamtzeit = Platz 1), Titel des Abends, Zeitleiste / Verlauf / Balken je Zug mit Phasenbändern und Rundenlinien, Punkte pro Minute, Effizienz-Index (Punkteanteil ÷ Zeitanteil), Streudiagramm, Teilen-Karte als Bild
- **Phasenfilter** Insgesamt / Early (erste 25 % der Züge) / Mid (50 %) / Late (letzte 25 %); Aufbau & Regeln ein- und ausblendbar
- **Vorausdenk-Faktor** (0–1, nachträglich einstellbar): Jedem Spieler wird zusätzlich dieser Anteil der Dauer des direkt vorangehenden Zugs eines anderen Spielers angerechnet
- **Weitere Statistiken**: Spinnendiagramm (Tempo, Durchschnittszug, Konstanz, kein Grübel-Ausreißer, Punkte, Effizienz), Kennzahlentabelle, Ø Zugdauer je Phase, Phasentabelle, Boxplot, Anteil an der Spielzeit, das „Rennen“, die 5 längsten Züge, Pausen
- **Partie bewerten** (nach der Übersicht): gemeinsam oder reihum jeder einzeln, 5 Sterne in halben Schritten je Kriterium; Gesamtnote als gewichteter Schnitt (Standard: Spaß 20 %, Direkt nochmal spielen 20 %, Thema 20 %, Spannungsbogen 15 %, Spielflow 15 %, Design 10 %), dazu die Einordnung Glück ↔ Taktik ↔ Strategie und Brainy. Kriterien und Gewichte sind in den Einstellungen änderbar.
- **Partieübergreifend**: Historie, ewige Rangliste (Tempo-Index), Statistik je Spieler, Ø Aufbau-/Regel-/Spieldauer je Spiel, Filter nach Spiel, JSON-Export/-Import als Datensicherung (ohne Fotos)

## Benutzung

Die App unter `https://oliverwestphal16-cpu.github.io/paralysis-analyse/` öffnen und über das Browsermenü „Zum Startbildschirm hinzufügen“. Danach funktioniert sie auch ohne Internet.

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Unit-Tests der Rechenlogik (src/domain)
npm run build      # Produktions-Build nach dist/
```

Die Rechenlogik liegt framework-frei in `src/domain` (Zugwechsel, Pausen, Umbuchen, Statistiken) und ist vollständig getestet. Die Oberfläche (React, ECharts, Dexie/IndexedDB) liegt in `src/screens` und `src/ui`.

Wer npm über einen Registry-Spiegel betreibt: Vor dem Commit `npm run lockfile:normalize` ausführen, damit `package-lock.json` nur auf `registry.npmjs.org` verweist.

## Deployment

Jeder Push auf `main` testet, baut und veröffentlicht die App über GitHub Actions auf GitHub Pages (`.github/workflows/deploy.yml`). Einmalig im Repo einstellen: *Settings → Pages → Build and deployment → Source: GitHub Actions*.

## Authors & Responsibilities

- Flumpie16 ([@oliverwestphal16-cpu](https://github.com/oliverwestphal16-cpu)) – Idee, Anforderungen, Pflege
