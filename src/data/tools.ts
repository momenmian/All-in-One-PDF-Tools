import {
  Combine,
  Crop,
  FileArchive,
  FileImage,
  FileOutput,
  FileStack,
  Image,
  ListOrdered,
  Scissors,
  Stamp,
  Trash2,
} from "lucide-react";

export type ToolStatus = "available" | "coming-soon";

export type ToolDefinition = {
  name: string;
  route: string;
  description: string;
  status: ToolStatus;
  privacy: "Browser" | "Server later";
  icon: typeof Combine;
};

export const tools: ToolDefinition[] = [
  {
    name: "Merge PDFs",
    route: "/merge",
    description: "Combine multiple PDFs into one ordered document.",
    status: "available",
    privacy: "Browser",
    icon: Combine,
  },
  {
    name: "Rotate & Crop",
    route: "/rotate-crop",
    description: "Rotate pages by any angle, crop edges, and align with guides.",
    status: "available",
    privacy: "Browser",
    icon: Crop,
  },
  {
    name: "Split PDF",
    route: "/split",
    description: "Extract selected pages or split ranges into new files.",
    status: "coming-soon",
    privacy: "Browser",
    icon: Scissors,
  },
  {
    name: "Delete Pages",
    route: "/delete-pages",
    description: "Remove blank or unwanted pages from a PDF.",
    status: "coming-soon",
    privacy: "Browser",
    icon: Trash2,
  },
  {
    name: "Reorder Pages",
    route: "/reorder-pages",
    description: "Drag pages into the exact order you need.",
    status: "coming-soon",
    privacy: "Browser",
    icon: FileStack,
  },
  {
    name: "Compress PDF",
    route: "/compress",
    description: "Reduce file size with a clear quality tradeoff.",
    status: "coming-soon",
    privacy: "Browser",
    icon: FileArchive,
  },
  {
    name: "Images to PDF",
    route: "/images-to-pdf",
    description: "Turn JPG and PNG images into a single PDF.",
    status: "coming-soon",
    privacy: "Browser",
    icon: Image,
  },
  {
    name: "PDF to Images",
    route: "/pdf-to-images",
    description: "Export PDF pages as image files.",
    status: "coming-soon",
    privacy: "Browser",
    icon: FileImage,
  },
  {
    name: "Page Numbers",
    route: "/page-numbers",
    description: "Add professional page numbers with placement controls.",
    status: "coming-soon",
    privacy: "Browser",
    icon: ListOrdered,
  },
  {
    name: "Watermark",
    route: "/watermark",
    description: "Apply text or image watermarks to documents.",
    status: "coming-soon",
    privacy: "Browser",
    icon: Stamp,
  },
  {
    name: "Convert PDF",
    route: "/convert",
    description: "Convert PDFs to editable formats in a later server-backed phase.",
    status: "coming-soon",
    privacy: "Server later",
    icon: FileOutput,
  },
];
