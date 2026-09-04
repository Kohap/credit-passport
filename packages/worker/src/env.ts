import { z } from "zod";

const envSchema = z.object({
  SEPOLIA_RPC_URL: z.string().url(),
  CREDITCOIN_RPC_URL: z
    .string()
    .url()
    .default("https://rpc.cc3-testnet.creditcoin.network"),
  PROOF_BUILDER_URL: z
    .string()
    .url()
    .default("https://prover.cc3-testnet.creditcoin.network"),
  SEPOLIA_CHAIN_KEY: z.coerce.number().int().default(1),
  CREDITCOIN_PASSPORT_ASC: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
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
