/// <reference types="next" />
/// <reference types="next/image-types/global" />

interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
}
