import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function run(scenario, checkOnly = true, collateral = "DAI") {
  const root = mkdtempSync(join(tmpdir(), "aave-preflight-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "bin"));
    copyFileSync(new URL("./aave-sepolia-e2e.sh", import.meta.url), join(root, "scripts/aave-sepolia-e2e.sh"));
    writeFileSync(join(root, ".env"), `SEPOLIA_RPC_URL=https://unused.invalid\nSEPOLIA_PRIVATE_KEY=0x${"0".repeat(64)}\n`);
    writeFileSync(join(root, "bin/cast"), `#!${process.execPath}
const { appendFileSync } = require("node:fs");
const a = process.argv.slice(2), scenario = process.env.SCENARIO;
const reply = value => { console.log(value); process.exit(0); };
if (a[0] === "wallet") reply("0x0000000000000000000000000000000000000001");
if (a[0] === "chain-id") reply(scenario === "wrong-chain" ? "1" : "11155111");
if (a[0] === "call" && a[2].startsWith("decimals")) reply(scenario === "wrong-decimals" ? "8" : a[1].toLowerCase().startsWith("0x94a9") ? "6" : "18");
if (a[0] === "call" && a[2].startsWith("getUserAccountData")) reply(JSON.stringify(["0",scenario === "existing-debt" ? "1" : "0","0","0","0","0"]));
if (a[0] === "call" && a[2].startsWith("supply")) {
  if (scenario === "full") { console.error("execution reverted: 51"); process.exit(1); }
  if (scenario === "rpc-error") { console.error("RPC timed out"); process.exit(1); }
  if (scenario === "allowance") { console.error("ERC20: insufficient allowance"); process.exit(1); }
  reply("0x");
}
if (a[0] === "send") {
  appendFileSync(process.env.SEND_LOG, JSON.stringify(a.slice(0, a.indexOf("--rpc-url"))) + "\\n");
  reply(JSON.stringify({status:scenario === "send-revert" && a[2].startsWith("supply") ? "0x0" : "0x1",transactionHash:"0x"+"1".repeat(64)}));
}
console.error("Unexpected mock command", a[0]); process.exit(1);
`, { mode: 0o755 });
    const log = join(root, "sends.jsonl");
    const result = spawnSync("bash", [join(root, "scripts/aave-sepolia-e2e.sh"), "--collateral", collateral, ...(checkOnly ? ["--check"] : [])], {
      env: { ...process.env, SCENARIO: scenario, SEND_LOG: log, PATH: `${join(root, "bin")}:${process.env.PATH}` },
      encoding: "utf8", timeout: 15000,
    });
    assert.equal(result.error, undefined);
    const sends = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
    return { ...result, sends };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("preflight is read-only on success, known funding errors, and failures", () => {
  for (const [scenario, status] of [["ready",0],["allowance",0],["full",2],["rpc-error",1],["wrong-chain",1],["wrong-decimals",1],["existing-debt",1]]) {
    const result = run(scenario);
    assert.equal(result.status, status, `${scenario}: ${result.stderr}`);
    assert.equal(result.sends.length, 0, scenario);
  }
});

test("LINK uses the official asset and fixed 10-token collateral amount", () => {
  const result = run("ready", false, "LINK");
  assert.equal(result.status, 0, result.stderr);
  const supply = result.sends.find(a => a[2].startsWith("supply"));
  assert.equal(supply[3], "0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5");
  assert.equal(supply[4], "10000000000000000000");
  assert.equal(run("ready", false, "OTHER").sends.length, 0);
});

test("unknown preflight errors also block write-enabled execution", () => {
  const result = run("rpc-error", false);
  assert.equal(result.status, 1);
  assert.equal(result.sends.length, 0);
});

test("a reverted supply stops before borrowing", () => {
  const result = run("send-revert", false);
  assert.equal(result.status, 1);
  assert.equal(result.sends.length, 4);
  assert.equal(result.sends.some(a => a[2].startsWith("borrow")), false);
});

test("successful test flow uses full repayment and clears remaining allowance", () => {
  const result = run("ready", false);
  assert.equal(result.status, 0, result.stderr);
  const repayment = result.sends.find(a => a[2].startsWith("repay"));
  assert.equal(repayment[4], `0x${"f".repeat(64)}`);
  assert.equal(result.sends.at(-1)[2], "approve(address,uint256)");
  assert.equal(result.sends.at(-1)[4], "0");
});
