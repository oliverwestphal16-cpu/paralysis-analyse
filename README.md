# ParalysisAnalyse

Wer grübelt am längsten? ParalysisAnalyse misst beim Brettspielen die Zugzeit jedes Spielers und wertet sie am Ende aus: Treppchen nach Gesamtzeit, Verteilung über das Spiel, Punkte im Verhältnis zur Zeit und ein Tab voller Statistiken für Zahlenfans.

Die App ist eine offline-fähige Web-App (PWA) für **ein Gerät in der Tischmitte**. Alle Daten bleiben im Browser dieses Geräts; es gibt keinen Server.

## Funktionen

- **Spieler**: Profile mit Name, Meeple-Avatar (eigene Zeichnungen) oder Foto und Farbe; 2–8 Spieler pro Partie
- **Zugreihenfolge** per Drag & Drop, im Spiel jederzeit änderbar; jeder Spieler lässt sich direkt als Nächster antippen
- **Während des Spiels**: ein Tipp beendet den Zug; Pause (Regelklärung / Sonstiges), Rückgängig, Zeit umbuchen („eigentlich ist Anna schon seit 1:40 dran“), optionales weiches Zeitlimit, Gesamtzeiten standardmäßig verborgen, Bildschirm bleibt an
- **Auswertung**: Treppchen (kürzeste Gesamtzeit = Platz 1), Zeitleiste / Verlauf / Balken je Zug, Punkte pro Minute, Effizienz-Index (Punkteanteil ÷ Zeitanteil), Streudiagramm
- **Vorausdenk-Faktor** (0–1, nachträglich einstellbar): Jedem Spieler wird zusätzlich dieser Anteil der Dauer des direkt vorangehenden Zugs eines anderen Spielers angerechnet
- **Weitere Statistiken**: Spinnendiagramm (Tempo, Durchschnittszug, Konstanz, kein Grübel-Ausreißer, Punkte, Effizienz), Kennzahlentabelle, Boxplot, Anteil an der Spielzeit, das „Rennen“, die 5 längsten Züge, Pausen
- **Partieübergreifend**: Historie, Statistik je Spieler mit Filter nach Spiel, JSON-Export/-Import als Datensicherung

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
