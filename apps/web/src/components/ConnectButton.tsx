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
  const [connectionError, setConnectionError] = useState<string | null>(null);
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
    let cancelled = false;
    void (async () => {
      const provider = (await connector?.getProvider()) as WalletProvider | undefined;
      if (cancelled || !provider?.on) return;
      const onAccounts = (...args: unknown[]) => {
        const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
        if (!accounts.length || !shouldReconnectWallet()) {
          markWalletUnlinked();
          disconnect();
        }
      };
      provider.on("accountsChanged", onAccounts);
      off = () => provider.removeListener?.("accountsChanged", onAccounts);
    })().catch(() => {
      if (!cancelled) setConnectionError("Unable to reach your wallet. Unlock it and try connecting again.");
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [connector, disconnect]);

  async function onDisconnect() {
    setBusy(true);
    setConnectionError(null);
    markWalletUnlinked();
    try {
      const provider = (await connector?.getProvider()) as WalletProvider | undefined;
      await revokeWalletSession(provider);
      await disconnectAsync();
    } catch {
      setConnectionError("Unable to disconnect. Try again or disconnect this site in your wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function onConnect() {
    const target = selectedConnector;
    if (!target) return;
    setBusy(true);
    setConnectionError(null);
    try {
      clearWalletUnlinked();
      await connectAsync({ connector: target });
    } catch {
      setConnectionError("Wallet connection was not completed. Unlock your wallet and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (isConnected && address) {
    return (
      <div className="wallet-connect">
      <button type="button" className="btn" disabled={busy} onClick={() => void onDisconnect()}>
        {busy
          ? "Disconnecting…"
          : `${address.slice(0, 6)}…${address.slice(-4)} · Disconnect`}
      </button>
      {connectionError && <p role="alert">{connectionError}</p>}
      </div>
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
      {connectionError && <p role="alert">{connectionError}</p>}
    </div>
  );
}
