import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({
    meta: [
      { title: "Privacy — HangTime" },
      {
        name: "description",
        content: "How HangTime handles jump videos, accounts, and HangTime Plus data.",
      },
    ],
  }),
});

function Privacy() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        HangTime
      </p>
      <h1 className="font-display mt-1 text-4xl font-extrabold tracking-wide sm:text-5xl">
        Privacy
      </h1>
      <p className="mt-2 text-sm text-muted">Last updated September 18, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-fg">
        <p>
          HangTime is a vertical-jump tool at hangtimeplus.com. This page
          explains what we collect, what stays on your device, and how HangTime
          Plus accounts work.
        </p>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Jump videos
          </h2>
          <p>
            When you measure a jump, the video is processed in your browser. We
            do not upload the clip to HangTime servers. If you close the tab,
            that video is gone from HangTime. We never see the footage.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Free HangTime
          </h2>
          <p>
            You can measure a vertical without creating an account. We do not
            store your name, email, or jump results unless you sign in to
            HangTime Plus and save them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            HangTime Plus accounts
          </h2>
          <p>
            Plus uses Google sign-in. Google sends us the email, name, and
            profile photo you choose to share. We store that so you can come
            back to your roster.
          </p>
          <p>
            If you log jumps, we store what you save: player names you type,
            jump height, flight time, capture rate, and the date. We do not
            store the video with those results.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Payments
          </h2>
          <p>
            The $10 founding lifetime checkout is handled by Stripe. Card
            numbers go to Stripe, not to HangTime. Stripe may keep payment
            records under their own privacy policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Ads
          </h2>
          <p>
            The free tool may show ads (including Google AdSense). Google may
            use cookies or a device identifier to serve those ads. HangTime Plus
            members do not see those house/ad slots. See Google's ads
            settings if you want to limit ad personalization.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Hosting
          </h2>
          <p>
            The site runs on Vercel. Plus account and roster data is stored in
            a Postgres database (Neon). Those providers process data to run the
            product, not to sell your jump log.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Cookies
          </h2>
          <p>
            Signed-in sessions use a secure cookie so HangTime Plus stays
            unlocked. Private / Incognito windows often drop that cookie when
            you close the tab.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Kids and rosters
          </h2>
          <p>
            HangTime is not directed at children under 13. Coaches who log
            players are responsible for the names they type and for having
            permission to keep those records. Use first names or jersey numbers
            if you do not want full names stored.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            What we don't do
          </h2>
          <p>
            We do not sell your information. We do not use jump videos for
            training AI. We do not post your roster publicly.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Deleting your data
          </h2>
          <p>
            To close a HangTime Plus account or delete a roster, email us from
            the same Google address you signed in with. We will delete the
            account, player names, and saved jumps tied to it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-wide">
            Contact
          </h2>
          <p>
            HangTime / HangTime Plus — hangtimeplus.com. Privacy questions:
            use the Google account you sign in with and reach us through the
            site, or the support email listed on HangTime's Google sign-in
            screen.
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm text-muted">
        <Link to="/" className="text-primary hover:underline">
          Back to HangTime
        </Link>
      </p>
    </main>
  );
}
