# PDFForge

PDFForge is a local-first PDF toolkit built with React, TypeScript, and Vite. It is designed to make everyday PDF work fast, private, and approachable by processing files directly in the browser whenever possible.

The current version includes working tools for merging PDFs, visually rotating or cropping pages, compressing PDFs with local browser optimization, and removing known PDF passwords by creating an unlocked copy. The home screen also lays out the broader all-in-one toolkit roadmap.

## Features

- Merge multiple PDF files into one ordered document
- Drag and reorder files before merging
- Validate PDFs before processing, including empty, oversized, corrupted, and password-protected files
- Rotate PDF pages by common or custom angles
- Crop page edges with numeric controls and a visual crop overlay
- Select the current page or apply changes across all pages
- Preview pages locally with grid and center guides
- Compress PDFs with browser-side structure optimization
- Compare original and compressed file sizes before downloading
- Password Remover: remove a known PDF password by rebuilding an unencrypted browser-local copy
- Track page-by-page unlock progress before downloading
- Download generated PDFs directly from the browser
- Clear coming-soon tool cards for future PDF workflows

## Local-First Privacy

PDFForge is built around a browser-first workflow. The implemented tools run locally in the user's browser using `pdf-lib` and `pdfjs-dist`, so uploaded files are not sent to a server for merging, previewing, rotating, cropping, compressing, or password removal.

Some future conversion features may require server-backed processing, and the UI marks those separately.

## Available Tools

| Tool | Route | Status | Processing |
| --- | --- | --- | --- |
| Merge PDFs | `/merge` | Ready | Browser |
| Rotate & Crop | `/rotate-crop` | Ready | Browser |
| Compress PDF | `/compress` | Ready | Browser |
| Password Remover | `/password-remover` | Ready | Browser |
| Split PDF | `/split` | Coming soon | Browser |
| Delete Pages | `/delete-pages` | Coming soon | Browser |
| Reorder Pages | `/reorder-pages` | Coming soon | Browser |
| Images to PDF | `/images-to-pdf` | Coming soon | Browser |
| PDF to Images | `/pdf-to-images` | Coming soon | Browser |
| Page Numbers | `/page-numbers` | Coming soon | Browser |
| Watermark | `/watermark` | Coming soon | Browser |
| Convert PDF | `/convert` | Coming soon | Server-backed later |

## Tech Stack

- React 18
- TypeScript
- Vite
- `pdf-lib` for PDF creation, merging, rotation, cropping, compression output, and unlocked PDF rebuilding
- `pdfjs-dist` for PDF page preview rendering and password-protected PDF opening
- `@dnd-kit` for drag-and-drop ordering
- `lucide-react` for icons

## Getting Started

Install dependencies:

```bash
npm install
```

## How to Run

Start the development server:

```bash
npm run dev
```

Vite starts the app on a local URL, usually:

```text
http://127.0.0.1:5173/
```

Open that URL in your browser to use PDFForge locally.

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
src/
  App.tsx                  App shell and route selection
  main.tsx                 React entry point
  styles.css               Global application styles
  components/
    UploadZone.tsx         Shared drag-and-drop upload component
  data/
    tools.ts               Tool catalog and roadmap metadata
  pages/
    HomePage.tsx           Tool dashboard
    CompressTool.tsx       PDF compression workflow
    MergeTool.tsx          PDF merge workflow
    PasswordRemoverTool.tsx
                            Known-password PDF unlock workflow
    RotateCropTool.tsx     Visual rotate and crop workflow
  utils/
    pdf.ts                 PDF validation and transformation helpers
```

## Notes

- The current per-file limit is 50 MB.
- Merge, compress, and rotate/crop reject password-protected PDFs with a user-facing message.
- Password Remover requires the user to know the document password. It creates a flattened unencrypted PDF, so selectable text, form fields, and some document structure may not be preserved.
- Large production chunks are expected because PDF rendering and manipulation libraries are substantial.
- The app currently uses simple path-based routing through `window.location.pathname`.

## Roadmap

Planned next tools include splitting PDFs, deleting pages, reordering pages, converting images to PDF, exporting PDF pages as images, adding page numbers, adding watermarks, and eventually supporting server-backed document conversion.
