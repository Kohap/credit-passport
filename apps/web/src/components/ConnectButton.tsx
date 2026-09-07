"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
  clearWalletUnlinked,
  markWalletUnlinked,
  pickWalletAccount,
  revokeWalletSession,
  shouldReconnectWallet,
  type WalletProvider,
} from "@/lib/wallet-session";

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect, disconnectAsync } = useDisconnect();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off: (() => void) | undefined;
    void (async () => {
      const provider = (await connector?.getProvider()) as WalletProvider | undefined;
      if (!provider?.on) return;
      const onAccounts = (...args: unknown[]) => {
        const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
        if (!accounts.length || !shouldReconnectWallet()) {
          markWalletUnlinked();
          disconnect();
        }
      };
      provider.on("accountsChanged", onAccounts);
      off = () => provider.removeListener?.("accountsChanged", onAccounts);
    })();
    return () => off?.();
  }, [connector, disconnect]);

  async function onDisconnect() {
    setBusy(true);
    markWalletUnlinked();
    try {
      const provider = (await connector?.getProvider()) as WalletProvider | undefined;
      await revokeWalletSession(provider);
      await disconnectAsync();
    } finally {
      setBusy(false);
    }
  }

  async function onConnect() {
    const target = connectors.find((item) => item.id === "injected") ?? connectors[0];
    if (!target) return;
    setBusy(true);
    try {
      const provider = (await target.getProvider()) as WalletProvider | undefined;
      await pickWalletAccount(provider);
      clearWalletUnlinked();
      await connectAsync({ connector: target });
    } finally {
      setBusy(false);
    }
  }

  if (isConnected && address) {
    return (
      <button type="button" className="btn" disabled={busy} onClick={() => void onDisconnect()}>
        {busy
          ? "Disconnecting…"
          : `${address.slice(0, 6)}…${address.slice(-4)} · Disconnect`}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={!connectors[0] || isPending || busy}
      onClick={() => void onConnect()}
    >
      {isPending || busy ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
