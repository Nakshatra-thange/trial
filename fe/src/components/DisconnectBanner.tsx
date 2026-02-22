import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function DisconnectBanner() {
  const { connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const location = useLocation(); // ✅ HOOK AT TOP LEVEL

  const [show, setShow] = useState(false);

  useEffect(() => {
    const isProtectedPage =
      location.pathname.startsWith("/token") ||
      location.pathname.startsWith("/create");

    if (isProtectedPage && !connected && !connecting) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [connected, connecting, location.pathname]); // ✅ include location

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 px-4 py-2.5 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="font-medium text-sm">Wallet disconnected</p>
        </div>

        <button
          onClick={() => setVisible(true)}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 font-medium text-xs transition-colors duration-200"
        >
          Reconnect
        </button>
      </div>
    </div>
  );
}