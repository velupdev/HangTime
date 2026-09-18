import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({
    meta: [
      { title: "Terms — HangTime" },
      {
        name: "description",
        content: "Terms of use for HangTime and HangTime Plus.",
      },
    ],
  }),
});

function Terms() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        HangTime
      </p>
      <h1 className="font-display mt-1 text-4xl font-extrabold tracking-wide sm:text-5xl">
        Terms
      </h1>
      <p className="mt-2 text-sm text-muted">Last updated September 18, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-fg">
        <p>
          These terms cover hangtimeplus.com — the free HangTime jump tool and
          HangTime Plus. By using the site you agree to them. Questions:{" "}
          <a href="mailto:joey@velup.dev" className="text-primary hover:underline">
            joey@velup.dev
          </a>
          .
        </p>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            The free tool
          </h2>
          <p>
            HangTime estimates vertical jump from flight time in a video you
            pick. You mark takeoff and landing. Accuracy depends on the clip,
            frame rate, and those marks. It is a training aid, not a lab test,
            not medical advice, and not a tryout official.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            HangTime Plus
          </h2>
          <p>
            Plus is an optional paid layer: save jumps to a name, track a
            roster over time. The founding offer is $10 once, limited to the
            first 100 members. After that we may change what Plus costs or
            includes. Measuring on the home page stays free.
          </p>
          <p>
            Payments go through Stripe. Founding lifetime means that HangTime
            Plus roster features stay unlocked for that Google account for as
            long as we run this product — not a guarantee the site exists
            forever.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Your account
          </h2>
          <p>
            You sign in with Google. You are responsible for that Google
            account and for names you type on a roster. Do not log people
            without permission. HangTime is not for children under 13 as the
            account holder.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Videos
          </h2>
          <p>
            Clips stay in your browser for the measurement. Do not upload
            footage you do not have the right to use. We do not claim ownership
            of your videos or jump results.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Ads
          </h2>
          <p>
            The free tool may show ads. Plus hides those slots. Ads are
            provided by third parties (including Google) under their own terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Acceptable use
          </h2>
          <p>
            Don't abuse the site, scrape it, break sign-in, or use it to
            harass anyone. We can close a Plus account that is used that way
            and refund is at our discretion if the $10 already went through.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            The site as-is
          </h2>
          <p>
            HangTime is provided as-is. Jump numbers can be wrong. Hosting can
            go down. We are not liable for lost roster data, a missed cut, or
            anything that happens after you use a number from the tool. If the
            law where you live does not allow that limit, it applies only as
            far as it can.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Changes
          </h2>
          <p>
            We may update these terms. The date at the top is the latest
            version. If you keep using HangTime after a change, that is
            acceptance of the new terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Contact
          </h2>
          <p>
            Joey —{" "}
            <a href="mailto:joey@velup.dev" className="text-primary hover:underline">
              joey@velup.dev
            </a>
            . HangTime / HangTime Plus, hangtimeplus.com.
          </p>
        </section>
      </div>

      <p className="mt-10 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
        <Link to="/" className="text-primary hover:underline">
          Back to HangTime
        </Link>
        <Link to="/privacy" className="hover:underline">
          Privacy
        </Link>
      </p>
    </main>
  );
}
