export interface TapPoint {
  x: number; // 0–1 relative
  y: number; // 0–1 relative
}

export interface Slide {
  id: string;
  dataUrl: string;
  tapPoint: TapPoint | null;
  caption: string;       // bottom subtitle
  popupText: string;     // text near tap point
  duration: number;      // seconds
}
