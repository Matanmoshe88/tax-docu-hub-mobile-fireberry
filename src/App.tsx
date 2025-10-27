
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ContractPage } from "./pages/ContractPage";
import AuthPage from "./pages/AuthPage";
import { SignaturePage } from "./pages/SignaturePage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { FinishPage } from "./pages/FinishPage";
import { PaymentPage } from "./pages/PaymentPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/:recordId" element={<HomePage />} />
          <Route path="/contract/:recordId" element={<ContractPage />} />
          
          <Route path="/signature/:recordId" element={<SignaturePage />} />
          <Route path="/documents/:recordId" element={<DocumentsPage />} />
          <Route path="/payment/:recordId" element={<PaymentPage />} />
          <Route path="/finish/:recordId" element={<FinishPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
