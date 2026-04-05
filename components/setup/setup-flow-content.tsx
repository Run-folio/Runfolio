import Link from "next/link";
import type { OnboardingProgress } from "@/lib/onboarding-progress";
import type { PersistenceReadiness } from "@/lib/persistence-readiness";
import { SetupCallout } from "@/components/setup/setup-callout";
import { SetupStepper } from "@/components/setup/setup-stepper";
import { SetupSyncActions } from "@/components/setup/setup-sync-actions";
import { buildSetupUrl } from "@/lib/setup-url";

type Props = {
  persistence: PersistenceReadiness;
  progress: OnboardingProgress;
  safeNext: string;
};

export function SetupFlowContent({ persistence, progress, safeNext }: Props) {
  const { stage, steps, primaryCta, secondaryCta, stravaOAuthConfigured } = progress;

  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-white/[0.06] bg-[#070a10] p-6 md:p-8">
        <SetupStepper steps={steps} />
        <p className="type-meta mx-auto mt-6 max-w-xl text-center text-sm text-white/45">
          A few short steps — then bucket goals, Strava imports, and My Races all stay in sync with your
          public story.
        </p>
      </div>

      {stage === "env" ? (
        <SetupCallout
          variant="attention"
          eyebrow="Before we start"
          title="Get Runfolio talking to the cloud"
          primary={primaryCta ? { href: primaryCta.href, label: primaryCta.label } : undefined}
          secondary={
            secondaryCta
              ? { href: secondaryCta.href, label: secondaryCta.label, external: secondaryCta.href.startsWith("http") }
              : undefined
          }
        >
          <p>
            {persistence.message ||
              "Add your Supabase URL and anon key, run migrations, and restart the app — then your saves, matches, and Strava sync are real."}
          </p>
          {progress.persistenceIssue === "demo" ? (
            <p className="text-amber-100/85">
              Demo mode is on. Turn off <code className="rounded bg-black/35 px-1">RUNFOLIO_OFFLINE_DEMO</code> when you
              want a live portfolio.
            </p>
          ) : null}
        </SetupCallout>
      ) : null}

      {stage === "sign_in" ? (
        <SetupCallout
          eyebrow="Step 1"
          title="Sign in — your races belong to you"
          primary={
            primaryCta
              ? { href: primaryCta.href, label: primaryCta.label }
              : { href: `/auth/login?next=${encodeURIComponent(buildSetupUrl(safeNext))}`, label: "Sign in" }
          }
          secondary={
            secondaryCta
              ? { href: secondaryCta.href, label: secondaryCta.label }
              : { href: "/races/new", label: "Add a race manually" }
          }
        >
          <p>
            Runfolio saves goals, Strava links, and finished races to <strong className="text-white/90">your</strong>{" "}
            account — so nothing disappears when you close the tab, and your public profile stays trustworthy.
          </p>
        </SetupCallout>
      ) : null}

      {stage === "backend_or_session" ? (
        <SetupCallout
          variant="attention"
          eyebrow="Quick fix"
          title="We couldn’t reach your account just now"
          primary={primaryCta ?? { href: `/auth/login?next=${encodeURIComponent(buildSetupUrl(safeNext))}`, label: "Sign in again" }}
          secondary={secondaryCta ?? undefined}
        >
          <p>{persistence.message}</p>
          <p>This is usually temporary — a session refresh or Supabase hiccup. Try signing in again, then come back here.</p>
        </SetupCallout>
      ) : null}

      {stage === "profile_record" ? (
        <SetupCallout
          variant="attention"
          eyebrow="Almost there"
          title="Finish your Runfolio profile record"
          primary={primaryCta ?? undefined}
          secondary={secondaryCta ?? undefined}
        >
          <p>{persistence.message}</p>
          <p className="text-white/60">After migrations, signing out and back in often resolves this in one step.</p>
        </SetupCallout>
      ) : null}

      {stage === "connect_strava" ? (
        <SetupCallout
          eyebrow="Step 2"
          title="Connect Strava"
          primary={
            stravaOAuthConfigured
              ? {
                  href: `/api/strava/oauth/start?next=${encodeURIComponent(buildSetupUrl(safeNext))}`,
                  label: "Connect Strava"
                }
              : undefined
          }
          secondary={
            secondaryCta
              ? { href: secondaryCta.href, label: secondaryCta.label }
              : { href: "/races/new", label: "Add a race without Strava" }
          }
        >
          <p>
            Strava is how we spot long race efforts and suggest verified finishes — so My Races stays fast,
            and your portfolio reflects what you actually ran.
          </p>
          {!stravaOAuthConfigured ? (
            <p className="text-amber-100/85">
              One-click Strava isn&apos;t enabled on this server yet (missing OAuth keys). You can still{" "}
              <Link href="/races/new" className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline">
                add races manually
              </Link>{" "}
              — or ask your host to add Strava credentials.
            </p>
          ) : (
            <p className="text-white/60">
              You&apos;ll leave Runfolio briefly to approve access — we only read activities you allow.
            </p>
          )}
        </SetupCallout>
      ) : null}

      {stage === "sync_activities" ? (
        <SetupCallout
          eyebrow="Step 3"
          title="Pull your recent activities"
          secondary={secondaryCta ? { href: secondaryCta.href, label: secondaryCta.label } : undefined}
        >
          <p>
            Run a quick import so we can find race-like efforts. Then you&apos;ll review suggested matches — confirming
            sends finishes toward your profile when you&apos;re ready.
          </p>
          <SetupSyncActions />
        </SetupCallout>
      ) : null}

      {stage === "match_handoff" ? (
        <SetupCallout
          variant="success"
          eyebrow="You&apos;re set"
          title="Review matches & build your story"
          primary={primaryCta ?? { href: "/my-races", label: "Open My Races" }}
          secondary={
            secondaryCta && safeNext !== "/my-races"
              ? { href: secondaryCta.href, label: secondaryCta.label }
              : { href: "/bucket-list", label: "Bucket list" }
          }
        >
          <p>
            My Races is where long efforts become verified finishes. Confirm a race, and it moves into your
            completed collection — ready for your public profile.
          </p>
          {progress.syncedActivityCount > 0 ? (
            <p className="text-emerald-100/80">
              You have <strong className="text-white">{progress.syncedActivityCount}</strong> Strava activities stored —
              head to My Races to review the queue.
            </p>
          ) : !stravaOAuthConfigured ? (
            <p className="text-white/60">
              Without automatic Strava, add finishes from{" "}
              <Link href="/races/find" className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline">
                Find a race
              </Link>{" "}
              or{" "}
              <Link href="/races/new" className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline">
                New race
              </Link>
              .
            </p>
          ) : null}
        </SetupCallout>
      ) : null}
    </div>
  );
}
