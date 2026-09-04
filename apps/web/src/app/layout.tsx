import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Credit Passport",
  description:
    "Prove a Sepolia repayment on Creditcoin with Attestcoin: unlock a credit line and mint a soulbound Passport.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plexSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
