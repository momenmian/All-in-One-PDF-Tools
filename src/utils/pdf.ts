import { PDFDocument, degrees } from "pdf-lib";

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
      message: `${file.name} is ${formatBytes(file.size)}. The v1 limit is ${formatBytes(MAX_FILE_SIZE)} per file.`,
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
    const crop = cropByPage.get(pageIndex) ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const shouldTransform = selectedPages.has(pageIndex);
    const angle = shouldTransform ? angleByPage.get(pageIndex) ?? 0 : 0;
    const left = shouldTransform ? clamp(crop.left, 0, width - 1) : 0;
    const bottom = shouldTransform ? clamp(crop.bottom, 0, height - 1) : 0;
    const croppedWidth = shouldTransform ? Math.max(1, width - left - clamp(crop.right, 0, width - left - 1)) : width;
    const croppedHeight = shouldTransform ? Math.max(1, height - bottom - clamp(crop.top, 0, height - bottom - 1)) : height;

    const embedded = await output.embedPage(sourcePage, {
      left,
      bottom,
      right: left + croppedWidth,
      top: bottom + croppedHeight,
    });

    if (!shouldTransform || normalizeAngle(angle) === 0) {
      const page = output.addPage([croppedWidth, croppedHeight]);
      page.drawPage(embedded, { x: 0, y: 0, width: croppedWidth, height: croppedHeight });
      continue;
    }

    const radians = (normalizeAngle(angle) * Math.PI) / 180;
    const rotatedWidth = Math.abs(croppedWidth * Math.cos(radians)) + Math.abs(croppedHeight * Math.sin(radians));
    const rotatedHeight = Math.abs(croppedWidth * Math.sin(radians)) + Math.abs(croppedHeight * Math.cos(radians));
    const rotatedCorners = [
      rotatePoint(0, 0, radians),
      rotatePoint(croppedWidth, 0, radians),
      rotatePoint(0, croppedHeight, radians),
      rotatePoint(croppedWidth, croppedHeight, radians),
    ];
    const minX = Math.min(...rotatedCorners.map((point) => point.x));
    const minY = Math.min(...rotatedCorners.map((point) => point.y));
    const page = output.addPage([rotatedWidth, rotatedHeight]);

    page.drawPage(embedded, {
      x: -minX,
      y: -minY,
      width: croppedWidth,
      height: croppedHeight,
      rotate: degrees(angle),
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function normalizeAngle(angle: number) {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function rotatePoint(x: number, y: number, radians: number) {
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
}
