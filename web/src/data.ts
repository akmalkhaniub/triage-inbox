import type { Cases, Manifest, Results, Trajectory } from "./types";

const BASE = import.meta.env.BASE_URL; // "./" per vite.config base

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const loadResults = () => getJSON<Results>("results.json");
export const loadManifest = () => getJSON<Manifest>("manifest.json");
export const loadCases = () => getJSON<Cases>("cases.json");
export const loadTrajectory = (file: string) => getJSON<Trajectory>(file.replace(/^trajectories\//, "trajectories/"));

// A case is "hard" if its title flags it (authored convention).
export const isHardTitle = (title: string) => /HARD/i.test(title);

export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const f2 = (n: number) => n.toFixed(2);
export const usd = (n: number) => `$${n.toFixed(4)}`;
