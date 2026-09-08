import Link from "next/link";

const SECTIONS = [
  {
    title: "Your repayment should keep counting.",
    body: "When you move between networks, a good repayment history can be left behind. Credit Passport turns a verified repayment into a record you can carry with you.",
  },
  {
    title: "You keep control of the record.",
    body: "Your Credit Passport belongs to the wallet that earned it. It is not a profile held by a credit bureau or controlled by an app administrator.",
  },
  {
    title: "The demo is simple on purpose.",
    body: "Get test funds, open a small loan, repay it, and verify it. You can explore the whole path without real money or a credit application.",
  },
  {
    title: "Verification replaces manual approval.",
    body: "The record changes only after the repayment has been checked. No one at Credit Passport manually decides whether you deserve the update.",
  },
  {
    title: "The same idea works for agents.",
    body: "A client can pay an agent for a job, confirm delivery, and let the agent carry a portable history of paid work.",
  },
];

export default function DossierPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-nav-brand">
          Credit Passport
        </Link>
        <nav className="landing-nav-links" aria-label="Primary">
          <Link href="/agent">Agent Passport</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/app">Try the credit demo</Link>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-section landing-problem">
          <p className="section-kicker">Dossier</p>
          <h1 className="landing-headline">A credit record that can move with you.</h1>
          <p>
            Credit Passport helps people and agents turn completed, paid activity into a record
            they can keep using across networks.
          </p>
          <p className="landing-links"><Link href="/app">Try the credit demo</Link><Link href="/agent">Open Agent Passport</Link></p>
        </section>

        {SECTIONS.map((section) => (
          <section className="landing-section" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <p>Credit Passport</p>
          <p className="landing-footer-meta"><Link href="/docs">Technical documentation</Link></p>
        </div>
      </footer>
    </div>
  );
}
