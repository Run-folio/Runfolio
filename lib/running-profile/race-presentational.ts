import type { Race } from "@/types";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";

/** Prefer catalog art from RPC, then scene placeholder from title. */
export function profileRaceHeroImage(race: Race): { src: string; alt: string } {
  const label = getPortfolioRaceLabel(race);
  const hero = race.canonical_hero_url?.trim();
  const logo = race.canonical_logo_url?.trim();
  if (hero) return { src: hero, alt: label };
  if (logo) return { src: logo, alt: label };
  return { src: getRaceSceneImagePath(label), alt: label };
}
