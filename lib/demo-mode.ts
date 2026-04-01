import type { Race } from "@/types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/** Set `RUNFOLIO_OFFLINE_DEMO=1` in `.env.local` to skip live Supabase (static demo only). */
function isOfflineDemoMode() {
  const v = process.env.RUNFOLIO_OFFLINE_DEMO?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isSupabaseConfigured() {
  if (isOfflineDemoMode()) return false;
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export const demoUser = {
  id: "demo-user",
  name: "Alex Thompson",
  email: "alex@runfolio.demo"
};

export const demoRaces: Race[] = [
  {
    id: "race-1",
    user_id: demoUser.id,
    name: "UTMB®",
    location: "Chamonix, France",
    date: "2025-08-30",
    distance_km: 171.2,
    elevation_m: 10040,
    time: "23:57:13",
    description: "One step at a time in the mountains.",
    is_completed: true,
    created_at: new Date().toISOString()
  },
  {
    id: "race-2",
    user_id: demoUser.id,
    name: "Boston Marathon",
    location: "Boston, USA",
    date: "2024-04-15",
    distance_km: 42.2,
    elevation_m: 320,
    time: "2:58:12",
    description: "A lifelong goal met with gratitude.",
    is_completed: true,
    created_at: new Date().toISOString()
  },
  {
    id: "race-3",
    user_id: demoUser.id,
    name: "Leadville 100",
    location: "Leadville, USA",
    date: "2023-08-19",
    distance_km: 161,
    elevation_m: 3100,
    time: null,
    description: "High altitude grind.",
    is_completed: true,
    created_at: new Date().toISOString()
  },
  {
    id: "race-4",
    user_id: demoUser.id,
    name: "Western States 100",
    location: "California, USA",
    date: "2026-06-28",
    distance_km: 161,
    elevation_m: 5600,
    time: null,
    description: "The next big challenge.",
    is_completed: false,
    signup_url: "https://www.wser.org",
    created_at: new Date().toISOString()
  },
  {
    id: "race-5",
    user_id: demoUser.id,
    name: "London Marathon",
    location: "London, UK",
    date: "2027-04-25",
    distance_km: 42.2,
    elevation_m: null,
    time: null,
    description: null,
    is_completed: false,
    signup_url: "https://www.tcslondonmarathon.com",
    created_at: new Date().toISOString()
  },
  {
    id: "race-6",
    user_id: demoUser.id,
    name: "Hardrock 100",
    location: "Colorado, USA",
    date: "2026-07-17",
    distance_km: 160.9,
    elevation_m: 10000,
    time: null,
    description: null,
    is_completed: false,
    signup_url: "https://hardrock100.com",
    created_at: new Date().toISOString()
  },
  {
    id: "race-7",
    user_id: demoUser.id,
    name: "Chicago Marathon",
    location: "Chicago, USA",
    date: "2026-10-11",
    distance_km: 42.2,
    elevation_m: null,
    time: null,
    description: null,
    is_completed: false,
    signup_url: "https://www.chicagomarathon.com",
    created_at: new Date().toISOString()
  },
  {
    id: "race-8",
    user_id: demoUser.id,
    name: "New York Marathon",
    location: "New York, USA",
    date: "2026-11-01",
    distance_km: 42.2,
    elevation_m: null,
    time: null,
    description: null,
    is_completed: false,
    signup_url: "https://www.nyrr.org/tcsnycmarathon",
    created_at: new Date().toISOString()
  },
  {
    id: "race-9",
    user_id: demoUser.id,
    name: "Diagonale des Fous",
    location: "Réunion",
    date: "2027-10-21",
    distance_km: 165,
    elevation_m: 10000,
    time: null,
    description: null,
    is_completed: false,
    signup_url: "https://www.thegrandraidreunion.com",
    created_at: new Date().toISOString()
  }
];
