import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <EmptyState
      icon={<Compass />}
      title="That page doesn't exist"
      action={
        <Button asChild variant="primary">
          <Link href="/">Back to dashboard</Link>
        </Button>
      }
    >
      The link may be old, or the deck it pointed to was deleted.
    </EmptyState>
  );
}
