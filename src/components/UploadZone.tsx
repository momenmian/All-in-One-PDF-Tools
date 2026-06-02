import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

type UploadZoneProps = {
  multiple?: boolean;
  label: string;
  hint: string;
  onFiles: (files: File[]) => void;
};

export function UploadZone({ multiple = false, label, hint, onFiles }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <section
      className={`upload-zone ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <UploadCloud size={34} aria-hidden="true" />
      <h2>{label}</h2>
      <p>{hint}</p>
      <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
        Choose PDF{multiple ? "s" : ""}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        onChange={(event) => onFiles(Array.from(event.currentTarget.files ?? []))}
      />
    </section>
  );
}
