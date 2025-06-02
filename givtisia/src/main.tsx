import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "./Home.tsx";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router";
import { setupPolyfills } from "./polyfills.ts";
import { AuthProvider } from "@/auth/AuthProvider.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TransactionTest from "@/components/shared/TransactionTest.tsx";
import CampaignDetails from "./campaigns/CampaignDetails.tsx";

setupPolyfills();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route index element={<Home />} />
            <Route path="campaigns">
              <Route path=":id" element={<CampaignDetails />} />
            </Route>

            <Route path="/test-transaction" element={<TransactionTest />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
