import { Download, FileArchive, Loader2 } from "lucide-react";
import { useState } from "react";
import { UploadZone } from "../components/UploadZone";
import { CompressionResult, compressPdf, formatBytes, validatePdfFile } from "../utils/pdf";

export function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [resultUrl, setResultUrl] = useState("");

  async function addFiles(files: File[]) {
    const nextFile = files[0];
    if (!nextFile) return;

    setError("");
    setResult(null);
    setResultUrl("");
    const validation = await validatePdfFile(nextFile);
    if (!validation.ok) {
      setError(validation.message ?? "The PDF could not be added.");
      return;
    }
    setFile(nextFile);
  }

  async function handleCompress() {
    if (!file) {
      setError("Add a PDF before compressing.");
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    setResultUrl("");
    try {
      const compressed = await compressPdf(file);
      setResult(compressed);
      setResultUrl(URL.createObjectURL(compressed.blob));
    } catch {
      setError("The PDF could not be compressed. Check for password protection or file corruption.");
    } finally {
      setBusy(false);
    }
  }

  const downloadName = file ? `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf` : "compressed.pdf";

  return (
    <section className="tool-page">
      <div className="tool-heading">
        <a href="/" className="back-link">← All tools</a>
        <p className="eyebrow">Browser tool</p>
        <h1>Compress PDF</h1>
        <p>Optimize PDF structure locally and reduce file size when the document has compressible overhead.</p>
        <span className="trust-note">Files stay in your browser and are not uploaded.</span>
      </div>

      <UploadZone label="Drop one PDF to compress" hint="Best for PDFs with extra structure, unused objects, or unoptimized streams." onFiles={addFiles} />

      {error ? <p className="error-box">{error}</p> : null}

      <section className="workspace-card">
        <div className="section-title">
          <h2>{file ? file.name : "Compression workspace"}</h2>
          <span>{file ? formatBytes(file.size) : "No file selected"}</span>
        </div>

        <div className="compress-summary">
          <FileArchive size={28} aria-hidden="true" />
          <div>
            <strong>Standard browser optimization</strong>
            <span>Rewrites the PDF with object streams and removes unused document overhead where possible.</span>
          </div>
        </div>

        {result ? (
          <div className="metric-grid" aria-label="Compression result">
            <div className="metric-box">
              <span>Original</span>
              <strong>{formatBytes(result.originalSize)}</strong>
            </div>
            <div className="metric-box">
              <span>Compressed</span>
              <strong>{formatBytes(result.compressedSize)}</strong>
            </div>
            <div className="metric-box">
              <span>Saved</span>
              <strong>{result.savedBytes > 0 ? `${formatBytes(result.savedBytes)} (${result.savingsPercent.toFixed(1)}%)` : "Already optimized"}</strong>
            </div>
          </div>
        ) : null}

        <div className="action-row">
          <button className="primary-button" type="button" disabled={!file || busy} onClick={handleCompress}>
            {busy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <FileArchive size={18} aria-hidden="true" />}
            Compress PDF
          </button>
          {resultUrl ? (
            <a className="download-button" href={resultUrl} download={downloadName}>
              <Download size={18} aria-hidden="true" />
              Download compressed PDF
            </a>
          ) : null}
        </div>
      </section>
    </section>
  );
}
