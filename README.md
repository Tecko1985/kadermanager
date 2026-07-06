# Kadermanager

Vereinsinterne Alternative zu SpielerPlus (Teamorganisation, An-/Abmeldungen zu Terminen, Anwesenheit, Umfragen, Mannschaftskasse) — Teil der [Tools-Übersicht](https://tecko1985.github.io/ToolsUebersicht/) des 1. SC 1911 Heiligenstadt.

## Funktionen

- **Mehrere Mannschaften** mit je eigenem Kader, Terminen, Umfragen und Kasse (Auswahl oben im Kopf).
- **Termine** (Training, Spiel, Sonstiges) mit individueller **Zu-/Absage** je Spieler und Teilnahme-Bilanz auf einen Blick. Neue Termine können wöchentlich wiederholt angelegt werden (z. B. ein Training über mehrere Wochen).
- **Mischform der Rückmeldung:** Spieler mit eigenem Tools-Konto verknüpfen sich per „Das bin ich“ selbst mit ihrem Kaderplatz und melden sich dann selbst an/ab; Trainer und Betreuer können für alle anderen eintragen.
- **Anwesenheits-Statistik** je Spieler über vergangene Termine (Trainings- und Spielquote getrennt).
- **Umfragen** mit Einfach- oder Mehrfachauswahl, Ergebnis-Balken und Abstimm-Übersicht.
- **Mannschaftskasse** mit Strafenkatalog, Buchungen je Spieler, Kassenstand und offenen Beträgen.

## Rechte

Verwalten (Teams/Kader/Termine/Umfragen/Kasse anlegen und für jeden Spieler eintragen) dürfen Admins sowie Nutzer aus Gruppen, die in der Tools-Übersicht für dieses Tool als „Bearbeiten“ freigeschaltet sind (Gruppenverwaltung, unabhängig von der Sichtbarkeit). Alle übrigen eingeloggten Nutzer sehen die Mannschaften und melden sich für ihren eigenen, selbst verknüpften Kaderplatz an/ab.

## Technik

Vanilla JS (kein Build-Step). Anmeldung und Speicherung laufen über das zentrale
Login-Gateway der Tools-Übersicht (Cloudflare Worker → Nextcloud/WebDAV) — kein
separates Passwort. Gleichzeitige Änderungen von zwei Geräten werden erkannt und
gemeldet.

**Status:** Version 1.4. Hieß bis Version 1.3 „Spielerplus-Klon“.
