import {
  encodeFunctionData,
  formatEther,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

function toHex(value: bigint | number): Hex {
  return `0x${BigInt(value).toString(16)}`;
}

export type WalletRequest = (args: {
  method: string;
  params?: unknown[];
}) => Promise<unknown>;

export type WalletChain = {
  id: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: readonly string[];
  blockExplorerUrls?: readonly string[];
};

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

function rpcErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function walletError(error: unknown, network: WalletChain): Error {
  const code = rpcErrorCode(error);
  if (code === 4001) return new Error("Wallet request was rejected.");
  if (code === -32002) {
    return new Error("A wallet request is already open. Finish it in Rabby, then retry.");
  }
  const message = errorText(error);
  if (/insufficient funds|insufficient balance/i.test(message)) {
    return new Error(`Not enough ${network.nativeCurrency.symbol} for network gas. Fund this wallet, then retry.`);
  }
  return new Error(message);
}

export async function addWalletChain(request: WalletRequest, chain: WalletChain): Promise<void> {
  await withTimeout(
    request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: toHex(chain.id),
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [...chain.rpcUrls],
          ...(chain.blockExplorerUrls?.length
            ? { blockExplorerUrls: [...chain.blockExplorerUrls] }
            : {}),
        },
      ],
    }),
    25_000,
    `Wallet did not add ${chain.name}. Unlock Rabby, then retry.`,
  );
}

async function switchWalletChain(request: WalletRequest, chain: WalletChain): Promise<void> {
  try {
    await withTimeout(
      request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHex(chain.id) }],
      }),
      25_000,
      `Wallet did not switch to ${chain.name}. Switch network in Rabby, then retry.`,
    );
  } catch (error) {
    if (rpcErrorCode(error) !== 4902 && !/4902|Unrecognized chain|not added/i.test(errorText(error))) {
      throw walletError(error, chain);
    }
    try {
      await addWalletChain(request, chain);
      await withTimeout(
        request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: toHex(chain.id) }],
        }),
        25_000,
        `Wallet did not switch to ${chain.name}. Switch network in Rabby, then retry.`,
      );
    } catch (addError) {
      throw walletError(addError, chain);
    }
  }
}

async function assertSelectedAccount(request: WalletRequest, account: Address): Promise<void> {
  const accounts = await withTimeout(
    request({ method: "eth_accounts" }),
    8_000,
    "Wallet did not report the connected account. Unlock the selected wallet, then retry.",
  );
  if (
    !Array.isArray(accounts) ||
    !accounts.some((value) => typeof value === "string" && value.toLowerCase() === account.toLowerCase())
  ) {
    throw new Error("The selected wallet account changed. Reconnect the wallet, then retry.");
  }
}

export async function sendPopulatedWrite(args: {
  publicClient: PublicClient;
  account: Address;
  abi: Abi;
  address: Address;
  functionName: string;
  functionArgs?: readonly unknown[];
  chain: WalletChain;
  request: WalletRequest;
}): Promise<Hex> {
  const data = encodeFunctionData({
    abi: args.abi,
    functionName: args.functionName,
    args: args.functionArgs,
  } as never);

  const current = await withTimeout(
    args.request({ method: "eth_chainId" }),
    8_000,
    "Wallet did not report a network. Unlock Rabby, then retry.",
  );
  if (Number(current) !== args.chain.id) {
    await switchWalletChain(args.request, args.chain);
  }

  await assertSelectedAccount(args.request, args.account);

  let gas: bigint;
  try {
    gas = await withTimeout(
      args.publicClient.estimateGas({
        account: args.account,
        to: args.address,
        data,
      }),
      15_000,
      `Could not estimate gas on ${args.chain.name}. Check the action and retry.`,
    );
  } catch (error) {
    throw walletError(error, args.chain);
  }
  const gasLimit = gas + gas / 5n;

  try {
    const [balance, gasPrice] = await Promise.all([
      args.publicClient.getBalance({ address: args.account }),
      args.publicClient.getGasPrice(),
    ]);
    if (balance < gasLimit * gasPrice) {
      throw new Error(
        `Not enough ${args.chain.nativeCurrency.symbol} for network gas. Need about ${formatEther(gasLimit * gasPrice)} ${args.chain.nativeCurrency.symbol}.`,
      );
    }
  } catch (error) {
    const message = errorText(error);
    if (/Not enough .* for network gas/i.test(message)) throw error;
  }

  let hash: unknown;
  try {
    hash = await withTimeout(
      args.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: args.account,
            to: args.address,
            data,
            gas: toHex(gasLimit),
          },
        ],
      }),
      120_000,
      "Wallet did not confirm. Click Sign in Rabby (that submits the transaction), then retry if it stays open.",
    );
  } catch (error) {
    throw walletError(error, args.chain);
  }

  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error("Wallet did not return a transaction hash.");
  }
  return hash as Hex;
}
