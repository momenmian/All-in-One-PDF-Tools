import { FileText } from "lucide-react";
import { CompressTool } from "./pages/CompressTool";
import { HomePage } from "./pages/HomePage";
import { MergeTool } from "./pages/MergeTool";
import { RotateCropTool } from "./pages/RotateCropTool";

export function App() {
  const path = window.location.pathname;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="PDFForge home">
          <span className="brand-mark">
            <FileText size={22} aria-hidden="true" />
          </span>
          <span>PDFForge</span>
        </a>
        <span className="privacy-chip">Local-first PDF tools</span>
      </header>
      <main>
        {path === "/merge" ? (
          <MergeTool />
        ) : path === "/rotate-crop" ? (
          <RotateCropTool />
        ) : path === "/compress" ? (
          <CompressTool />
        ) : (
          <HomePage />
        )}
      </main>
    </div>
  );
}
