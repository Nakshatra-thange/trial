import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  currentImage?: File | null;
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
        Token Image *
      </label>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-blue-500 bg-blue-500/10" : "border-zinc-600 hover:border-zinc-500"}
        `}
      >
        <input {...getInputProps()} />

        {preview ? (
          <div>
            <img
              src={preview}
              alt="Token preview"
              className="w-32 h-32 rounded-xl mx-auto mb-3 object-cover"
            />
            <p className="text-sm text-zinc-400">Click or drag to replace</p>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-zinc-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-zinc-300 mb-1">
              {isDragActive ? "Drop image here" : "Click or drag image"}
            </p>
            <p className="text-xs text-zinc-500">PNG, JPG, GIF up to 5MB</p>
          </div>
        )}
      </div>
    </div>
  );
}