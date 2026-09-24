export type CanvasMode = "preview" | "target" | "region" | "annotate";

export type ArtifactAccent = "blue" | "lime" | "orange";

export interface ArtifactState {
  accent: ArtifactAccent;
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaScale: "normal" | "large";
  darkHero: boolean;
  hiddenElements: string[];
}

export interface ElementMeta {
  id: string;
  name: string;
  tag: string;
  font?: string;
  color?: string;
  size?: string;
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  note: string;
  author: string;
  synced: boolean;
}

export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Array<{ x: number; y: number }>;
}

export interface VersionEntry {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
  state: ArtifactState;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  status?: "done" | "thinking";
}

export type AgentEventType =
  | "turn.started"
  | "context.prepared"
  | "model.requested"
  | "approval.requested"
  | "approval.granted"
  | "approval.rejected"
  | "tool.requested"
  | "tool.completed"
  | "verification.completed"
  | "version.created"
  | "turn.paused"
  | "turn.completed"
  | "turn.failed";

export interface AgentEvent {
  id: string;
  turnId: string;
  type: AgentEventType;
  label: string;
  detail?: string;
  status: "running" | "done" | "waiting" | "error";
  createdAt: string;
}

export interface AgentApprovalRequest {
  id: string;
  turnId: string;
  tool: string;
  detail: string;
  prompt: string;
  projectId: string;
  conversationId: string;
  target?: ElementMeta | null;
}

export type AgentAction =
  | { type: "artifact.update"; changes: Partial<Pick<ArtifactState, "accent" | "heading" | "subheading" | "ctaLabel" | "ctaScale" | "darkHero">>; targetId?: string; reason?: string }
  | { type: "artifact.hide"; targetId: string; reason?: string }
  | { type: "artifact.show"; targetId: string; reason?: string }
  | { type: "annotation.create"; x: number; y: number; note: string; author?: string }
  | { type: "context.inspect"; targetId?: string };

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface SideThread {
  id: string;
  source: string;
  tag: string;
  messages: ChatMessage[];
}

export const INITIAL_ARTIFACT: ArtifactState = {
  accent: "blue",
  heading: "给好想法，留一张真正能展开的桌子。",
  subheading: "Luma 把项目、灵感和团队反馈放回同一个空间，让创作不再散落在十个窗口里。",
  ctaLabel: "预约工作室体验",
  ctaScale: "normal",
  darkHero: true,
  hiddenElements: [],
};
