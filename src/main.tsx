import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

function MissingSourceNotice() {
  return (
    <main className="notice-shell">
      <section className="notice-card" aria-labelledby="notice-title">
        <span className="notice-kicker">Deployment notice</span>
        <h1 id="notice-title">Application source is missing</h1>
        <p>
          This repository is missing its <code>src/</code> application files. The
          deployment can start, but there is no app interface to render yet.
        </p>
        <p className="notice-detail">
          Restore the intended application source to this repository to publish
          the full experience.
        </p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MissingSourceNotice />
  </React.StrictMode>,
);
