# Aster Caffe – Restaurant, QR-Bestellung und ERP

Vollständige Next.js-Anwendung im Aster-Design mit PostgreSQL/Prisma,
QR-Tischbestellung, Zahlungsabläufen und Restaurant-Backoffice.

## Funktionen

- Öffentliche, mehrsprachige Restaurantseite im Aster-Design
- QR-Bestellung unter `/order-premium?table=TABLE_TOKEN`
- Abholung, Lieferung, Reservierungen und Events
- PayPal-Zahlung mit idempotenter Lagerbuchung
- Produkte und Preise werden live aus PostgreSQL geladen
- Adminbereich unter `/admin`
- Bestellungen, Kasse, Finanzen, Personal, Tische und Berechtigungen
- Produkte, Speisekarte, Rezepte, Lager, Lieferanten und Einkauf
- Push-Benachrichtigungen und Belegausgabe
- Preise werden bei Bestellungen immer serverseitig aus der Datenbank übernommen
- Bestellungen werden persistent gespeichert
- Als App auf Android und iOS installierbar (PWA) mit Offline-Hinweis

## Lokal starten

1. PostgreSQL-Datenbank bereitstellen.
2. `.env.example` nach `.env` kopieren und Werte setzen.
3. Abhängigkeiten installieren und Datenbank initialisieren:

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Danach:

- Webseite: `http://localhost:3000`
- Demo-Tisch: `http://localhost:3000/order-premium?table=demo-table-1`
- Verwaltung: `http://localhost:3000/admin`

## Mobile App installieren

Die Anwendung kann auf Android über den Installieren-Hinweis im Browser und auf iOS über Safari → Teilen → „Zum Home-Bildschirm“ als App installiert werden. Für die Installation im Produktivbetrieb muss die Seite per HTTPS ausgeliefert werden (localhost ist für die Entwicklung ausgenommen).

## Push-Benachrichtigungen

Für Push in der installierten App müssen VAPID-Schlüssel gesetzt sein:

```bash
npx web-push generate-vapid-keys
```

Die Werte anschließend als `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT` in der Umgebung hinterlegen. Danach die Datenbank mit `npm run db:push` aktualisieren. Im Adminbereich kann jedes Gerät Push aktivieren; neue Bestellungen und Reservierungen lösen dann Benachrichtigungen aus.

## Deployment

Auf dem Hosting die drei Umgebungsvariablen `DATABASE_URL`, `ADMIN_PASSWORD` und `ADMIN_SESSION_SECRET` setzen. Danach die Datenbank einmal mit `npm run db:push` initialisieren und mit `npm run db:seed` Beispieldaten anlegen. Build: `npm run build`, Start: `npm start`.

## Sicherheit und Betrieb

- **Rollen:** Die Berechtigungen der Rollen (Admin, Manager, Service, Küche, Backoffice) werden serverseitig in `lib/admin-api.ts` erzwungen. Rolle und Aktiv-Status kommen bei jeder Anfrage aus der Datenbank. Mitarbeiter und Rollenrechte ändern darf nur der Admin, Zahlungen (Status „Bezahlt“) nur Rollen mit Kassenrecht.
- **Rate-Limiting:** Anmeldungen werden nach 10 Fehlversuchen pro IP, 5 pro E-Mail oder 100 insgesamt innerhalb von 15 Minuten gesperrt (HTTP 429). Öffentliche Reservierungs- und Event-Formulare haben ein einfaches Limit pro Serverinstanz.
- **Audit-Log:** Tabelle `AuditLog` mit Logins (`LOGIN_OK`, `LOGIN_FAILED`), allen schreibenden Admin-Aufrufen (`API_WRITE`), verweigertem Zugriff (`ACCESS_DENIED`) und blockierten Cross-Site-Anfragen (`CSRF_BLOCKED`). Die Migration läuft beim Build (`prisma migrate deploy`).
- **CSRF:** Session-Cookie mit `SameSite=Strict`, zusätzlich werden schreibende Admin-Anfragen und der Login mit fremdem `Origin` oder `Sec-Fetch-Site: cross-site` abgelehnt.
- **Backup:** `npm run db:backup` schreibt alle Tabellen als JSON nach `backups/` (nicht im Git, enthält personenbezogene Daten). Zusätzlich beim Datenbankanbieter automatische Backups bzw. Point-in-Time-Recovery aktivieren.
- **Küchendisplay:** Unter „Küchendisplay“ im Backoffice sehen Küche und Service offene Bestellungen als Tickets (Neu, Bestätigt, In Zubereitung) mit Wartezeit und Statuswechsel. Die Ansicht aktualisiert sich alle 10 Sekunden.

Für einen größeren Produktionsbetrieb sollten zusätzlich individuelle Passwörter statt Personalnummer-Login, Zwei-Faktor-Anmeldung und eine Aufbewahrungsfrist für das Audit-Log ergänzt werden.
