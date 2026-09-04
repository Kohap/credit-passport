"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button type="button" className="btn" onClick={() => disconnect()}>
        {address.slice(0, 6)}…{address.slice(-4)} · Disconnect
      </button>
    );
  }

  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={!injected || isPending}
      onClick={() => injected && connect({ connector: injected })}
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
