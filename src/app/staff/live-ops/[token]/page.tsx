import type { Metadata } from "next";
import SharedLiveOps from "@/components/opsShare/SharedLiveOps";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Live Ops · Staff access",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function StaffLiveOpsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedLiveOps token={token} />;
}
