import {
  encodeFunctionData,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

function toHex(value: bigint | number): Hex {
  return `0x${BigInt(value).toString(16)}`;
}

type Injected = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function injectedRequest(): Injected["request"] {
  const eth = (window as unknown as { ethereum?: Injected }).ethereum;
  if (!eth?.request) {
    throw new Error(
      "No injected wallet. Open this desk in a browser with MetaMask.",
    );
  }
  return eth.request.bind(eth);
}

export async function sendPopulatedWrite(args: {
  publicClient: PublicClient;
  account: Address;
  abi: Abi;
  address: Address;
  functionName: string;
  functionArgs?: readonly unknown[];
  chainId: number;
}): Promise<Hex> {
  const request = injectedRequest();
  const data = encodeFunctionData({
    abi: args.abi,
    functionName: args.functionName,
    args: args.functionArgs,
  } as never);

  const [balance, nonce, fees] = await Promise.all([
    args.publicClient.getBalance({ address: args.account }),
    args.publicClient.getTransactionCount({
      address: args.account,
      blockTag: "pending",
    }),
    args.publicClient.estimateFeesPerGas(),
  ]);

  if (balance === 0n) {
    throw new Error(
      "This wallet has 0 Sepolia ETH, so the faucet cannot pay gas. Get a little Sepolia ETH, then retry.",
    );
  }

  let gas: bigint;
  try {
    gas = await args.publicClient.estimateGas({
      account: args.account,
      to: args.address,
      data,
    });
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    if (/insufficient funds|gas required exceeds/i.test(text)) {
      throw new Error(
        "Not enough Sepolia ETH for gas. Fund the wallet on Sepolia, then retry.",
      );
    }
    throw err;
  }

  const gasLimit = gas < 21_000n ? 21_000n : (gas * 12n) / 10n;
  const maxFee = fees.maxFeePerGas ?? fees.gasPrice ?? 1_000_000_000n;
  const maxPrio = fees.maxPriorityFeePerGas ?? 1_000_000n;
  if (balance < gasLimit * maxFee) {
    throw new Error(
      "Not enough Sepolia ETH for gas. Fund the wallet on Sepolia, then retry.",
    );
  }

  const tx = {
    from: args.account,
    to: args.address,
    data,
    nonce: toHex(nonce),
    gas: toHex(gasLimit),
    chainId: toHex(args.chainId),
    type: "0x2",
    maxFeePerGas: toHex(maxFee),
    maxPriorityFeePerGas: toHex(maxPrio),
  };

  let hash: unknown;
  try {
    hash = await request({ method: "eth_sendTransaction", params: [tx] });
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    if (/rejected|denied|4001/i.test(text)) throw err;
    hash = await request({
      method: "eth_sendTransaction",
      params: [
        {
          from: tx.from,
          to: tx.to,
          data: tx.data,
          nonce: tx.nonce,
          gas: tx.gas,
          chainId: tx.chainId,
          gasPrice: toHex(maxFee),
        },
      ],
    });
  }

  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error("Wallet did not return a transaction hash.");
  }
  return hash as Hex;
}
