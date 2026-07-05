const APP_VERSION = "1.0";

// Gruppen-Id (Tools-Übersicht-Benutzerverwaltung) für Nutzer ohne Admin-Status,
// die als Trainer/Betreuer/Kassenwart verwalten dürfen (Teams, Kader, Termine,
// Umfragen, Kasse — und Teilnahme/Stimmen für JEDEN Spieler setzen). Mitgliederpflege
// dort, nicht hier.
const EDITOR_GROUP_ID = "spielerplus-bearbeiter";

// Termin-Typen — Reihenfolge bestimmt die Auswahl-Reihenfolge im Formular.
const TERMIN_TYPEN = [
  { id: "training", label: "Training", icon: "🏃", farbe: "#1a56a0" },
  { id: "spiel", label: "Spiel", icon: "⚽", farbe: "#2d8c4e" },
  { id: "sonstiges", label: "Sonstiges", icon: "📅", farbe: "#6b7280" }
];

// Teilnahme-Status je Spieler/Termin. Reihenfolge = Reihenfolge der Zusage-Buttons.
// Fehlt ein Eintrag komplett, gilt der Spieler als "offen" (hat noch nicht reagiert).
const TEILNAHME_STATUS = [
  { id: "zu", label: "Zusage", kurz: "✓", farbe: "#2d8c4e" },
  { id: "unsicher", label: "Unsicher", kurz: "?", farbe: "#c9941f" },
  { id: "ab", label: "Absage", kurz: "✗", farbe: "#c0392b" }
];

// Startbestand des Strafenkatalogs für ein NEU angelegtes Team (keine Personendaten,
// nur Vorschlagswerte in Euro — jederzeit im Kasse-Tab änderbar).
const DEFAULT_STRAFEN = [
  { bezeichnung: "Zu spät zum Training", betrag: 2 },
  { bezeichnung: "Unentschuldigtes Fehlen", betrag: 5 },
  { bezeichnung: "Handy in der Kabine", betrag: 1 },
  { bezeichnung: "Gelb-Rote / Rote Karte (Unsportlichkeit)", betrag: 10 }
];

const APP_CHANGELOG = [
  {
    version: "1.0",
    groups: [
      {
        title: "Termine & Zu-/Absagen",
        items: [
          "Vereinsinterne Alternative zu SpielerPlus: mehrere Mannschaften mit je eigenem Kader und eigenen Terminen (Training, Spiel, Sonstiges).",
          "Zu jedem Termin sagen die Spieler zu, ab oder „unsicher“ — mit Bilanz auf einen Blick, wer kommt.",
          "Spieler mit eigenem Tools-Konto verknüpfen sich per „Das bin ich“ selbst mit ihrem Kaderplatz und melden sich dann selbst an/ab; Trainer und Betreuer können für alle anderen eintragen."
        ]
      },
      {
        title: "Anwesenheit, Umfragen & Kasse",
        items: [
          "Anwesenheits-Statistik je Spieler über die vergangenen Termine (Trainings- und Spielquote getrennt).",
          "Umfragen im Team (Einfach- oder Mehrfachauswahl) mit Ergebnis-Balken und Übersicht, wer noch nicht abgestimmt hat.",
          "Mannschaftskasse mit Strafenkatalog, Buchungen je Spieler, Kassenstand und offenen Beträgen."
        ]
      },
      {
        title: "Rechte & Speicherung",
        items: [
          "Verwalten dürfen nur Admin und die Gruppe „Spielerplus Bearbeiter“ (Trainer/Betreuer/Kassenwart); alle übrigen eingeloggten Nutzer sehen die Teams und melden sich für ihren eigenen Kaderplatz an/ab.",
          "Automatische Nextcloud-Synchronisierung über die zentrale Anmeldung (Tools-Übersicht) — kein separates Passwort nötig; gleichzeitige Änderungen von zwei Geräten werden erkannt und gemeldet."
        ]
      }
    ]
  }
];
