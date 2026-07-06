const APP_VERSION = "2.2";

// TeamCloud: Server-Cap (muss zum admin-worker.js-Limit passen) + rein informative
// Kontingent-Anzeige (kein hartes Limit über die 10 MB je Datei hinaus).
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TEAMCLOUD_QUOTA_MB = 500;

// Spielerfotos werden clientseitig auf diese längste Kante (px) verkleinert, bevor sie
// über dasselbe Datei-Gateway wie TeamCloud hochgeladen werden (siehe resizeImageFile
// in app.js) — sie sind nur kleine Avatare in 36px-Chips, keine Vollbilder.
const FOTO_MAX_DIMENSION = 240;

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

// Kader-Rollen (1:1 aus der SpielerPlus-Recherche übernommen). Ein Spieler kann
// mehrere Rollen gleichzeitig haben — die daraus resultierenden Rechte sind additiv
// (Vereinigung aller ROLLEN_RECHTE der eigenen Rollen), siehe hasRecht() in app.js.
const KADER_ROLLEN = [
  { id: "admin", label: "Admin" },
  { id: "trainer", label: "Trainer" },
  { id: "co-trainer", label: "Co-Trainer" },
  { id: "tw-trainer", label: "TW-Trainer" },
  { id: "at-trainer", label: "AT-Trainer" },
  { id: "foerdertrainer", label: "Fördertrainer" },
  { id: "nachwuchsleiter", label: "Nachwuchsleiter" },
  { id: "betreuer", label: "Betreuer" },
  { id: "kassenwart", label: "Kassenwart" },
  { id: "spieler", label: "Spieler" },
  { id: "inaktiv", label: "Inaktiv" }
];

// Verwalten-Bereiche, auf die eine Rolle Zugriff geben kann. Bewusst verdichtet ggü.
// SpielerPlus' 19 Einzel-Flags (siehe CLAUDE.md) — für einen Verein mit realistisch
// 2-5 Verantwortlichen reichen diese 10 Bereiche.
const RECHTE_BEREICHE = ["termine", "aufgaben", "aufstellungen", "gruppen", "spielberichte", "kader", "kasse", "urlaubkrank", "teamcloud", "team"];

// Anzeige-Labels für die Rechte-Übersichtstabelle im Einstellungen-Tab. "team" deckt
// im Code sowohl Mannschafts-Verwaltung als auch Umfragen ab (siehe hasRecht-Aufrufe
// in app.js), daher der zusammengesetzte Label-Text.
const RECHTE_BEREICH_LABELS = {
  termine: "Termine",
  aufgaben: "Aufgaben",
  aufstellungen: "Aufstellungen",
  gruppen: "Gruppen",
  spielberichte: "Spielberichte",
  kader: "Kader (Spieler)",
  kasse: "Kasse",
  urlaubkrank: "Urlaub/Krank",
  teamcloud: "Dateien",
  team: "Mannschaften & Umfragen"
};

const ROLLEN_RECHTE = {
  admin: RECHTE_BEREICHE.slice(),
  trainer: ["termine", "aufgaben", "aufstellungen", "gruppen", "spielberichte", "urlaubkrank"],
  "co-trainer": ["termine", "aufgaben", "aufstellungen", "gruppen", "spielberichte"],
  "tw-trainer": ["aufstellungen", "gruppen"],
  "at-trainer": ["aufgaben", "gruppen"],
  foerdertrainer: [],
  nachwuchsleiter: ["kader", "team"],
  betreuer: ["urlaubkrank", "teamcloud"],
  kassenwart: ["kasse"],
  spieler: [],
  inaktiv: []
};

const APP_CHANGELOG = [
  {
    version: "2.2",
    groups: [
      {
        title: "Einstellungen",
        items: [
          "Neuer Bereich „Rollen im Kader“: alle Kadermitglieder der Mannschaft mit ihren Rollen auf einen Blick, mit Direktzugriff zum Bearbeiten.",
          "Neue Referenztabelle „Rollen-Rechte“: zeigt auf einen Blick, welchen Bereich (Termine, Kasse, Aufstellung, …) jede Rolle verwalten darf."
        ]
      }
    ]
  },
  {
    version: "2.1",
    groups: [
      {
        title: "Aufstellung",
        items: [
          "Spieler-Chips zeigen beim Überfahren mit der Maus jetzt Name, Position und Rückennummer.",
          "Spieler können jetzt ein Foto bekommen (Spieler-Formular im Kader-Tab) — es erscheint statt der Nummer in den Aufstellung-Chips und in der Kader-Liste."
        ]
      }
    ]
  },
  {
    version: "2.0",
    groups: [
      {
        title: "Rollen & Rechte",
        items: [
          "Kader-Spieler können jetzt mehrere Rollen bekommen (Trainer, Co-Trainer, Torwart-/Athletiktrainer, Betreuer, Kassenwart, Nachwuchsleiter, Fördertrainer u. a.) mit granularen Verwalten-Rechten je Bereich, statt nur Admin/Bearbeiter."
        ]
      },
      {
        title: "Termine",
        items: [
          "Neu je Termin: Aufgaben (an Spieler verteilen, abhaken), Gruppen (Trainings-Untergruppen), ein Video-Link und eine leichtgewichtige Fahrgemeinschaft (Plätze anbieten/suchen).",
          "Bei Spielen zusätzlich ein Spielbericht mit Ergebnis, Torschützen und Freitext-Bericht.",
          "Neue Aufstellung: visuelles Spielfeld, Spieler per Drag & Drop auf Positionen, Bank oder „Nicht nominiert“ ziehen."
        ]
      },
      {
        title: "Urlaub/Krank",
        items: [
          "Neuer Bereich für Zeitraum-Abwesenheiten, unabhängig von der Zu-/Absage einzelner Termine, mit Hinweis-Badge im Termin."
        ]
      },
      {
        title: "Kasse",
        items: [
          "Buchungen jetzt mit Kategorie (Beitrag/Strafe/Sonstiges) und Filter danach.",
          "Buchungen werden storniert statt gelöscht — Nachvollziehbarkeit bleibt erhalten, zählen aber nicht mehr zum Kassenstand."
        ]
      },
      {
        title: "Dateien",
        items: [
          "Neuer Tab „Dateien“ (TeamCloud): Dokumente und Bilder je Mannschaft hoch- und herunterladen."
        ]
      }
    ]
  },
  {
    version: "1.4",
    groups: [
      {
        title: "Termine",
        items: [
          "Neue Termine können jetzt wöchentlich wiederholt angelegt werden (Checkbox „Wöchentlich wiederholen“ + Anzahl Wochen) — praktisch für feste Trainingstermine."
        ]
      },
      {
        title: "Umbenennung",
        items: [
          "Die App heißt jetzt „Kadermanager“ (bisher Spielerplus-Klon) — reine Umbenennung von Name, Adresse und interner Kennung, keine Änderung an bestehenden Daten oder Rechten."
        ]
      }
    ]
  },
  {
    version: "1.3",
    groups: [
      {
        title: "Rechte",
        items: [
          "Bearbeiten-Rechte werden jetzt über die Gruppenverwaltung der Tools-Übersicht vergeben, statt über eine feste Bearbeiter-Gruppe."
        ]
      }
    ]
  },
  {
    version: "1.2",
    groups: [
      {
        title: "Navigation",
        items: [
          "Der Tab „Einstellungen“ zeigt jetzt zusätzlich die aktuelle Versionsnummer direkt am Tab-Reiter an."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Navigation",
        items: [
          "Der Tab „Einstellungen“ ist jetzt sichtbar von den übrigen Tabs abgesetzt (rechtsbündig in der Tab-Leiste), wie in der Tools-Übersicht."
        ]
      }
    ]
  },
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
