import { z } from "zod";

const ASC_DEFAULT = "0x5123CdFd395414FcB6c5b8bc10A0843882EfD277";
const AGENT_ASC_DEFAULT = "0x965bdfEcD8ac53885d1d899E99814Af2752E16C8";

/** Empty / whitespace env values → undefined so Zod defaults apply. */
function emptyToUndef(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? undefined : t;
}

const address40 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid address");

const httpsUrl = z.string().url().refine(
  (value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  },
  "Must be an HTTPS URL without credentials",
);

const privateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid private key");

const envSchema = z.object({
  SEPOLIA_RPC_URL: httpsUrl,
  CREDITCOIN_RPC_URL: z.preprocess(
    emptyToUndef,
    httpsUrl.default("https://rpc.cc3-testnet.creditcoin.network"),
  ),
  PROOF_BUILDER_URL: z.preprocess(
    emptyToUndef,
    httpsUrl.default("https://prover.cc3-testnet.creditcoin.network"),
  ),
  SEPOLIA_CHAIN_KEY: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).default(1),
  CREDITCOIN_PASSPORT_ASC: z.preprocess(
    emptyToUndef,
    address40.default(ASC_DEFAULT),
  ),
  CREDITCOIN_AGENT_PASSPORT_ASC: z.preprocess(
    emptyToUndef,
    address40.default(AGENT_ASC_DEFAULT),
  ),
  CREDITCOIN_AAVE_PASSPORT_ASC: z.preprocess(emptyToUndef, address40.optional()),
  CREDITCOIN_PRIVATE_KEY: z.preprocess(emptyToUndef, privateKey.optional()),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${detail}`);
  }
  return parsed.data;
}
