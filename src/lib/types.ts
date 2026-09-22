/** Domain model. Mirrors the Convex schema; components only ever see these. */

export type LiftGroup =
  | "SQUAT"
  | "BENCH"
  | "DEADLIFT"
  | "QUADS"
  | "HAMSTRINGS"
  | "BACK"
  | "SHOULDERS"
  | "ARMS"
  | "CHEST"
  | "ABS"
  | "OTHER";

export const MAIN_LIFTS: LiftGroup[] = ["SQUAT", "BENCH", "DEADLIFT"];

/** How a set is prescribed. The sheet uses absolute loads and RPE targets interchangeably. */
export type Load =
  | { kind: "absolute"; kg: number }
  | { kind: "rpe"; rpe: number }
  /** Percent of a training max on the program. */
  | { kind: "percent"; pct: number; of?: "squat" | "bench" | "deadlift" }
  /** Percent of the weight logged on another row of the same session. */
  | { kind: "percentOfRow"; pct: number; ofOrder: number };

export type SessionStatus = "planned" | "done" | "skipped";
export type ProgramStatus = "active" | "draft" | "archived";

export interface Exercise {
  id: string;
  name: string;
  group: LiftGroup;
  isMainLift: boolean;
}

export interface Prescription {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  sets: number;
  reps: number;
  load: Load;
  /** Bare-minimum and technical-excellence ranges for top singles, as in the sheet. */
  beRange?: number;
  teRange?: number;
  notes?: string;
  /** Denormalised for the sheet; exercises live in their own table. */
  exerciseName?: string;
  log?: SetLog;
}

export interface SetLog {
  /** One entry per set. A single value means every set used that weight. */
  weights: number[];
  reps: number[];
  /** Last-set RPE. */
  lsrpe?: number;
  notes?: string;
  videoUrl?: string;
}

export interface Session {
  id: string;
  programId: string;
  blockId: string;
  weekId: string;
  dayNumber: number;
  weekday: string;
  date: string; // ISO yyyy-mm-dd
  name?: string;
  motivation?: string;
  notes?: string;
  status: SessionStatus;
  prescriptions: Prescription[];
}

export interface Week {
  id: string;
  programId: string;
  blockId: string;
  blockWeekIndex: number;
  programWeekIndex: number;
  startDate: string;
  sessions: Session[];
}

export interface Block {
  id: string;
  programId: string;
  name: string;
  focus?: string;
  order: number;
  weeks: Week[];
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  accent: LiftGroup | "NEUTRAL";
  startDate: string;
  meetDate?: string;
  status: ProgramStatus;
  rounding?: number;
  maxes?: { squat?: number; bench?: number; deadlift?: number };
  blocks: Block[];
}
