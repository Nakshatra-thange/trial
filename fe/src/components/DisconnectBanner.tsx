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
    <div className="fixed top-0 left-0 right-0 bg-yellow-500/90 text-zinc-900 px-4 py-3 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="font-semibold">Wallet disconnected</p>
        </div>

        <button
          onClick={() => setVisible(true)}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 font-medium text-sm transition-colors"
        >
          Reconnect
        </button>
      </div>
    </div>
  );
}