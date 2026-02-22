import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useCreateToken } from "../../hooks/useCreateToken";
import ImageUpload from "./ImageUpload";

const schema = z.object({
  name: z.string().min(1, "Name required").max(32, "Max 32 characters"),
  symbol: z.string()
    .min(1, "Symbol required")
    .max(10, "Max 10 characters")
    .regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only"),
  description: z.string().max(500, "Max 500 characters").optional(),
  image: z.instanceof(File, { message: "Image required" }),
});

type FormData = z.infer<typeof schema>;

export default function CreateTokenForm() {
  const navigate = useNavigate();
  const { create, step, progress, error, isLoading } = useCreateToken();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  console.log("CREATE TOKEN STARTED");

  const imageFile = watch("image");

  async function onSubmit(data: FormData) {
    console.log("FORM SUBMITTED", data);
    const mintAddress = await create(
      data.name,
      data.symbol,
      data.description || "",
      data.image
    );
    

    if (mintAddress) {
      // Redirect to token page after 2 seconds
      setTimeout(() => {
        navigate(`/token/${mintAddress}`);
      }, 5000);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-2">Create Token</h1>
      <p className="text-zinc-400 mb-8">
        Launch your token on the bonding curve. No liquidity needed.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Image Upload */}
        <ImageUpload
          onImageSelect={(file) => setValue("image", file, { shouldValidate: true })}
          currentImage={imageFile}
        />
        {errors.image && (
          <p className="text-sm text-red-400 mt-1">{errors.image.message}</p>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Token Name *
          </label>
          <input
            {...register("name")}
            placeholder="e.g. Doge Killer"
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-600 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            disabled={isLoading}
          />
          {errors.name && (
            <p className="text-sm text-red-400 mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Symbol */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Symbol *
          </label>
          <input
            {...register("symbol")}
            placeholder="e.g. DOGKILL"
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-600 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 uppercase"
            disabled={isLoading}
          />
          {errors.symbol && (
            <p className="text-sm text-red-400 mt-1">{errors.symbol.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Description (optional)
          </label>
          <textarea
            {...register("description")}
            placeholder="Tell the world about your token..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-600 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
            disabled={isLoading}
          />
          {errors.description && (
            <p className="text-sm text-red-400 mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* Progress/Error Messages */}
        {progress && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <p className="text-blue-400 text-sm">{progress}</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {step === "success" && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="text-green-400 text-sm font-medium">
              ✓ Token created! Redirecting...
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {step === "uploading" && "Uploading..."}
              {step === "signing" && "Waiting for signature..."}
              {step === "confirming" && "Confirming..."}
            </>
          ) : (
            "Launch Token"
          )}
        </button>

        <p className="text-xs text-zinc-500 text-center">
          Creating a token costs ~0.02 SOL in transaction fees
        </p>
      </form>
    </div>
  );
}
