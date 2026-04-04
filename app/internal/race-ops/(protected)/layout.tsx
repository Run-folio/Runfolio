import { assertRaceOpsSession } from "@/lib/races/internal/race-ops-auth";

export default async function RaceOpsProtectedLayout({ children }: { children: React.ReactNode }) {
  await assertRaceOpsSession();
  return <>{children}</>;
}
