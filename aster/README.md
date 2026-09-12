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

Für einen öffentlichen Produktionsbetrieb sollte als nächster Schritt eine Benutzerverwaltung mit individuellen Mitarbeiterkonten/Rollen, Rate-Limiting, Audit-Log, CSRF-Konzept, Backup-Strategie und ein Bestell-/Küchendashboard ergänzt werden. Das aktuelle Admin-Passwort ist für einen kleinen MVP gedacht.
