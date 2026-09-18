import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getPlusOffer, unlockPlus, type PlusOffer } from "@/lib/plus/server";
import { plusCheckoutUrl, STRIPE_TEST_MODE } from "@/lib/plus/stripe";

function returnedFromStripe(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("checkout") === "success";
}

export function PlusPaywall({ onUnlocked }: { onUnlocked: () => void }) {
  const user = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [fromStripe, setFromStripe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<PlusOffer | null>(null);

  useEffect(() => {
    setFromStripe(returnedFromStripe());
  }, []);

  useEffect(() => {
    void getPlusOffer()
      .then(setOffer)
      .catch(() =>
        setOffer({ sold: 0, cap: 100, remaining: 100, lifetimeOpen: true }),
      );
  }, []);

  useEffect(() => {
    if (!fromStripe || !user?.id) return;
    void confirmPaid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromStripe, user?.id]);

  const lifetimeOpen = offer?.lifetimeOpen ?? true;
  const remaining = offer?.remaining ?? 100;

  function startCheckout() {
    if (!user?.id) {
      setError("Sign in first, then pay.");
      return;
    }
    if (!lifetimeOpen) {
      setError("The founding lifetime offer is full.");
      return;
    }
    window.location.href = plusCheckoutUrl(user.id, "lifetime");
  }

  async function confirmPaid() {
    setBusy(true);
    setError(null);
    try {
      await unlockPlus();
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock Plus.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-lg bg-surface px-5 py-8 shadow-[var(--shadow-border)]">
      <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
        {lifetimeOpen ? "Founding lifetime" : "Founding offer"}
      </p>
      <h1 className="font-display mt-1 text-4xl font-extrabold tracking-wide">
        HangTime Plus
      </h1>
      {lifetimeOpen ? (
        <>
          <p className="mt-2 font-display text-5xl font-extrabold tabular-nums text-primary">
            $10
          </p>
          <p className="mt-1 text-sm text-muted">
            Once. {remaining} of 100 founding spots left.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          The first 100 lifetime spots are full. HangTime stays free to
          measure. We'll open more Plus seats when we know what coaches
          actually need.
        </p>
      )}
      <ul className="mt-6 space-y-2 text-sm text-fg">
        <li>Log every jump and see progress over a season</li>
        <li>One athlete, or a full roster of players</li>
        <li>Save a measurement from HangTime straight to a name</li>
        <li>Measuring verticals on the home page stays free</li>
      </ul>
      {lifetimeOpen ? (
        <Button type="button" variant="primary" className="mt-6 w-full" onClick={startCheckout}>
          Pay $10 lifetime with Stripe
        </Button>
      ) : null}
      {lifetimeOpen && (fromStripe || STRIPE_TEST_MODE) ? (
        <Button type="button" className="mt-2 w-full" disabled={busy} onClick={() => void confirmPaid()}>
          {busy ? "Unlocking…" : "I already paid — open portal"}
        </Button>
      ) : null}
      {error ? <p className="mt-3 text-sm text-fg">{error}</p> : null}
      <p className="mt-4 text-xs text-muted">
        Stripe takes the $10 once. Founding members keep Plus for life.
      </p>
    </section>
  );
}
