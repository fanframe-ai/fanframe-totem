import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TeamProvadorPage from "./pages/TeamProvador";
import KioskPage from "./pages/Kiosk";
import NotFound from "./pages/NotFound";
import Teste from "./pages/Teste";
import TermosDeUso from "./pages/TermosDeUso";
import UploadAssets from "./pages/UploadAssets";
import AdminDisabled from "./pages/AdminDisabled";
import { TeamProvider } from "./contexts/TeamContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TeamProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Root redirects to admin */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* Dedicated desktop kiosk route */}
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/teste-totem/:token" element={<KioskPage />} />
          
          {/* Team provador route */}
          <Route path="/:slug" element={<TeamProvadorPage />} />
          
          <Route path="/teste" element={<Teste />} />
          <Route path="/termos-de-uso" element={<TermosDeUso />} />
          <Route path="/upload-assets" element={<UploadAssets />} />
          
          {/* Legacy admin disabled: use the dedicated /apps/admin Vercel app */}
          <Route path="/admin/*" element={<AdminDisabled />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </TeamProvider>
  </QueryClientProvider>
);

export default App;
