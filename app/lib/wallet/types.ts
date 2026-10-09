import type { Address } from "@solana/kit";

export type WalletAccount = {
  address: Address;
  publicKey: Uint8Array;
  label?: string;
};

export type WalletConnectorMetadata = {
  id: string;
  name: string;
  icon?: string;
};

export type WalletSession = {
  account: WalletAccount;
  connector: WalletConnectorMetadata;
  disconnect: () => Promise<void>;
  signTransaction?: (
    transaction: Uint8Array,
    chain: string
  ) => Promise<Uint8Array>;
  sendTransaction?: (
    transaction: Uint8Array,
    chain: string
  ) => Promise<Uint8Array>;
  /** Signs a short-lived Private ER authentication challenge. */
  signMessage?: (message: Uint8Array) => Promise<{
    signedMessage: Uint8Array;
    signature: Uint8Array;
  }>;
};

export type WalletConnector = WalletConnectorMetadata & {
  connect: (options?: { silent?: boolean }) => Promise<WalletSession>;
};
