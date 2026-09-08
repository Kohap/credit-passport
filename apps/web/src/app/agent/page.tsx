import { AgentDesk } from "@/components/AgentDesk";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Passport | Credit Passport",
  description: "Turn client-approved, escrow-settled agent work into a portable record on Creditcoin.",
};

export default function AgentPage() {
  return <AgentDesk />;
}
