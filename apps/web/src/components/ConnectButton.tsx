"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
  clearWalletUnlinked,
  markWalletUnlinked,
  revokeWalletSession,
  shouldReconnectWallet,
  type WalletProvider,
} from "@/lib/wallet-session";

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect, disconnectAsync } = useDisconnect();
  const [busy, setBusy] = useState(false);
  const [selectedConnectorUid, setSelectedConnectorUid] = useState<string>();

  const walletConnectors = useMemo(() => {
    const discovered = connectors.filter((item) => item.id !== "injected");
    return discovered.length ? discovered : connectors;
  }, [connectors]);
  const selectedConnector = useMemo(() => {
    const selected = walletConnectors.find((item) => item.uid === selectedConnectorUid);
    if (selected) return selected;
    return (
      walletConnectors.find((item) => /rabby/i.test(`${item.id} ${item.name}`)) ??
      walletConnectors.find((item) => /metamask/i.test(`${item.id} ${item.name}`)) ??
      walletConnectors[0]
    );
  }, [selectedConnectorUid, walletConnectors]);

  useEffect(() => {
    if (
      selectedConnectorUid &&
      walletConnectors.some((item) => item.uid === selectedConnectorUid)
    ) {
      return;
    }
    setSelectedConnectorUid(selectedConnector?.uid);
  }, [selectedConnector, selectedConnectorUid, walletConnectors]);

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
    const target = selectedConnector;
    if (!target) return;
    setBusy(true);
    try {
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
    <div className="wallet-connect">
      {walletConnectors.length > 1 ? (
        <label className="wallet-picker" htmlFor="wallet-connector">
          <span className="sr-only">Wallet</span>
          <select
            id="wallet-connector"
            className="wallet-select"
            value={selectedConnector?.uid ?? ""}
            onChange={(event) => setSelectedConnectorUid(event.target.value)}
          >
            {walletConnectors.map((item) => (
              <option key={item.uid} value={item.uid}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!selectedConnector || isPending || busy}
        onClick={() => void onConnect()}
      >
        {isPending || busy
          ? "Connecting…"
          : selectedConnector
            ? `Connect ${selectedConnector.name}`
            : "Connect wallet"}
      </button>
    </div>
  );
}
