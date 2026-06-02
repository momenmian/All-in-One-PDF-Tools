import { Download, Grid3X3, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { UploadZone } from "../components/UploadZone";
import { CropEdges, formatBytes, rotateCropPdf, validatePdfFile } from "../utils/pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfPageInfo = {
  width: number;
  height: number;
};

type CropDragMode = "move" | "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-right" | "bottom-left";

const emptyCrop: CropEdges = { top: 0, right: 0, bottom: 0, left: 0 };

export function RotateCropTool() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [pageInfo, setPageInfo] = useState<PdfPageInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([0]));
  const [angleByPage, setAngleByPage] = useState<Map<number, number>>(new Map([[0, 0]]));
  const [cropByPage, setCropByPage] = useState<Map<number, CropEdges>>(new Map([[0, emptyCrop]]));
  const [showGrid, setShowGrid] = useState(true);
  const [showOutputPreview, setShowOutputPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; startCrop: CropEdges } | null>(null);

  const currentAngle = angleByPage.get(currentPage) ?? 0;
  const currentCrop = cropByPage.get(currentPage) ?? emptyCrop;
  const cropInset = pageInfo
    ? `${(currentCrop.top / pageInfo.height) * 100}% ${(currentCrop.right / pageInfo.width) * 100}% ${(currentCrop.bottom / pageInfo.height) * 100}% ${(currentCrop.left / pageInfo.width) * 100}%`
    : "0";
  const cropStyle = useMemo(() => {
    return {
      inset: cropInset,
    };
  }, [cropInset]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    async function render() {
      try {
        const bytes = await file!.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        const page = await doc.getPage(currentPage + 1);
        const viewport = page.getViewport({ scale: 1 });
        setPageInfo({ width: viewport.width, height: viewport.height });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch {
        setError("This PDF could not be previewed. It may be corrupted or password-protected.");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [file, currentPage]);

  async function addFiles(files: File[]) {
    const nextFile = files[0];
    if (!nextFile) return;
    setError("");
    setResultUrl("");
    setShowOutputPreview(false);
    const validation = await validatePdfFile(nextFile);
    if (!validation.ok) {
      setError(validation.message ?? "The PDF could not be added.");
      return;
    }
    setFile(nextFile);
    setCurrentPage(0);
    setSelectedPages(new Set([0]));
    setAngleByPage(new Map([[0, 0]]));
    setCropByPage(new Map([[0, emptyCrop]]));
  }

  function setAngleForScope(angle: number) {
    setResultUrl("");
    setShowOutputPreview(false);
    setAngleByPage((current) => {
      const next = new Map(current);
      getActivePageScope().forEach((page) => next.set(page, angle));
      return next;
    });
  }

  function setCropForScope(crop: CropEdges) {
    setResultUrl("");
    setShowOutputPreview(false);
    setCropByPage((current) => {
      const next = new Map(current);
      const nextCrop = pageInfo ? constrainCrop(crop, pageInfo) : crop;
      getActivePageScope().forEach((page) => next.set(page, nextCrop));
      return next;
    });
  }

  function getActivePageScope() {
    return selectedPages.has(currentPage) ? selectedPages : new Set([currentPage]);
  }

  function selectScope(scope: "current" | "all") {
    if (scope === "all") {
      setSelectedPages(new Set(Array.from({ length: pageCount }, (_, index) => index)));
      return;
    }
    setSelectedPages(new Set([currentPage]));
  }

  function togglePage(page: number) {
    setSelectedPages((current) => {
      const next = new Set(current);
      if (next.has(page) && next.size > 1) next.delete(page);
      else next.add(page);
      return next;
    });
  }

  async function processPdf() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResultUrl("");
    try {
      const pagesToTransform = new Set([
        ...selectedPages,
        ...Array.from(angleByPage.entries())
          .filter(([, angle]) => angle !== 0)
          .map(([page]) => page),
        ...Array.from(cropByPage.entries())
          .filter(([, crop]) => crop.top !== 0 || crop.right !== 0 || crop.bottom !== 0 || crop.left !== 0)
          .map(([page]) => page),
      ]);
      const blob = await rotateCropPdf(file, pagesToTransform, angleByPage, cropByPage);
      setResultUrl(URL.createObjectURL(blob));
      setShowOutputPreview(true);
    } catch {
      setError("The PDF could not be rotated or cropped. Try a different PDF or smaller crop values.");
    } finally {
      setBusy(false);
    }
  }

  function onCropDrag(event: React.PointerEvent<HTMLElement>, mode: CropDragMode) {
    if (!pageInfo || !cropRef.current) return;
    const rect = cropRef.current.parentElement?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    dragState.current = { startX: event.clientX, startY: event.clientY, startCrop: currentCrop };
    event.currentTarget.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      if (!dragState.current) return;
      const dx = ((moveEvent.clientX - dragState.current.startX) / rect.width) * pageInfo.width;
      const dy = ((moveEvent.clientY - dragState.current.startY) / rect.height) * pageInfo.height;
      setCropForScope(getNextCrop(dragState.current.startCrop, mode, dx, dy));
    };

    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <section className="tool-page">
      <div className="tool-heading">
        <a href="/" className="back-link">← All tools</a>
        <p className="eyebrow">Visual page adjustment</p>
        <h1>Rotate & Crop</h1>
        <p>Rotate a specific page by any degree, crop edges, and use guides to understand alignment.</p>
        <span className="trust-note">Preview and output are handled locally in your browser.</span>
      </div>

      <UploadZone label="Drop one PDF to adjust" hint="Use arbitrary angles like 1, 45, 56, -12.5, or 360 degrees." onFiles={addFiles} />

      {error ? <p className="error-box">{error}</p> : null}

      {file ? (
        <section className="editor-layout">
          <aside className="workspace-card controls-panel">
            <div className="section-title">
              <h2>{file.name}</h2>
              <span>{formatBytes(file.size)}</span>
            </div>

            <label className="field">
              <span>Current page</span>
              <select value={currentPage} onChange={(event) => setCurrentPage(Number(event.target.value))}>
                {Array.from({ length: pageCount }, (_, index) => (
                  <option value={index} key={index}>Page {index + 1}</option>
                ))}
              </select>
            </label>

            <div className="page-pills" aria-label="Selected pages">
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  className={selectedPages.has(index) ? "page-pill active" : "page-pill"}
                  type="button"
                  key={index}
                  onClick={() => togglePage(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="segmented">
              <button type="button" onClick={() => selectScope("current")}>Current</button>
              <button type="button" onClick={() => selectScope("all")}>All pages</button>
            </div>

            <label className="field">
              <span>Rotation angle</span>
              <input
                type="number"
                step="0.1"
                value={currentAngle}
                onChange={(event) => setAngleForScope(Number(event.target.value))}
              />
            </label>

            <div className="quick-row">
              {[1, 45, 56, 90, 180, 270].map((angle) => (
                <button type="button" key={angle} onClick={() => setAngleForScope(angle)}>
                  {angle}°
                </button>
              ))}
            </div>

            <div className="crop-fields">
              {(["top", "right", "bottom", "left"] as const).map((edge) => (
                <label className="field compact" key={edge}>
                  <span>{edge}</span>
                  <input
                    type="number"
                    min="0"
                    value={Math.round(currentCrop[edge])}
                    onChange={(event) => setCropForScope({ ...currentCrop, [edge]: Number(event.target.value) })}
                  />
                </label>
              ))}
            </div>

            <div className="action-row vertical">
              <button className="secondary-button" type="button" onClick={() => setCropForScope(emptyCrop)}>
                <RotateCcw size={18} aria-hidden="true" />
                Reset crop
              </button>
              <button className="secondary-button" type="button" onClick={() => setShowGrid((value) => !value)}>
                <Grid3X3 size={18} aria-hidden="true" />
                {showGrid ? "Hide grid" : "Show grid"}
              </button>
              <button className="primary-button" type="button" disabled={busy} onClick={processPdf}>
                {busy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RotateCw size={18} aria-hidden="true" />}
                Apply locally
              </button>
              {resultUrl ? (
                <a className="download-button" href={resultUrl} download="rotated-cropped.pdf">
                  <Download size={18} aria-hidden="true" />
                  Download PDF
                </a>
              ) : null}
            </div>
          </aside>

          <div className="preview-panel">
            <div className="preview-toolbar">
              <span>Page {currentPage + 1}</span>
              <strong>{showOutputPreview ? "Cropped preview" : `${currentAngle}°`}</strong>
            </div>
            <div className={`preview-stage ${showGrid ? "with-grid" : ""}`}>
              <div
                className={`page-frame ${showOutputPreview ? "is-output-preview" : ""}`}
                style={showOutputPreview ? { clipPath: `inset(${cropInset})` } : undefined}
              >
                <div className="page-preview" style={{ transform: `rotate(${currentAngle}deg)` }}>
                  <canvas ref={canvasRef} />
                </div>
                {showGrid ? <span className="page-alignment-grid" aria-hidden="true" /> : null}
                <span className="guide vertical-guide" />
                <span className="guide horizontal-guide" />
                <span className="guide center-dot" />
                {!showOutputPreview ? <span className="crop-shade" style={cropStyle} aria-hidden="true" /> : null}
                <div ref={cropRef} className="crop-box" style={showOutputPreview ? { inset: 0 } : cropStyle} onPointerDown={(event) => onCropDrag(event, "move")}>
                  <span>Drag crop area</span>
                  {!showOutputPreview ? (
                    <>
                      <button className="crop-handle top" type="button" aria-label="Crop from top" onPointerDown={(event) => onCropDrag(event, "top")} />
                      <button className="crop-handle right" type="button" aria-label="Crop from right" onPointerDown={(event) => onCropDrag(event, "right")} />
                      <button className="crop-handle bottom" type="button" aria-label="Crop from bottom" onPointerDown={(event) => onCropDrag(event, "bottom")} />
                      <button className="crop-handle left" type="button" aria-label="Crop from left" onPointerDown={(event) => onCropDrag(event, "left")} />
                      <button className="crop-handle corner top-left" type="button" aria-label="Crop from top left" onPointerDown={(event) => onCropDrag(event, "top-left")} />
                      <button className="crop-handle corner top-right" type="button" aria-label="Crop from top right" onPointerDown={(event) => onCropDrag(event, "top-right")} />
                      <button className="crop-handle corner bottom-right" type="button" aria-label="Crop from bottom right" onPointerDown={(event) => onCropDrag(event, "bottom-right")} />
                      <button className="crop-handle corner bottom-left" type="button" aria-label="Crop from bottom left" onPointerDown={(event) => onCropDrag(event, "bottom-left")} />
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function getNextCrop(startCrop: CropEdges, mode: CropDragMode, dx: number, dy: number): CropEdges {
  const next = { ...startCrop };

  if (mode === "move") {
    next.top += dy;
    next.right -= dx;
    next.bottom -= dy;
    next.left += dx;
  }
  if (mode.includes("top")) next.top += dy;
  if (mode.includes("right")) next.right -= dx;
  if (mode.includes("bottom")) next.bottom -= dy;
  if (mode.includes("left")) next.left += dx;

  return next;
}

function constrainCrop(crop: CropEdges, pageInfo: PdfPageInfo): CropEdges {
  const minSize = Math.min(pageInfo.width, pageInfo.height) * 0.04;
  const left = clampNumber(crop.left, 0, pageInfo.width - minSize);
  const right = clampNumber(crop.right, 0, pageInfo.width - left - minSize);
  const top = clampNumber(crop.top, 0, pageInfo.height - minSize);
  const bottom = clampNumber(crop.bottom, 0, pageInfo.height - top - minSize);

  return { top, right, bottom, left };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
