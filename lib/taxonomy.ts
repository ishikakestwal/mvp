// ============================================================================
// Shared taxonomy — types, constants, and the content corpus.
// ----------------------------------------------------------------------------
// Extracted out of engine.ts so the recommendation engine and the cognitive
// layer can both depend on the shared vocabulary without depending on each
// other. engine.ts re-exports everything in this file, so every existing
// `import { ... } from "@/lib/engine"` in the UI keeps resolving unchanged.
//
// Without this split, engine -> cognitive -> engine forms a module cycle, and
// ES module cycles that touch `const` bindings at evaluation time throw
// temporal-dead-zone errors that only appear in the production bundle. Cheaper
// to prevent than to debug at 3am.
// ============================================================================

export type Category =
  | "AI/ML"
  | "Cybersecurity"
  | "Web Dev"
  | "Basketball"
  | "Design"
  | "Business"
  | "Data Science"
  | "Creative Writing";

export type Format = "project" | "read" | "video" | "bite";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type LearningStyle = "project" | "read" | "video" | "bite";

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: Category;
  format: Format;
  difficulty: Difficulty;
  duration: number; // minutes
  tags: string[];
  // Optional presentational fields — the corpus in engine.ts doesn't set these,
  // so the UI falls back to a category-accent gradient and an "IABTM" source.
  thumbnail?: string;
  url?: string;
  source?: string;
  tier?: string;
}

export interface UserProfile {
  aspiration: string;
  interests: Category[];
  experience: Difficulty;
  learningStyle: LearningStyle;
  dailyTime: 15 | 30 | 45 | 60;
}

export type SwipeDirection = "accept" | "skip" | "later";

// Content tiers for the drift-aware router. `stretch` is the growth content,
// `easy` is low-friction on-goal content, `bridge` is everything else on-goal,
// and `off_goal` is outside the user's stated interests. The router only ever
// lowers friction *within* the goal (toward `easy`); it never autonomously
// serves `off_goal` content. See lib/engine.ts driftState/classifyTier.
export type Tier = "stretch" | "bridge" | "easy" | "off_goal";

export type DriftState = "healthy" | "mild_drift" | "heavy_drift";

export interface Interaction {
  recommendationId: string;
  category: Category;
  format: Format;
  direction: SwipeDirection;
  timestamp: number;
  // Milliseconds the card was on top before the user swiped. A fast skip on a
  // long card is a *format* rejection, not a topic rejection (validated against
  // the dwell-time denoising used by Inshorts/BookMyShow-class recommenders).
  timeToSwipeMs?: number;
  // Tier of the card at interaction time, denormalized so driftState is a pure
  // function of history without needing to re-look-up the corpus.
  tier?: Tier;
}

export interface Weights {
  categories: Record<Category, number>;
  formats: Record<Format, number>;
}

export interface Counters {
  categories: Record<Category, { accept: number; skip: number; later: number }>;
  formats: Record<Format, { accept: number; skip: number; later: number }>;
}

export const ALL_CATEGORIES: Category[] = [
  "AI/ML",
  "Cybersecurity",
  "Web Dev",
  "Basketball",
  "Design",
  "Business",
  "Data Science",
  "Creative Writing",
];

export const ALL_FORMATS: Format[] = ["project", "read", "video", "bite"];

export const FORMAT_LABELS: Record<Format, string> = {
  project: "Project-based",
  read: "Reading",
  video: "Video",
  bite: "Bite-sized",
};

export const CATEGORY_ACCENTS: Record<Category, string> = {
  "AI/ML": "hsl(168, 70%, 42%)",
  Cybersecurity: "hsl(200, 70%, 52%)",
  "Web Dev": "hsl(262, 60%, 60%)",
  Basketball: "hsl(28, 80%, 56%)",
  Design: "hsl(330, 70%, 58%)",
  Business: "hsl(142, 60%, 46%)",
  "Data Science": "hsl(190, 65%, 48%)",
  "Creative Writing": "hsl(0, 70%, 56%)",
};
