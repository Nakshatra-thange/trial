import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  currentImage?: File | null; // eslint-disable-line @typescript-eslint/no-unused-vars
}

export default function ImageUpload({ onImageSelect, currentImage }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    onImageSelect(file);
  }, [onImageSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/gif": [".gif"],
    },
    maxFiles: 1,
  });

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        Token Image <span className="text-zinc-600">*</span>
      </label>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors duration-200
          ${isDragActive
            ? "border-emerald-500 bg-emerald-500/5"
            : "border-zinc-700 hover:border-emerald-500 hover:bg-zinc-900/50"
          }
        `}
      >
        <input {...getInputProps()} />

        {preview ? (
          <div className="flex flex-col items-center">
            <img
              src={preview}
              alt="Token preview"
              className="w-40 h-40 rounded-xl mx-auto mb-3 object-cover"
            />
            <p className="text-sm text-zinc-500">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-zinc-300 text-sm mb-1">
              {isDragActive ? "Drop image here" : "Click or drag image"}
            </p>
            <p className="text-xs text-zinc-600">PNG, JPG, GIF up to 5MB</p>
          </div>
        )}
      </div>
    </div>
  );
}
