import { Routes, Route } from "react-router-dom";
import CreateTokenPage from "./pages/CreateTokenPage";
import { TokenPage } from "@/pages/TokenPage";
import HomePage from "@/pages/HomePage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DisconnectBanner } from "@/components/DisconnectBanner";
import { Toaster } from "sonner";
import AdminPage from "@/pages/AdminPage";

export default function App() {
  return (
    <ErrorBoundary>
      
        <DisconnectBanner />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateTokenPage />} />
          <Route path="/token/:mint" element={<TokenPage />} />
          <Route path="/admin" element={<AdminPage />} />

        </Routes>

        <Toaster
          position="top-right"
          richColors
          theme="dark"
          toastOptions={{
            style: {
              background: "#27272a",
              border: "1px solid #3f3f46",
              color: "#fafafa",
            },
          }}
        />
    
    </ErrorBoundary>
  );
}