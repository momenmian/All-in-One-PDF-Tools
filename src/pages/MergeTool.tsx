import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Download, GripVertical, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { UploadZone } from "../components/UploadZone";
import { PdfItem, formatBytes, mergePdfs, validatePdfFile } from "../utils/pdf";

export function MergeTool() {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canMerge = items.length >= 2 && !busy;

  async function addFiles(files: File[]) {
    setError("");
    setResultUrl("");
    const accepted: PdfItem[] = [];

    for (const file of files) {
      const validation = await validatePdfFile(file);
      if (!validation.ok) {
        setError(validation.message ?? "One file could not be added.");
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file });
    }

    setItems((current) => [...current, ...accepted]);
  }

  async function handleMerge() {
    if (items.length < 2) {
      setError("Add at least two PDFs before merging.");
      return;
    }

    setBusy(true);
    setError("");
    setResultUrl("");
    try {
      const blob = await mergePdfs(items.map((item) => item.file));
      setResultUrl(URL.createObjectURL(blob));
    } catch {
      setError("The PDFs could not be merged. Check for password protection or corrupted files.");
    } finally {
      setBusy(false);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  return (
    <section className="tool-page">
      <div className="tool-heading">
        <a href="/" className="back-link">← All tools</a>
        <p className="eyebrow">Browser tool</p>
        <h1>Merge PDFs</h1>
        <p>Upload two or more PDFs, put them in order, and download one combined file.</p>
        <span className="trust-note">Files stay in your browser and are not uploaded.</span>
      </div>

      <UploadZone multiple label="Drop PDFs to merge" hint="Add two or more PDF files up to 50 MB each." onFiles={addFiles} />

      {error ? <p className="error-box">{error}</p> : null}

      <section className="workspace-card">
        <div className="section-title">
          <h2>Merge order</h2>
          <span>{items.length} file{items.length === 1 ? "" : "s"}</span>
        </div>
        {items.length === 0 ? (
          <p className="muted">Uploaded PDFs will appear here.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="file-list">
                {items.map((item, index) => (
                  <SortableFile
                    item={item}
                    index={index}
                    key={item.id}
                    onRemove={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="action-row">
          <button className="primary-button" type="button" disabled={!canMerge} onClick={handleMerge}>
            {busy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : null}
            Merge PDFs
          </button>
          {resultUrl ? (
            <a className="download-button" href={resultUrl} download="merged.pdf">
              <Download size={18} aria-hidden="true" />
              Download merged.pdf
            </a>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function SortableFile({ item, index, onRemove }: { item: PdfItem; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div className="file-row" ref={setNodeRef} style={style}>
      <button className="icon-button drag" type="button" {...attributes} {...listeners} aria-label={`Reorder ${item.file.name}`}>
        <GripVertical size={18} aria-hidden="true" />
      </button>
      <span className="file-index">{index + 1}</span>
      <div>
        <strong>{item.file.name}</strong>
        <span>{formatBytes(item.file.size)}</span>
      </div>
      <button className="icon-button danger" type="button" onClick={onRemove} aria-label={`Remove ${item.file.name}`}>
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
