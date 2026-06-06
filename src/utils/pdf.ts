import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

export const MAX_FILE_SIZE = 50 * 1024 * 1024;
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
  preset: CompressionPreset;
  dpi: number;
  quality: number;
};

export type CompressionPreset = "structure" | "recommended" | "highQuality" | "extreme" | "custom";

export type CompressionSettings = {
  preset: CompressionPreset;
  dpi: number;
  quality: number;
};

export type CompressionPresetDefinition = {
  id: CompressionPreset;
  label: string;
  description: string;
  dpi: number;
  quality: number;
  rasterize: boolean;
};

export const COMPRESSION_PRESETS: CompressionPresetDefinition[] = [
  {
    id: "structure",
    label: "Structure only",
    description: "Rewrite the PDF without downsampling images.",
    dpi: 72,
    quality: 1,
    rasterize: false,
  },
  {
    id: "recommended",
    label: "Recommended",
    description: "Balanced file size and visual quality.",
    dpi: 150,
    quality: 0.75,
    rasterize: true,
  },
  {
    id: "highQuality",
    label: "High quality",
    description: "Sharper output with lighter compression.",
    dpi: 300,
    quality: 0.9,
    rasterize: true,
  },
  {
    id: "extreme",
    label: "Extreme compression",
    description: "Smallest file, with more visible quality loss.",
    dpi: 72,
    quality: 0.5,
    rasterize: true,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Set your own DPI and image quality.",
    dpi: 150,
    quality: 0.75,
    rasterize: true,
  },
];

const DEFAULT_COMPRESSION_SETTINGS: CompressionSettings = {
  preset: "recommended",
  dpi: 150,
  quality: 0.75,
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function validatePdfFile(file: File): Promise<PdfValidation> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, message: `${file.name} is not a PDF file.` };
  }

  if (file.size === 0) {
    return { ok: false, message: `${file.name} is empty.` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      message: `${file.name} is ${formatBytes(file.size)}. You can't upload more than ${formatBytes(MAX_FILE_SIZE)} per file.`,
    };
  }

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

export async function mergePdfs(files: File[]) {
  const output = await PDFDocument.create();

  for (const file of files) {
    const input = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
    const pages = await output.copyPages(input, input.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }

  return pdfBytesToBlob(await output.save());
}

export async function compressPdf(file: File, settings: CompressionSettings = DEFAULT_COMPRESSION_SETTINGS): Promise<CompressionResult> {
  const compression = resolveCompressionSettings(settings);

  if (!compression.rasterize) {
    return rewritePdf(file, compression);
  }

  return rasterizePdf(file, compression);
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

function resolveCompressionSettings(settings: CompressionSettings): CompressionPresetDefinition & CompressionSettings {
  const preset = COMPRESSION_PRESETS.find((item) => item.id === settings.preset) ?? COMPRESSION_PRESETS[1];
  if (preset.id === "structure") {
    return { ...preset, preset: preset.id, dpi: 0, quality: 1 };
  }

  if (preset.id === "custom") {
    return {
      ...preset,
      preset: preset.id,
      dpi: clamp(settings.dpi, 72, 600),
      quality: clamp(settings.quality, 0.1, 1),
    };
  }

  return {
    ...preset,
    preset: preset.id,
    dpi: preset.dpi,
    quality: preset.quality,
  };
}

async function rewritePdf(file: File, compression: CompressionSettings) {
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
  return finalizeCompression(file, compressedBytes, compression);
}

async function rasterizePdf(file: File, compression: CompressionSettings & CompressionPresetDefinition) {
  const input = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const output = await PDFDocument.create({ updateMetadata: false });
  const scale = compression.dpi / 72;

  for (let index = 1; index <= input.numPages; index += 1) {
    const page = await input.getPage(index);
    const viewport = page.getViewport({ scale, rotation: page.rotate });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Unable to create a canvas context for compression.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;

    const blob = await canvasToJpegBlob(canvas, compression.quality);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const embedded = await output.embedJpg(bytes);
    const displaySize = getDisplaySize(viewport.width / scale, viewport.height / scale, page.rotate);
    const pdfPage = output.addPage([displaySize.width, displaySize.height]);

    pdfPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: displaySize.width,
      height: displaySize.height,
    });
  }

  return finalizeCompression(file, await output.save({ useObjectStreams: true, addDefaultPage: false }), compression);
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Unable to encode the compressed page image."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function finalizeCompression(file: File, compressedBytes: Uint8Array, compression: CompressionSettings) {
  const blob = pdfBytesToBlob(compressedBytes);
  const savedBytes = Math.max(0, file.size - blob.size);

  return {
    blob,
    originalSize: file.size,
    compressedSize: blob.size,
    savedBytes,
    savingsPercent: file.size > 0 ? (savedBytes / file.size) * 100 : 0,
    preset: compression.preset,
    dpi: compression.dpi,
    quality: compression.quality,
  };
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
