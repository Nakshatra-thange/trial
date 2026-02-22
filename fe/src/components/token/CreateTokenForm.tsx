// src/components/token/CreateTokenForm.tsx

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useCreateToken } from "@/hooks/useCreateToken";
import ImageUpload from "./ImageUpload";
import { isSymbolTaken } from "@/services/duplicateCheck";

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

  const [symbolExists, setSymbolExists] = useState(false);
  const [checkingSymbol, setCheckingSymbol] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const imageFile = watch("image");
  const symbolValue = watch("symbol");

  // Check symbol on blockchain (debounced) - LOGIC FROM VERSION 1
  useEffect(() => {
    if (!symbolValue || symbolValue.length < 2) {
      setSymbolExists(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setCheckingSymbol(true);
      try {
        const taken = await isSymbolTaken(symbolValue);
        setSymbolExists(taken);
      } catch (err) {
        console.error("Symbol check failed:", err);
        setSymbolExists(false);
      } finally {
        setCheckingSymbol(false);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeout);
  }, [symbolValue]);

  async function onSubmit(data: FormData) {
    // Final check before submitting - LOGIC FROM VERSION 1
    if (symbolExists) {
      return;
    }

    // Double-check symbol one more time
    setCheckingSymbol(true);
    const isTaken = await isSymbolTaken(data.symbol);
    setCheckingSymbol(false);

    if (isTaken) {
      setSymbolExists(true);
      return;
    }

    const mintAddress = await create(
      data.name,
      data.symbol.toUpperCase(),
      data.description || "",
      data.image
    );

    if (mintAddress) {
      setTimeout(() => {
        navigate(`/token/${mintAddress}`);
      }, 2000); // 2 second redirect from VERSION 1
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Heading - AESTHETIC FROM VERSION 2 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-300 to-amber-700 bg-clip-text text-transparent mb-2">
          Create Token
        </h1>
        <p className="text-zinc-400 text-sm">No code. No liquidity. Just launch.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Image Upload */}
        <ImageUpload
          onImageSelect={(file) => setValue("image", file, { shouldValidate: true })}
          currentImage={imageFile}
        />
        {errors.image && (
          <p className="text-xs text-red-400 mt-1">{errors.image.message}</p>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Token Name <span className="text-zinc-600">*</span>
          </label>
          <input
            {...register("name")}
            placeholder="e.g. Moonshot Coin"
            className="w-full px-4 py-3 rounded-xl bg-[#141414] border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-600 transition-colors duration-200"
            disabled={isLoading}
          />
          {errors.name && (
            <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Symbol - ENHANCED FEEDBACK WITH VERSION 2 AESTHETIC */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Symbol <span className="text-zinc-600">*</span>
          </label>
          <input
            {...register("symbol")}
            placeholder="e.g. MOON"
            className="w-full px-4 py-3 rounded-xl bg-[#141414] border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-600 transition-colors duration-200 uppercase"
            disabled={isLoading}
            maxLength={10}
          />
          
          {/* Symbol check feedback - VERSION 1 STRUCTURE WITH VERSION 2 STYLING */}
          {checkingSymbol && (
            <div className="flex items-center gap-2 mt-2">
              <svg className="w-4 h-4 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm text-zinc-400">Checking blockchain...</p>
            </div>
          )}
          
          {!checkingSymbol && symbolExists && symbolValue && symbolValue.length >= 2 && (
            <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400 font-medium">
                ⚠️ ${symbolValue} already exists on the blockchain
              </p>
              <p className="text-xs text-red-400/70 mt-1">
                Please choose a different symbol
              </p>
            </div>
          )}
          
          {!checkingSymbol && !symbolExists && symbolValue && symbolValue.length >= 2 && (
            <div className="flex items-center gap-2 mt-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-amber-600">
                ${symbolValue} is available!
              </p>
            </div>
          )}
          
          {errors.symbol && (
            <p className="text-xs text-red-400 mt-1">{errors.symbol.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Description <span className="text-zinc-600">(optional)</span>
          </label>
          <textarea
            {...register("description")}
            placeholder="Tell the world about your token..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-[#141414] border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-600 transition-colors duration-200 resize-none"
            disabled={isLoading}
          />
          {errors.description && (
            <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* Progress/Error Messages - VERSION 2 STYLING */}
        {progress && (
          <div className="p-4 rounded-xl bg-amber-600/10 border border-amber-700/20">
            <p className="text-amber-600 text-sm">{progress}</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {step === "success" && (
          <div className="p-4 rounded-xl bg-amber-600/10 border border-amber-700/20">
            <p className="text-amber-600 text-sm font-medium">
              ✓ Token created! Redirecting...
            </p>
          </div>
        )}

        {/* Submit Button - VERSION 2 STYLING WITH VERSION 1 LOGIC */}
        <button
          type="submit"
          disabled={isLoading || symbolExists || checkingSymbol || !symbolValue || symbolValue.length < 2}
          className="w-full py-4 rounded-xl bg-amber-600/90 hover:bg-amber-700 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {step === "uploading" && "Uploading to IPFS..."}
              {step === "signing" && "Waiting for signature..."}
              {step === "confirming" && "Confirming transaction..."}
            </>
          ) : symbolExists ? (
            "Symbol Already Taken"
          ) : checkingSymbol ? (
            "Checking symbol..."
          ) : (
            "Launch Token 🚀"
          )}
        </button>

        <p className="text-xs text-zinc-600 text-center">
          Creating a token costs ~0.02 SOL in transaction fees
        </p>
      </form>
    </div>
  );
}