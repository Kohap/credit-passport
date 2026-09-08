export default function AppLoading() {
  return (
    <main className="app-loading" aria-busy="true">
      <div className="app-loading-content" role="status" aria-live="polite">
        <div className="app-loading-mark" aria-hidden="true">
          <span>C</span>
          <span>P</span>
        </div>
        <p>Loading Credit Passport</p>
      </div>
    </main>
  );
}
