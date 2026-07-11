import { Download, KeyRound, Loader2, LockKeyholeOpen, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { UploadZone } from "../components/UploadZone";
import {
  PasswordRemovalProgress,
  PasswordRemovalResult,
  formatBytes,
  removePdfPassword,
  validatePdfShellFile,
} from "../utils/pdf";

export function PasswordRemoverTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PasswordRemovalProgress | null>(null);
  const [result, setResult] = useState<PasswordRemovalResult | null>(null);
  const [resultUrl, setResultUrl] = useState("");

  async function addFiles(files: File[]) {
    const nextFile = files[0];
    if (!nextFile) return;

    setError("");
    setResult(null);
    setResultUrl("");
    setProgress(null);
    const validation = validatePdfShellFile(nextFile);
    if (!validation.ok) {
      setError(validation.message ?? "The PDF could not be added.");
      return;
    }
    setFile(nextFile);
  }

  async function handleRemovePassword() {
    if (!file) {
      setError("Add a password-protected PDF first.");
      return;
    }
    if (!password.trim()) {
      setError("Enter the PDF password before removing it.");
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    setResultUrl("");
    setProgress(null);

    try {
      const unlocked = await removePdfPassword(file, password, setProgress);
      setResult(unlocked);
      setResultUrl(URL.createObjectURL(unlocked.blob));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.toLowerCase() : "";
      if (message.includes("password")) {
        setError("That password did not unlock the PDF. Check it and try again.");
      } else {
        setError("The PDF could not be unlocked. Try another file or confirm the document is not damaged.");
      }
    } finally {
      setBusy(false);
    }
  }

  const downloadName = file ? `${file.name.replace(/\.pdf$/i, "")}-unlocked.pdf` : "unlocked.pdf";
  const progressLabel = progress ? `Page ${progress.currentPage} of ${progress.totalPages}` : "Ready";
  const progressPercent = progress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0;

  return (
    <section className="tool-page">
      <div className="tool-heading">
        <a href="/" className="back-link">← All tools</a>
        <p className="eyebrow">Browser tool</p>
        <h1>Password Remover</h1>
        <p>Open a protected PDF with its password and export a flattened, unencrypted copy from your browser.</p>
        <span className="trust-note">The password and file stay local to this browser session.</span>
      </div>

      <UploadZone label="Drop one protected PDF" hint="You must know the document password to create an unlocked copy." onFiles={addFiles} />

      {error ? <p className="error-box">{error}</p> : null}

      <section className="workspace-card">
        <div className="section-title">
          <h2>{file ? file.name : "Unlock workspace"}</h2>
          <span>{file ? formatBytes(file.size) : "No file selected"}</span>
        </div>

        <div className="unlock-layout">
          <div className="unlock-panel">
            <div className="compress-summary">
              <ShieldCheck size={28} aria-hidden="true" />
              <div>
                <strong>Flattened unlocked output</strong>
                <span>Each page is rendered and rebuilt into a new PDF without the original password protection.</span>
              </div>
            </div>

            <label className="field">
              <span>PDF password</span>
              <input
                autoComplete="current-password"
                disabled={busy}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setResult(null);
                  setResultUrl("");
                }}
              />
            </label>

            <div className="progress-track" aria-label="Password removal progress">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="muted progress-label">{busy ? progressLabel : result ? "Unlocked copy ready" : "Waiting for a PDF and password"}</p>
          </div>

          <div className="unlock-facts">
            <div>
              <KeyRound size={22} aria-hidden="true" />
              <strong>Password required</strong>
              <span>This tool removes known passwords. It does not bypass unknown document passwords.</span>
            </div>
            <div>
              <LockKeyholeOpen size={22} aria-hidden="true" />
              <strong>New unencrypted file</strong>
              <span>The downloaded PDF opens without asking for the original password.</span>
            </div>
          </div>
        </div>

        {result ? (
          <div className="metric-grid" aria-label="Unlock result">
            <div className="metric-box">
              <span>Pages</span>
              <strong>{result.pageCount}</strong>
            </div>
            <div className="metric-box">
              <span>Original</span>
              <strong>{file ? formatBytes(file.size) : "-"}</strong>
            </div>
            <div className="metric-box">
              <span>Unlocked</span>
              <strong>{formatBytes(result.outputSize)}</strong>
            </div>
          </div>
        ) : null}

        <div className="action-row">
          <button className="primary-button" type="button" disabled={!file || busy} onClick={handleRemovePassword}>
            {busy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <LockKeyholeOpen size={18} aria-hidden="true" />}
            Remove password
          </button>
          {resultUrl ? (
            <a className="download-button" href={resultUrl} download={downloadName}>
              <Download size={18} aria-hidden="true" />
              Download unlocked PDF
            </a>
          ) : null}
        </div>
      </section>
    </section>
  );
}
