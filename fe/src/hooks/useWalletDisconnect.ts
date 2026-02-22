import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
export function useWalletDisconnect() {
  const { connected, publicKey } = useWallet();
  const navigate = useNavigate();
  const [wasConnected, setWasConnected] = useState(false);

  useEffect(() => {
    // Track connection state
    if (connected && publicKey) {
      setWasConnected(true);
    }

    // Detect disconnection
    if (wasConnected && !connected) {
      console.log("Wallet disconnected — redirecting to home");
      navigate("/", { replace: true });
      toast.error("Wallet disconnected");
      setWasConnected(false);
    }
  }, [connected, publicKey, wasConnected, navigate]);
}