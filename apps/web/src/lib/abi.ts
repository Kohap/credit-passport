export const mockUsdAbi = [
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "error",
    name: "FaucetCooldown",
    inputs: [{ name: "nextMintAt", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "lastFaucetAt",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const mockMarketAbi = [
  {
    type: "function",
    name: "openLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "principal", type: "uint256" }],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "loanId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "loans",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      { name: "borrower", type: "address" },
      { name: "principal", type: "uint256" },
      { name: "debt", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "LoanRepaid",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "loanId", type: "uint256", indexed: true },
      { name: "amountRepaid", type: "uint256", indexed: false },
      { name: "remainingDebt", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanOpened",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "loanId", type: "uint256", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
] as const;

export const passportAscAbi = [
  {
    type: "function",
    name: "proveRepayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "chainKey", type: "uint64" },
      { name: "blockHeight", type: "uint64" },
      { name: "encodedTransaction", type: "bytes" },
      { name: "merkleRoot", type: "bytes32" },
      {
        name: "siblings",
        type: "tuple[]",
        components: [
          { name: "hash", type: "bytes32" },
          { name: "isLeft", type: "bool" },
        ],
      },
      { name: "lowerEndpointDigest", type: "bytes32" },
      { name: "continuityRoots", type: "bytes32[]" },
      { name: "claimBorrower", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "RepaymentVerified",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "loanId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "txKey", type: "bytes32", indexed: false },
      { name: "newScore", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PassportUpdated",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "score", type: "uint256", indexed: false },
      { name: "cap", type: "uint256", indexed: false },
    ],
  },
] as const;

export const creditScoreAbi = [
  {
    type: "function",
    name: "scoreOf",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "repaymentCountOf",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const creditLineAbi = [
  {
    type: "function",
    name: "borrowCapOf",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "available",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "debtOf",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

export const passportNftAbi = [
  {
    type: "function",
    name: "tokenOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "scoreOfToken",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const agentJobEscrowAbi = [
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "briefHash", type: "bytes32" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitWork",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "resultHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "approveCompletion",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelBeforeSubmission",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "jobs",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "client", type: "address" },
      { name: "agent", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "briefHash", type: "bytes32" },
      { name: "resultHash", type: "bytes32" },
      { name: "state", type: "uint8" },
    ],
  },
  {
    type: "event",
    name: "JobFunded",
    inputs: [
      { name: "client", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "jobId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "briefHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "JobCompleted",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "jobId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "resultHash", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
] as const;

export const agentPassportAscAbi = [
  {
    type: "function",
    name: "proveJobCompletion",
    stateMutability: "nonpayable",
    inputs: [
      { name: "chainKey", type: "uint64" },
      { name: "blockHeight", type: "uint64" },
      { name: "encodedTransaction", type: "bytes" },
      { name: "merkleRoot", type: "bytes32" },
      {
        name: "siblings",
        type: "tuple[]",
        components: [
          { name: "hash", type: "bytes32" },
          { name: "isLeft", type: "bool" },
        ],
      },
      { name: "lowerEndpointDigest", type: "bytes32" },
      { name: "continuityRoots", type: "bytes32[]" },
      { name: "claimAgent", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "completedJobsOf",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "settledVolumeOf",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const agentPassportNftAbi = [
  {
    type: "function",
    name: "tokenOf",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "completedJobsOfToken",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "settledVolumeOfToken",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
