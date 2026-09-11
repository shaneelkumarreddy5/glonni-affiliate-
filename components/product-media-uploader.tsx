"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Link2, UploadCloud, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  fieldName: string;
  label: string;
  productKey: string;
  initialUrls?: string[];
  multiple?: boolean;
  required?: boolean;
};

const cleanUrls = (value: string, limit: number) =>
  [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ].slice(0, limit);

export function ProductMediaUploader({
  fieldName,
  label,
  productKey,
  initialUrls = [],
  multiple = false,
  required = false,
}: Props) {
  const limit = multiple ? 12 : 1;
  const [urls, setUrls] = useState(() => initialUrls.slice(0, limit));
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const uploadingRef = useRef(false);

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const stopEarlySubmit = (event: SubmitEvent) => {
      if (!uploadingRef.current) return;
      event.preventDefault();
      setError("Please wait for the image upload to finish before saving.");
    };
    form.addEventListener("submit", stopEarlySubmit);
    return () => form.removeEventListener("submit", stopEarlySubmit);
  }, []);

  async function upload(files: FileList | File[]) {
    const selected = [...files];
    if (!selected.length) return;
    if (!multiple && selected.length > 1) {
      setError("Choose one primary image.");
      return;
    }
    if (multiple && urls.length + selected.length > limit) {
      setError(`A product gallery can contain up to ${limit} images.`);
      return;
    }
    const invalid = selected.find(
      (file) => !ACCEPTED.includes(file.type) || file.size > MAX_BYTES,
    );
    if (invalid) {
      setError(
        `${invalid.name} must be a JPG, PNG, WebP or AVIF image under 8 MB.`,
      );
      return;
    }

    setError("");
    setUploading(true);
    uploadingRef.current = true;
    const client = createClient();
    const uploaded: string[] = [];
    try {
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) throw new Error("Your admin session has expired.");
      for (const file of selected) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "image";
        const path = `products/${userData.user.id}/${productKey}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage
          .from("product-media")
          .upload(path, file, {
            cacheControl: "31536000",
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
        uploaded.push(
          client.storage.from("product-media").getPublicUrl(path).data
            .publicUrl,
        );
      }
      setUrls((current) =>
        multiple
          ? [...new Set([...current, ...uploaded])].slice(0, limit)
          : uploaded.slice(-1),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Image upload failed.",
      );
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  const textValue = urls.join("\n");
  return (
    <div className="product-media-uploader" ref={root}>
      <input type="hidden" name={fieldName} value={textValue} />
      <div className="product-media-heading">
        <span>
          <b>{label}</b>
          <small>
            {multiple ? "Up to 12 images" : "One primary image"} · JPG, PNG,
            WebP or AVIF · 8 MB each
          </small>
        </span>
        {uploading && <em>Uploading…</em>}
      </div>

      <label
        className={`product-dropzone ${dragging ? "dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files);
        }}
      >
        <UploadCloud />
        <span>
          <b>Drag and drop {multiple ? "product images" : "an image"}</b>
          <small>or click to browse files from your device</small>
        </span>
        <i>{uploading ? "Uploading" : "Choose files"}</i>
        <input
          type="file"
          accept={ACCEPTED.join(",")}
          multiple={multiple}
          disabled={uploading}
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      {error && <p className="product-media-error">{error}</p>}

      {urls.length > 0 && (
        <div className="product-media-previews">
          {urls.map((url, index) => (
            <figure key={`${url}-${index}`}>
              <img src={url} alt={`Product image ${index + 1}`} />
              {!multiple && index === 0 && <figcaption>Primary</figcaption>}
              <button
                type="button"
                aria-label={`Remove image ${index + 1}`}
                onClick={() =>
                  setUrls((current) => current.filter((_, i) => i !== index))
                }
              >
                <X />
              </button>
            </figure>
          ))}
        </div>
      )}

      <details className="product-url-fallback">
        <summary>
          <Link2 /> Add using image URL instead
        </summary>
        <label>
          {multiple ? "Image URLs — one per line" : "Image URL"}
          {multiple ? (
            <textarea
              rows={4}
              value={textValue}
              placeholder="https://example.com/front.jpg"
              onChange={(event) =>
                setUrls(cleanUrls(event.target.value, limit))
              }
            />
          ) : (
            <input
              type="url"
              value={urls[0] ?? ""}
              required={required && urls.length === 0}
              placeholder="https://example.com/product.jpg"
              onChange={(event) =>
                setUrls(event.target.value.trim() ? [event.target.value] : [])
              }
            />
          )}
        </label>
      </details>
      {!urls.length && (
        <div className="product-media-empty">
          <ImageIcon /> No image selected yet
        </div>
      )}
    </div>
  );
}
