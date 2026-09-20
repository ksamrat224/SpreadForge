"use client";

import { Toaster } from "sonner";
import { PropsWithChildren } from "react";
import { ClusterProvider } from "./cluster-context";
import { WalletProvider } from "../lib/wallet/context";
import { SolanaClientProvider } from "../lib/solana-client-context";
import { SpreadForgeThemeProvider } from "./theme-context";

export function Providers({ children }: PropsWithChildren) {
  return (
    <SpreadForgeThemeProvider>
      <ClusterProvider>
        <SolanaClientProvider>
          <WalletProvider>{children}</WalletProvider>
        </SolanaClientProvider>
        <Toaster position="bottom-right" richColors />
      </ClusterProvider>
    </SpreadForgeThemeProvider>
  );
}
