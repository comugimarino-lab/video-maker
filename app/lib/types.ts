export interface TapPoint {
  x: number; // 0–1 relative
  y: number; // 0–1 relative
}

export type TransitionType = "none" | "fade" | "slide-up";
export type AppMode = "normal" | "reel";
export type AspectRatio = "9:16" | "16:9";

export interface Slide {
  id: string;
  dataUrl: string;
  tapPoint: TapPoint | null;
  caption: string;
  popupText: string;
  duration: number;
  transition: TransitionType;
}
