import { NextResponse } from "next/server";
import { JsonRpcProvider, isHexString } from "ethers";
import { chainInfo, proofProvider } from "@gluwa/usc-sdk";
import { z } from "zod";
import { PROOF_BUILDER_URL, SEPOLIA_CHAIN_KEY } from "@/config/networks";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  txHash: z.string().refine((v) => isHexString(v, 32), "invalid tx hash"),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const { txHash } = bodySchema.parse(json);

    const sepoliaRpc =
      process.env.SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
      "https://ethereum-sepolia-rpc.publicnode.com";
    const creditcoinRpc =
      process.env.CREDITCOIN_RPC_URL ?? "https://rpc.cc3-testnet.creditcoin.network";
    const proofUrl = process.env.PROOF_BUILDER_URL ?? PROOF_BUILDER_URL;
    const chainKey = Number(process.env.SEPOLIA_CHAIN_KEY ?? SEPOLIA_CHAIN_KEY);

    const source = new JsonRpcProvider(sepoliaRpc);
    const creditcoin = new JsonRpcProvider(creditcoinRpc);
    const info = new chainInfo.PrecompileChainInfoProvider(
      creditcoin as unknown as ConstructorParameters<typeof chainInfo.PrecompileChainInfoProvider>[0],
    );

    const supported = await info.getSupportedChains();
    if (!supported.some((c) => c.chainKey === chainKey)) {
      return NextResponse.json(
        { error: `Sepolia chainKey ${chainKey} not in getSupportedChains()` },
        { status: 502 },
      );
    }

    const receipt = await source.waitForTransaction(txHash, 1, 180_000);
    if (!receipt?.blockNumber) {
      return NextResponse.json({ error: "Sepolia tx not mined" }, { status: 400 });
    }
    if (receipt.status !== 1) {
      return NextResponse.json({ error: "Sepolia tx failed (status != 1)" }, { status: 400 });
    }

    const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, proofUrl, 5_000);
    await proofBuilder.waitUntilHeightAttested(chainKey, receipt.blockNumber, 15_000, 1_200_000);

    let result = await proofBuilder.getProof(txHash);
    if (!result.success || !result.data) {
      await new Promise((r) => setTimeout(r, 10_000));
      result = await proofBuilder.getProof(txHash);
    }
    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          error: result.error ?? "proof generation failed",
          blockNumber: receipt.blockNumber,
        },
        { status: 502 },
      );
    }

    const data = result.data;
    return NextResponse.json({
      sepoliaTxHash: txHash,
      sepoliaBlockNumber: receipt.blockNumber,
      chainKey: data.chainKey,
      headerNumber: data.headerNumber,
      txIndex: data.txIndex,
      merkleRoot: data.merkleProof.root,
      siblings: data.merkleProof.siblings.map((s) => ({
        hash: s.hash,
        isLeft: s.isLeft,
      })),
      lowerEndpointDigest: data.continuityProof.lowerEndpointDigest,
      continuityRoots: data.continuityProof.roots,
      txBytes: data.txBytes,
      cached: data.cached,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
