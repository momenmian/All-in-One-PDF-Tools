import { ArrowRight, ShieldCheck } from "lucide-react";
import { tools } from "../data/tools";

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">All-in-one PDF toolkit</p>
          <h1>PDFForge</h1>
          <p className="hero-copy">
            Merge, rotate, crop, split, compress, convert, and polish PDFs from one fast browser app.
          </p>
        </div>
        <div className="trust-panel">
          <ShieldCheck size={28} aria-hidden="true" />
          <div>
            <strong>Browser-first privacy</strong>
            <span>Launch tools process files locally whenever technically possible.</span>
          </div>
        </div>
      </section>

      <section className="tool-grid" aria-label="PDF tools">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const content = (
            <>
              <span className="tool-icon">
                <Icon size={24} aria-hidden="true" />
              </span>
              <span className="tool-title-row">
                <strong>{tool.name}</strong>
                <span className={`status ${tool.status}`}>{tool.status === "available" ? "Ready" : "Soon"}</span>
              </span>
              <span className="tool-description">{tool.description}</span>
              <span className="tool-footer">
                {tool.privacy === "Browser" ? "In-browser" : "Server-backed later"}
                {tool.status === "available" ? <ArrowRight size={16} aria-hidden="true" /> : null}
              </span>
            </>
          );

          return tool.status === "available" ? (
            <a className="tool-card" href={tool.route} key={tool.name}>
              {content}
            </a>
          ) : (
            <div className="tool-card disabled" key={tool.name} aria-disabled="true">
              {content}
            </div>
          );
        })}
      </section>
    </>
  );
}
