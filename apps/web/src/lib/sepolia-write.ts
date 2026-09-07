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

type RequestFn = (args: {
  method: string;
  params?: unknown[];
}) => Promise<unknown>;

function injectedRequest(): RequestFn {
  const eth = (window as unknown as { ethereum?: { request: RequestFn } }).ethereum;
  if (!eth?.request) {
    throw new Error(
      "No injected wallet. Open this desk in a browser with Rabby or MetaMask.",
    );
  }
  return eth.request.bind(eth);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function sendPopulatedWrite(args: {
  publicClient?: PublicClient;
  account: Address;
  abi: Abi;
  address: Address;
  functionName: string;
  functionArgs?: readonly unknown[];
  chainId: number;
  request?: RequestFn;
}): Promise<Hex> {
  const request = args.request ?? injectedRequest();
  const data = encodeFunctionData({
    abi: args.abi,
    functionName: args.functionName,
    args: args.functionArgs,
  } as never);

  const current = await withTimeout(
    request({ method: "eth_chainId" }),
    8_000,
    "Wallet did not report a network. Unlock Rabby, then retry.",
  );
  const currentId = Number(current);
  if (currentId !== args.chainId) {
    try {
      await withTimeout(
        request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: toHex(args.chainId) }],
        }),
        25_000,
        "Wallet did not switch to Sepolia. Switch network in Rabby, then retry.",
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      if (/4902|Unrecognized chain|not added/i.test(text)) {
        throw new Error("Add Sepolia in the wallet, then retry Faucet mUSD.");
      }
      throw err;
    }
  }

  const hash = await withTimeout(
    request({
      method: "eth_sendTransaction",
      params: [
        {
          from: args.account,
          to: args.address,
          data,
        },
      ],
    }),
    120_000,
    "Wallet did not confirm. Click Sign in Rabby (that submits the mint), then retry if it stays open.",
  );

  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error("Wallet did not return a transaction hash.");
  }
  return hash as Hex;
}
