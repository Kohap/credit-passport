import { JsonRpcProvider, isHexString } from "ethers";
import { chainInfo, proofProvider } from "@gluwa/usc-sdk";
import type { Hex } from "viem";
import {
  CREDITCOIN_RPC,
  PROOF_BUILDER_URL,
  SEPOLIA_CHAIN_KEY,
} from "@/config/networks";

export type ProofPayload = {
  sepoliaTxHash: string;
  sepoliaBlockNumber: number;
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  merkleRoot: Hex;
  siblings: { hash: Hex; isLeft: boolean }[];
  lowerEndpointDigest: Hex;
  continuityRoots: Hex[];
  txBytes: Hex;
  cached: boolean;
};

/**
 * Build an Attestcoin proof in the browser (GitHub Pages has no Node API routes).
 * Calls public Sepolia RPC + CC3 RPC + proof builder — may take minutes.
 */
export async function buildProof(
  txHash: string,
  onStatus?: (msg: string) => void,
): Promise<ProofPayload> {
  if (!isHexString(txHash, 32)) {
    throw new Error("invalid Sepolia tx hash");
  }

  const sepoliaRpc =
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
    "https://ethereum-sepolia-rpc.publicnode.com";
  const creditcoinRpc =
    process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL ?? CREDITCOIN_RPC;
  const proofUrl =
    process.env.NEXT_PUBLIC_PROOF_BUILDER_URL ?? PROOF_BUILDER_URL;
  const chainKey = Number(
    process.env.NEXT_PUBLIC_SEPOLIA_CHAIN_KEY ?? SEPOLIA_CHAIN_KEY,
  );

  const source = new JsonRpcProvider(sepoliaRpc);
  const creditcoin = new JsonRpcProvider(creditcoinRpc);
  const info = new chainInfo.PrecompileChainInfoProvider(
    creditcoin as unknown as ConstructorParameters<
      typeof chainInfo.PrecompileChainInfoProvider
    >[0],
  );

  onStatus?.("Checking Attestcoin supported chains…");
  const supported = await info.getSupportedChains();
  if (!supported.some((c) => c.chainKey === chainKey)) {
    throw new Error(`Sepolia chainKey ${chainKey} not in getSupportedChains()`);
  }

  onStatus?.("Confirming Sepolia transaction…");
  const receipt = await source.waitForTransaction(txHash, 1, 180_000);
  if (!receipt?.blockNumber) {
    throw new Error("Sepolia tx not mined");
  }
  if (receipt.status !== 1) {
    throw new Error("Sepolia tx failed (status != 1)");
  }

  onStatus?.(
    `Waiting for attestation of Sepolia block ${receipt.blockNumber} (can take minutes)…`,
  );
  const proofBuilder = new proofProvider.service.ProofBuilder(
    chainKey,
    proofUrl,
    5_000,
  );
  await proofBuilder.waitUntilHeightAttested(
    chainKey,
    receipt.blockNumber,
    15_000,
    1_200_000,
  );

  onStatus?.("Generating Merkle + continuity proof…");
  let result = await proofBuilder.getProof(txHash);
  if (!result.success || !result.data) {
    await new Promise((r) => setTimeout(r, 10_000));
    result = await proofBuilder.getProof(txHash);
  }
  if (!result.success || !result.data) {
    throw new Error(result.error ?? "proof generation failed");
  }

  const data = result.data;
  return {
    sepoliaTxHash: txHash,
    sepoliaBlockNumber: receipt.blockNumber,
    chainKey: data.chainKey,
    headerNumber: data.headerNumber,
    txIndex: data.txIndex,
    merkleRoot: data.merkleProof.root as Hex,
    siblings: data.merkleProof.siblings.map((s) => ({
      hash: s.hash as Hex,
      isLeft: s.isLeft,
    })),
    lowerEndpointDigest: data.continuityProof.lowerEndpointDigest as Hex,
    continuityRoots: data.continuityProof.roots as Hex[],
    txBytes: data.txBytes as Hex,
    cached: Boolean(data.cached),
  };
}
