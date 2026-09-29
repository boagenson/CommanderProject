import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/feedback";
import { UpgradeWorkshop } from "@/components/upgrade/upgrade-workshop";

export const metadata: Metadata = { title: "Upgrade Workshop" };

export default function UpgradePage() {
  return (
    <>
      <PageHeader
        eyebrow="Upgrade Workshop"
        title="Plan your upgrades"
        description="Get budget-aware swap suggestions that fit your deck's themes. Review each one, preview the result, and commit only what you approve."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <UpgradeWorkshop />
      </Suspense>
    </>
  );
}
