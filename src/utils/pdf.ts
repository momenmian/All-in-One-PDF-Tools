import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export type PdfValidation = {
  ok: boolean;
  message?: string;
};

export type PdfItem = {
  id: string;
  file: File;
};

export type CropEdges = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CompressionResult = {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savingsPercent: number;
};

export type PasswordRemovalProgress = {
  currentPage: number;
  totalPages: number;
};

export type PasswordRemovalResult = {
  blob: Blob;
  pageCount: number;
  outputSize: number;
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function validatePdfFile(file: File): Promise<PdfValidation> {
  const basicValidation = validatePdfShellFile(file);
  if (!basicValidation.ok) return basicValidation;

  try {
    const bytes = await file.arrayBuffer();
    await PDFDocument.load(bytes, { ignoreEncryption: false });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypted")) {
      return {
        ok: false,
        message: `${file.name} appears to be password-protected. Unlock it first, then try again.`,
      };
    }
    return {
      ok: false,
      message: `${file.name} could not be read. It may be corrupted or unsupported.`,
    };
  }
}

export function validatePdfShellFile(file: File): PdfValidation {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, message: `${file.name} is not a PDF file.` };
  }

  if (file.size === 0) {
    return { ok: false, message: `${file.name} is empty.` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      message: `${file.name} is ${formatBytes(file.size)}. The v1 limit is ${formatBytes(MAX_FILE_SIZE)} per file.`,
    };
  }

  return { ok: true };
}

export async function mergePdfs(files: File[]) {
  const output = await PDFDocument.create();

  for (const file of files) {
    const input = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
    const pages = await output.copyPages(input, input.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }

  return pdfBytesToBlob(await output.save());
}

export async function compressPdf(file: File): Promise<CompressionResult> {
  const input = await PDFDocument.load(await file.arrayBuffer(), {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  const output = await PDFDocument.create({ updateMetadata: false });
  const pages = await output.copyPages(input, input.getPageIndices());
  pages.forEach((page) => output.addPage(page));

  const compressedBytes = await output.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 100,
    updateFieldAppearances: false,
  });
  const blob = pdfBytesToBlob(compressedBytes);
  const savedBytes = Math.max(0, file.size - blob.size);

  return {
    blob,
    originalSize: file.size,
    compressedSize: blob.size,
    savedBytes,
    savingsPercent: file.size > 0 ? (savedBytes / file.size) * 100 : 0,
  };
}

export async function removePdfPassword(
  file: File,
  password: string,
  onProgress?: (progress: PasswordRemovalProgress) => void,
): Promise<PasswordRemovalResult> {
  const source = await pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password,
    useWorkerFetch: true,
  }).promise;
  const pageCount = source.numPages;
  const output = await PDFDocument.create({ updateMetadata: false });

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    onProgress?.({ currentPage: pageNumber, totalPages: pageCount });
    const sourcePage = await source.getPage(pageNumber);
    const viewport = sourcePage.getViewport({ scale: 1 });
    const renderScale = getPasswordRemovalRenderScale(viewport.width, viewport.height);
    const renderViewport = sourcePage.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Canvas rendering is unavailable in this browser.");
    }

    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await sourcePage.render({ canvasContext: context, viewport: renderViewport }).promise;
    sourcePage.cleanup();

    const imageBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
    const image = await output.embedJpg(imageBytes);
    const page = output.addPage([viewport.width, viewport.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
  }

  await source.destroy();
  const blob = pdfBytesToBlob(await output.save({ useObjectStreams: true, addDefaultPage: false }));

  return {
    blob,
    pageCount,
    outputSize: blob.size,
  };
}

export async function rotateCropPdf(
  file: File,
  selectedPages: Set<number>,
  angleByPage: Map<number, number>,
  cropByPage: Map<number, CropEdges>,
) {
  const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
  const output = await PDFDocument.create();

  for (const pageIndex of source.getPageIndices()) {
    const sourcePage = source.getPage(pageIndex);
    const { width, height } = sourcePage.getSize();
    const sourceAngle = normalizeAngle(sourcePage.getRotation().angle);
    const displaySize = getDisplaySize(width, height, sourceAngle);
    const crop = cropByPage.get(pageIndex) ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const shouldTransform = selectedPages.has(pageIndex);

    if (!shouldTransform) {
      const [copiedPage] = await output.copyPages(source, [pageIndex]);
      output.addPage(copiedPage);
      continue;
    }

    const angle = shouldTransform ? angleByPage.get(pageIndex) ?? 0 : 0;
    const left = clamp(crop.left, 0, displaySize.width - 1);
    const bottom = clamp(crop.bottom, 0, displaySize.height - 1);
    const croppedWidth = Math.max(1, displaySize.width - left - clamp(crop.right, 0, displaySize.width - left - 1));
    const croppedHeight = Math.max(1, displaySize.height - bottom - clamp(crop.top, 0, displaySize.height - bottom - 1));
    const embedded = await output.embedPage(sourcePage);
    const page = output.addPage([croppedWidth, croppedHeight]);

    const exportAngle = sourceAngle - angle;
    const radians = (exportAngle * Math.PI) / 180;
    const center = { x: width / 2, y: height / 2 };
    const displayCenter = { x: displaySize.width / 2, y: displaySize.height / 2 };

    // Rotate the display center (not the raw page center) so the translation
    // accounts for page orientation/rotation when positioning the embedded page.
    const rotatedCenter = rotatePoint(displayCenter.x, displayCenter.y, radians);

    page.drawPage(embedded, {
      x: displayCenter.x - left - rotatedCenter.x,
      y: displayCenter.y - bottom - rotatedCenter.y,
      width,
      height,
      rotate: degrees(exportAngle),
      xSkew: degrees(0),
      ySkew: degrees(0),
    });
  }

  return pdfBytesToBlob(await output.save());
}

function pdfBytesToBlob(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}

function getPasswordRemovalRenderScale(width: number, height: number) {
  const largestEdge = Math.max(width, height);
  if (largestEdge >= 1600) return 1;
  if (largestEdge >= 1100) return 1.35;
  return 1.65;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The PDF page could not be converted to an image."));
      },
      type,
      quality,
    );
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function normalizeAngle(angle: number) {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getDisplaySize(width: number, height: number, angle: number) {
  const normalizedAngle = normalizeAngle(angle);
  return normalizedAngle === 90 || normalizedAngle === 270
    ? { width: height, height: width }
    : { width, height };
}

function rotatePoint(x: number, y: number, radians: number) {
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
}
