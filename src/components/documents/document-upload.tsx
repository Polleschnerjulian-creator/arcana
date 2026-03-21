"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Upload, FileText, Image, X, Check, Loader2 } from "lucide-react";

type DocumentType =
  | "INCOMING_INVOICE"
  | "OUTGOING_INVOICE"
  | "RECEIPT"
  | "BANK_STATEMENT"
  | "OTHER";

const TYPE_LABELS: Record<DocumentType, string> = {
  INCOMING_INVOICE: "Eingangsrechnung",
  OUTGOING_INVOICE: "Ausgangsrechnung",
  RECEIPT: "Quittung",
  BANK_STATEMENT: "Kontoauszug",
  OTHER: "Sonstiges",
};

interface QueuedFile {
  file: File;
  type: DocumentType;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function DocumentUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const queued: QueuedFile[] = Array.from(newFiles)
      .filter((f) => {
        const valid =
          f.type.startsWith("image/") || f.type === "application/pdf";
        return valid && f.size <= 10 * 1024 * 1024; // 10MB
      })
      .map((file) => ({
        file,
        type: "INCOMING_INVOICE" as DocumentType,
        status: "pending" as const,
      }));
    setFiles((prev) => [...prev, ...queued]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateType = (index: number, type: DocumentType) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, type } : f))
    );
  };

  const uploadAll = async () => {
    setUploading(true);
    const pending = files.filter((f) => f.status === "pending");

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading" } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", files[i].file);
        formData.append("type", files[i].type);

        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload fehlgeschlagen");
        }

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "done" } : f
          )
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: "error",
                  error:
                    err instanceof Error
                      ? err.message
                      : "Upload fehlgeschlagen",
                }
              : f
          )
        );
      }
    }

    setUploading(false);

    // If all done, redirect after short delay
    const allDone = files.every(
      (f) => f.status === "done" || f.status === "error"
    );
    if (allDone && pending.length > 0) {
      setTimeout(() => router.push("/documents"), 1500);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
          isDragging
            ? "border-primary bg-gray-50/50"
            : "border-border hover:border-primary/50 hover:bg-surface"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="w-10 h-10 text-text-secondary mx-auto mb-3" />
        <p className="text-text-primary font-medium">
          Dateien hierher ziehen oder klicken
        </p>
        <p className="text-sm text-text-secondary mt-1">
          PDF, JPG, PNG, WebP — max. 10 MB pro Datei
        </p>
      </div>

      {/* File Queue */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-primary">
            {files.length} {files.length === 1 ? "Datei" : "Dateien"}{" "}
            ausgewählt
          </h3>

          {files.map((qf, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="shrink-0">
                    {qf.file.type.startsWith("image/") ? (
                      <Image aria-hidden className="w-8 h-8 text-text-secondary" />
                    ) : (
                      <FileText className="w-8 h-8 text-text-secondary" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {qf.file.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {formatSize(qf.file.size)}
                    </p>
                  </div>

                  {/* Type Selector */}
                  <select
                    value={qf.type}
                    onChange={(e) =>
                      updateType(index, e.target.value as DocumentType)
                    }
                    disabled={qf.status !== "pending"}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-text-primary"
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  {/* Status */}
                  {qf.status === "uploading" && (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  )}
                  {qf.status === "done" && (
                    <Check className="w-5 h-5 text-success" />
                  )}
                  {qf.status === "error" && (
                    <Badge variant="danger">{qf.error}</Badge>
                  )}
                  {qf.status === "pending" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="p-1 text-text-secondary hover:text-danger transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Upload Button */}
          {pendingCount > 0 && (
            <Button
              onClick={uploadAll}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {pendingCount}{" "}
                  {pendingCount === 1 ? "Datei" : "Dateien"} hochladen
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
