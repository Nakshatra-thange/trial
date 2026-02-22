import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import CreateTokenForm from "@/components/token/CreateTokenForm";

export default function CreateTokenPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-bold text-white mb-3">Connect Wallet</h1>
          <p className="text-zinc-400 text-sm mb-8">
            You need to connect your Solana wallet to launch a token
          </p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-12">
      <CreateTokenForm />
    </div>
  );
}
