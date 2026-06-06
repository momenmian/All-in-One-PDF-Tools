import { Download, FileArchive, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { UploadZone } from "../components/UploadZone";
import {
  COMPRESSION_PRESETS,
  CompressionPreset,
  CompressionResult,
  MAX_FILE_SIZE,
  compressPdf,
  formatBytes,
  validatePdfFile,
} from "../utils/pdf";

export function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [preset, setPreset] = useState<CompressionPreset>("recommended");
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(0.75);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

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

  function selectPreset(nextPreset: CompressionPreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const presetDefaults = COMPRESSION_PRESETS.find((item) => item.id === nextPreset);
      if (presetDefaults) {
        setDpi(presetDefaults.dpi);
        setQuality(presetDefaults.quality);
      }
    }
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
      const compressed = await compressPdf(file, {
        preset,
        dpi,
        quality,
      });
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

      <UploadZone
        label="Drop one PDF to compress"
        hint="Best for PDFs with extra structure, unused objects, or unoptimized streams."
        note={`You can't upload more than ${formatBytes(MAX_FILE_SIZE)} per file.`}
        onFiles={addFiles}
      />

      {error ? <p className="error-box">{error}</p> : null}

      <section className="workspace-card">
        <div className="section-title">
          <h2>{file ? file.name : "Compression workspace"}</h2>
          <span>{file ? formatBytes(file.size) : "No file selected"}</span>
        </div>

        <div className="compress-summary">
          <FileArchive size={28} aria-hidden="true" />
          <div>
            <strong>{preset === "structure" ? "Structure-only rewrite" : "Image compression"}</strong>
            <span>
              {preset === "structure"
                ? "Rewrites the PDF with object streams and removes unused document overhead."
                : "Renders pages with the selected DPI and recompresses them as JPEG images."}
            </span>
          </div>
        </div>

        <section className="compression-panel">
          <div className="section-title">
            <h2>Compression level</h2>
            <span>{COMPRESSION_PRESETS.find((item) => item.id === preset)?.label}</span>
          </div>

          <div className="preset-grid" role="radiogroup" aria-label="Compression level">
            {COMPRESSION_PRESETS.map((item) => (
              <button
                key={item.id}
                className={preset === item.id ? "preset-card active" : "preset-card"}
                type="button"
                aria-pressed={preset === item.id}
                onClick={() => selectPreset(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="compression-panel">
          <div className="section-title">
            <h2>Advanced image settings</h2>
            <span>{preset === "custom" ? "Editable" : "Prefilled from the preset"}</span>
          </div>
          <p className="muted">
            DPI controls how much images are downsampled. Quality controls how hard JPEG recompression is applied. You can adjust either one or both.
          </p>
          <div className="crop-fields">
            <label className="field compact">
              <span>Image DPI</span>
              <input
                type="number"
                min="72"
                max="600"
                step="1"
                value={dpi}
                disabled={preset !== "custom"}
                onChange={(event) => {
                  setPreset("custom");
                  setDpi(Number(event.target.value));
                }}
              />
            </label>
            <label className="field compact">
              <span>Image quality</span>
              <input
                type="number"
                min="0.1"
                max="1"
                step="0.05"
                value={quality}
                disabled={preset !== "custom"}
                onChange={(event) => {
                  setPreset("custom");
                  setQuality(Number(event.target.value));
                }}
              />
            </label>
          </div>
          {preset !== "custom" ? <p className="setting-note">Choose Custom to edit DPI and quality separately.</p> : null}
        </section>

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
            <div className="metric-box">
              <span>Mode</span>
              <strong>{COMPRESSION_PRESETS.find((item) => item.id === result.preset)?.label ?? "Custom"}</strong>
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
