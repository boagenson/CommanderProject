"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

/** Route-level error boundary: a bad card or a failed request never blanks the app. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={<TriangleAlert />}
      title="Something went wrong on this page"
      action={
        <div className="flex gap-2">
          <Button variant="primary" onClick={reset}>
            <RotateCcw /> Try again
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Go to dashboard</Link>
          </Button>
        </div>
      }
    >
      Your decks are safe in this browser. {error.message ? `Details: ${error.message}` : "Reloading usually fixes it."}
    </EmptyState>
  );
}
