export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card" aria-labelledby="offline-title">
        <span className="offline-mark" aria-hidden="true">Z</span>
        <p className="offline-kicker">Aster Caffe</p>
        <h1 id="offline-title">Du bist gerade offline</h1>
        <p>
          Bitte prüfe deine Internetverbindung und versuche es anschließend erneut.
        </p>
        <a className="btn" href="/">Erneut versuchen</a>
      </section>
    </main>
  );
}
