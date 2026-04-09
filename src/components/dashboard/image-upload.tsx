"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import Image from "next/image";

interface ImageUploadProps {
  tenantId: string;
  /** Current image URL (if any) */
  value: string | null;
  /** Called with the new public URL (or null on delete) */
  onChange: (url: string | null) => void;
  /** Subfolder inside tenant dir, e.g. "resources" or "locations" */
  folder: string;
}

export function ImageUpload({
  tenantId,
  value,
  onChange,
  folder,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5 MB.");
      return;
    }

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filePath = `${tenantId}/${folder}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      setError("Error al subir imagen. Intenta nuevamente.");
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(filePath);

    // Delete previous image if exists
    if (value) {
      const prevPath = extractPath(value);
      if (prevPath) {
        await supabase.storage.from("images").remove([prevPath]);
      }
    }

    onChange(publicUrl);
    setUploading(false);

    // Reset the file input
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete() {
    if (!value) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const path = extractPath(value);
    if (path) {
      await supabase.storage.from("images").remove([path]);
    }

    onChange(null);
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted">
          <Image
            src={value}
            alt="Preview"
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
            unoptimized
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={handleDelete}
            disabled={uploading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-muted-foreground/50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm">Subir imagen</span>
            </>
          )}
        </button>
      )}

      {value && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-2" />
          )}
          Cambiar imagen
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={handleUpload}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Extract the storage path from a Supabase public URL. */
function extractPath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/public\/images\/(.+)$/);
  return match?.[1] ?? null;
}
