export interface TapPoint {
  x: number; // 0–1 relative
  y: number; // 0–1 relative
}

export type TransitionType = "none" | "fade" | "slide-left" | "zoom";
export type SlideTransitionOverride = "global" | TransitionType;
export type AppMode = "normal" | "reel";
export type AspectRatio = "9:16" | "16:9";

export type OverlayPosition = "top" | "center" | "bottom";
export type OverlaySize = "small" | "medium" | "large";

export interface GlobalSettings {
  transition: TransitionType;
  transitionDuration: number; // 0.2–1.0 seconds
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  transition: "fade",
  transitionDuration: 0.4,
};

export interface Slide {
  id: string;
  dataUrl: string;
  tapPoint: TapPoint | null;
  caption: string;
  popupText: string;
  duration: number;
  transition: SlideTransitionOverride; // "global" = follow GlobalSettings
  overlayText: string;
  overlayPosition: OverlayPosition;
  overlaySize: OverlaySize;
}
