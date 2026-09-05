/** Shared wire format. Curriculum content is fetched from the private API. */
export type TrainingKind = "sending" | "audio" | "icr" | "simulator" | "live" | "review";
export type MaterialUsage = "preparation" | "class" | "reference" | "unknown";
export type Difficulty = "hard" | "right" | "easy";

export interface TrainingResource {
  id: string;
  title: string;
  url: string;
  format: "audio" | "text" | "link";
  text?: string;
  durationSeconds?: number;
  unresolved?: string;
}

export interface TrainingTask {
  id: string;
  kind: TrainingKind;
  title: string;
  instructions: string;
  sourceUrl: string;
  resourceId?: string;
  speedWpm?: number;
  minimumPasses?: number;
  maximumPasses?: number;
  minutes?: number;
  settings?: string;
  objectiveCount?: number;
  alternative?: string;
  optional?: boolean;
}

export interface TrainingAssignment {
  id: string;
  session: number;
  day: number;
  date: string;
  dueAt: string;
  instructions: string;
  sourceUrl: string;
  tasks: TrainingTask[];
}

export interface TrainingMeeting {
  session: number;
  startsAt: string;
  endsAt: string;
}

export interface TrainingCourse {
  id: string;
  title: string;
  version: string;
  sourceUrl: string;
  verifiedAt: string;
  timezone: string;
  dailyGoalMinutes: number;
  instructions: string;
  meetings: TrainingMeeting[];
  assignments: TrainingAssignment[];
  resources: TrainingResource[];
}

export interface TrainingAttempt {
  id: string;
  assignmentId: string;
  taskId: string;
  startedAt: string;
  endedAt: string;
  activeSeconds: number;
  completed: boolean;
  completedPasses?: number;
  difficulty?: Difficulty;
  note?: string;
  context: "practice" | "class";
}

export interface TrainingMaterial {
  id: string;
  session: number;
  title: string;
  text: string;
  url?: string;
  filename?: string;
  usage: MaterialUsage;
  createdAt: string;
  supersedesId?: string;
}

export interface TrainingPreferences {
  blockMinutes: 10 | 15;
  reminderTime: string;
  joinUrl?: string;
  updatedAt: string;
}

export interface TrainingSnapshot {
  userId: string;
  course: TrainingCourse;
  attempts: TrainingAttempt[];
  materials: TrainingMaterial[];
  preferences: TrainingPreferences;
  serverTime: string;
}

export interface TrainingSync {
  attempts?: TrainingAttempt[];
  materials?: TrainingMaterial[];
  preferences?: TrainingPreferences;
}
