export const G = 9.80665;

export function flightTimeSeconds(frameCount: number, fps: number): number {
  if (fps <= 0 || frameCount < 0) return 0;
  return frameCount / fps;
}

export function jumpHeightMeters(flightSeconds: number): number {
  return (G * flightSeconds * flightSeconds) / 8;
}

export function formatHeight(meters: number, units: "in" | "cm"): string {
  if (units === "cm") return `${(meters * 100).toFixed(1)} cm`;
  return `${(meters * 39.3700787).toFixed(1)} in`;
}

export type JumpResult = {
  frames: number;
  seconds: number;
  meters: number;
};

export function computeJump(
  takeoffFrame: number,
  landingFrame: number,
  fps: number,
): JumpResult | null {
  const frames = landingFrame - takeoffFrame;
  if (frames <= 0 || fps <= 0) return null;
  const seconds = flightTimeSeconds(frames, fps);
  return { frames, seconds, meters: jumpHeightMeters(seconds) };
}
