const UNLINK_KEY = "cp-wallet-unlinked";

type RequestFn = (args: {
  method: string;
  params?: unknown[];
}) => Promise<unknown>;

export type WalletProvider = {
  request?: RequestFn;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function markWalletUnlinked() {
  try {
    window.localStorage.setItem(UNLINK_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearWalletUnlinked() {
  try {
    window.localStorage.removeItem(UNLINK_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldReconnectWallet() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(UNLINK_KEY) !== "1";
  } catch {
    return true;
  }
}

export async function revokeWalletSession(provider?: WalletProvider | null) {
  if (!provider?.request) return;
  try {
    await Promise.race([
      provider.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      }),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  } catch {
    /* wallet may not support revoke */
  }
}

export async function pickWalletAccount(provider?: WalletProvider | null) {
  if (!provider?.request) return;
  try {
    await provider.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch {
      /* user rejected */
    }
  }
}
