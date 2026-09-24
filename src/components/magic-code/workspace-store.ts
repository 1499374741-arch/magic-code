"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { INITIAL_ARTIFACT, type AgentEvent, type Annotation, type ArtifactState, type ChatMessage, type SideThread, type VersionEntry } from "./types";

const STORAGE_KEY = "magic-code-workspace-v4";
const V3_KEY = "magic-code-workspace-v3";
const V2_KEY = "magic-code-workspace-v2";
const LEGACY_KEY = "magic-code-workspace";

export interface ProjectRecord {
  id: string;
  name: string;
  kind: "folder" | "legacy" | "standalone" | "conversation";
  parentId?: string;
  updatedAt: number;
  hasArtifact: boolean;
  artifact: ArtifactState;
  versions: VersionEntry[];
  activeVersion: string;
  annotations: Annotation[];
}

export interface ConversationRecord {
  id: string;
  projectId: string;
  workspaceId?: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
  threads: SideThread[];
  events: AgentEvent[];
}

export type AgentProviderType = "openai" | "anthropic" | "google" | "openai-compatible" | "local";

export interface AgentProvider {
  id: string;
  name: string;
  type: AgentProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  status: "not_configured" | "ready" | "error";
}

export interface AgentMcpServer {
  id: string;
  name: string;
  transport: "http" | "stdio";
  endpoint: string;
  enabled: boolean;
  requireApproval: boolean;
  status: "disconnected" | "connected" | "error";
  allowedTools: string[];
}

export interface AgentSettings {
  activeProviderId: string;
  model: string;
  reasoningEffort: "low" | "medium" | "high";
  permissionMode: "auto" | "manual" | "plan" | "bypass";
  approvalPolicy: "on-request" | "never";
  sandboxMode: "read-only" | "workspace-write" | "danger-full-access";
  networkAccess: boolean;
  webSearch: boolean;
  autoContextCompaction: boolean;
  multiAgent: boolean;
  maxConcurrentAgents: number;
  contextWindow: "auto" | "compact" | "full";
  maxToolCalls: number;
  responseLanguage: "auto" | "zh-CN" | "en-US";
  eventLogging: boolean;
  resumeSessions: boolean;
  systemInstructions: string;
  providers: AgentProvider[];
  mcpServers: AgentMcpServer[];
  shortcuts: Record<string, string>;
  workspace: {
    defaultPath: string;
    fileScope: "project" | "project-and-children";
    autoSaveVersions: boolean;
  };
  tools: Record<string, boolean>;
  skills: Record<string, boolean>;
}

export interface WorkspaceData {
  schema: 5;
  projects: ProjectRecord[];
  conversations: ConversationRecord[];
  activeProjectId: string;
  activeConversationId: string;
  sidebarCollapsed: boolean;
  previewOpen: boolean;
  previewWidth: number;
  extensions: Record<string, boolean>;
  agentSettings: AgentSettings;
}

function initialData(): WorkspaceData {
  return {
    schema: 5,
    projects: [{
      id: "workspace-default", name: "新对话", kind: "standalone", updatedAt: 0, hasArtifact: false,
      artifact: INITIAL_ARTIFACT, versions: [], activeVersion: "", annotations: [],
    }],
    conversations: [{ id: "conversation-default", projectId: "workspace-default", workspaceId: "workspace-default", title: "新对话", updatedAt: 0, messages: [], threads: [], events: [] }],
    activeProjectId: "workspace-default", activeConversationId: "conversation-default",
    sidebarCollapsed: false, previewOpen: true, previewWidth: 520,
      extensions: { "plugin-browser": true, "plugin-export": true, "skill-target": true, "skill-writing": false },
    agentSettings: {
      activeProviderId: "openai",
      model: "",
      reasoningEffort: "medium",
      permissionMode: "auto",
      approvalPolicy: "on-request",
      sandboxMode: "workspace-write",
      networkAccess: false,
      webSearch: true,
      autoContextCompaction: true,
      multiAgent: false,
      maxConcurrentAgents: 2,
      contextWindow: "auto",
      maxToolCalls: 12,
      responseLanguage: "auto",
      eventLogging: true,
      resumeSessions: true,
      systemInstructions: "先理解目标，再结合当前项目文件和右侧作品上下文行动。涉及视觉点选、框选或批注时，优先使用用户明确定位；修改前保存版本，修改后给出可预览结果。",
      providers: [{ id: "openai", name: "OpenAI", type: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-5", enabled: true, status: "not_configured" }],
      mcpServers: [],
      shortcuts: { newConversation: "⌘ N", sendMessage: "⌘ ↵", toggleTargeting: "⌘ ⇧ T", openPreview: "⌘ ⇧ P", stopRun: "Esc" },
      workspace: { defaultPath: "", fileScope: "project-and-children", autoSaveVersions: true },
      tools: { "visual-targeting": true, "artifact-preview": true, "file-read": true, "file-write": true, "version-control": true, export: true, "web-search": true, mcp: false },
      skills: { targeting: true, writing: false, "web-generation": true, "file-analysis": true },
    },
  };
}

export function restoreWorkspace(snapshot: string | null, legacy: string | null): WorkspaceData {
  const initial = initialData();
  try {
    if (snapshot) {
      const saved = JSON.parse(snapshot) as Partial<Omit<WorkspaceData, "schema">> & { schema?: number };
      if ((saved.schema === 2 || saved.schema === 3 || saved.schema === 4 || saved.schema === 5) && Array.isArray(saved.projects) && saved.projects.length && Array.isArray(saved.conversations)) {
        const bundledConversation = saved.conversations.find((item) => item.id === "conversation-luma");
        const bundledProject = saved.projects.find((item) => item.id === "project-luma");
        const pristineBundledDemo = bundledConversation?.title === "首页视觉与转化优化"
          && bundledConversation.messages?.map((message) => message.id).join(",") === "m1,m2,m3"
          && bundledProject?.name === "Luma Studio 官网"
          && bundledProject.hasArtifact === true
          && bundledProject.versions?.length === 1
          && bundledProject.versions[0]?.id === "v1"
          && bundledProject.annotations?.some((annotation) => annotation.id === "a-team");
        const sourceProjects = pristineBundledDemo ? saved.projects.filter((item) => item.id !== "project-luma") : saved.projects;
        const sourceConversations = pristineBundledDemo ? saved.conversations.filter((item) => item.id !== "conversation-luma") : saved.conversations;
        if (!sourceProjects.length || !sourceConversations.length) return initial;
        const projects = sourceProjects.map((item) => ({ ...item, kind: item.kind ?? "legacy", hasArtifact: item.hasArtifact ?? true }));
        const conversations = sourceConversations.map((item) => ({ ...item, events: item.events ?? [] }));
        const activeConversation = conversations.find((item) => item.id === saved.activeConversationId) ?? conversations[0];
        const activeProjectId = projects.some((item) => item.id === (activeConversation?.workspaceId ?? activeConversation?.projectId))
          ? (activeConversation.workspaceId ?? activeConversation.projectId) : projects[0].id;
        const activeConversationId = activeConversation && (activeConversation.workspaceId ?? activeConversation.projectId) === activeProjectId ? activeConversation.id
          : conversations.find((item) => (item.workspaceId ?? item.projectId) === activeProjectId)?.id ?? "";
        return {
          ...initial, ...saved, schema: 5,
          projects,
          conversations,
          activeProjectId, activeConversationId,
          previewWidth: Math.min(900, Math.max(420, Number(saved.previewWidth) || 560)),
          extensions: Object.fromEntries(Object.entries({ ...initial.extensions, ...saved.extensions }).filter(([id]) => id !== "plugin-mcp")),
          agentSettings: {
            ...initial.agentSettings,
            ...(saved.agentSettings ?? {}),
            providers: saved.agentSettings?.providers?.length ? saved.agentSettings.providers : initial.agentSettings.providers,
            mcpServers: (saved.agentSettings?.mcpServers ?? []).filter((server) => server.id !== "boardui" && server.name !== "BoardUI MCP"),
            shortcuts: { ...initial.agentSettings.shortcuts, ...saved.agentSettings?.shortcuts },
            workspace: { ...initial.agentSettings.workspace, ...saved.agentSettings?.workspace },
            tools: { ...initial.agentSettings.tools, ...saved.agentSettings?.tools },
            skills: { ...initial.agentSettings.skills, ...saved.agentSettings?.skills },
          },
        };
      }
    }
    if (legacy) {
      const saved = JSON.parse(legacy) as { artifact?: ArtifactState; versions?: VersionEntry[]; annotations?: Annotation[] };
      if (saved.artifact || saved.versions?.length || saved.annotations?.length) {
        const projectId = "workspace-migrated-legacy";
        const artifact = saved.artifact ?? INITIAL_ARTIFACT;
        const versions = saved.versions?.length ? saved.versions : [{ id: "v1", label: "迁移作品", detail: "从旧版本恢复", createdAt: "", state: artifact }];
        initial.projects.unshift({ id: projectId, name: "迁移的作品", kind: "legacy", updatedAt: Date.now(), hasArtifact: true, artifact, versions, activeVersion: versions.at(-1)?.id ?? "", annotations: Array.isArray(saved.annotations) ? saved.annotations : [] });
        initial.conversations.unshift({ id: "conversation-migrated-legacy", projectId, title: "迁移的作品", updatedAt: Date.now(), messages: [], threads: [], events: [] });
        initial.activeProjectId = projectId;
        initial.activeConversationId = "conversation-migrated-legacy";
      }
    }
  } catch {
    // A damaged local snapshot must not prevent the workspace from opening.
  }
  return initial;
}

function resolve<T>(value: SetStateAction<T>, previous: T): T {
  return typeof value === "function" ? (value as (previous: T) => T)(previous) : value;
}

export function useWorkspaceStore() {
  const [data, setData] = useState<WorkspaceData>(initialData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setData(restoreWorkspace(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(V3_KEY) ?? localStorage.getItem(V2_KEY), localStorage.getItem(LEGACY_KEY)));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const project = data.projects.find((item) => item.id === data.activeProjectId) ?? data.projects[0];
  const conversation = data.conversations.find((item) => item.id === data.activeConversationId) ?? null;
  const folderProject = data.projects.find((item) => item.id === (project.parentId ?? project.id)) ?? project;

  function updateProject(id: string, update: (project: ProjectRecord) => ProjectRecord) {
    setData((current) => ({ ...current, projects: current.projects.map((item) => item.id === id ? { ...update(item), updatedAt: Date.now() } : item) }));
  }

  function updateConversation(id: string, update: (conversation: ConversationRecord) => ConversationRecord) {
    setData((current) => ({ ...current, conversations: current.conversations.map((item) => item.id === id ? { ...update(item), updatedAt: Date.now() } : item) }));
  }

  function projectSetter<K extends "artifact" | "versions" | "annotations" | "activeVersion">(key: K): Dispatch<SetStateAction<ProjectRecord[K]>> {
    return (value) => updateProject(data.activeProjectId, (item) => ({ ...item, [key]: resolve(value, item[key]) }));
  }

  function conversationSetter<K extends "messages" | "threads" | "events">(key: K): Dispatch<SetStateAction<ConversationRecord[K]>> {
    return (value) => updateConversation(data.activeConversationId, (item) => ({ ...item, [key]: resolve(value, item[key]) }));
  }

  function createConversation(projectId?: string) {
    const id = crypto.randomUUID();
    const workspaceId = projectId ?? `standalone-${id}`;
    setData((current) => ({
      ...current,
      projects: [{ id: workspaceId, name: projectId ? "对话作品" : "独立对话", kind: projectId ? "conversation" : "standalone", parentId: projectId, updatedAt: Date.now(), hasArtifact: false, artifact: INITIAL_ARTIFACT, versions: [], activeVersion: "", annotations: [] }, ...current.projects],
      conversations: [{ id, projectId: projectId ?? workspaceId, workspaceId, title: "新对话", updatedAt: Date.now(), messages: [], threads: [], events: [] }, ...current.conversations],
      activeProjectId: workspaceId, activeConversationId: id, previewOpen: false,
    }));
    return id;
  }

  function createProject(name: string, id = crypto.randomUUID()) {
    const conversationId = crypto.randomUUID();
    setData((current) => ({
      ...current,
      projects: [{ id, name, kind: "folder", updatedAt: Date.now(), hasArtifact: false, artifact: INITIAL_ARTIFACT, versions: [], activeVersion: "", annotations: [] }, ...current.projects],
      conversations: [{ id: conversationId, projectId: id, title: "新对话", updatedAt: Date.now(), messages: [], threads: [], events: [] }, ...current.conversations],
      activeProjectId: id, activeConversationId: conversationId, previewOpen: false,
    }));
    return id;
  }

  function selectProject(id: string) {
    setData((current) => {
      const selected = [...current.conversations].filter((item) => item.projectId === id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const workspaceId = selected?.workspaceId ?? id;
      return { ...current, activeProjectId: workspaceId, activeConversationId: selected?.id ?? "", previewOpen: current.projects.find((item) => item.id === workspaceId)?.hasArtifact ?? false };
    });
  }

  function selectConversation(id: string) {
    setData((current) => {
      const selected = current.conversations.find((item) => item.id === id);
      const workspaceId = selected?.workspaceId ?? selected?.projectId ?? current.activeProjectId;
      return selected ? { ...current, activeProjectId: workspaceId, activeConversationId: id, previewOpen: current.projects.find((item) => item.id === workspaceId)?.hasArtifact ?? false } : current;
    });
  }

  function renameConversation(id: string, title: string) {
    const nextTitle = title.trim().slice(0, 80);
    if (!nextTitle) return;
    updateConversation(id, (item) => ({ ...item, title: nextTitle }));
  }

  function deleteConversation(id: string) {
    setData((current) => {
      const removed = current.conversations.find((item) => item.id === id);
      if (!removed) return current;
      const workspaceId = removed.workspaceId ?? removed.projectId;
      const removedProject = current.projects.find((item) => item.id === workspaceId);
      const conversations = current.conversations.filter((item) => item.id !== id);
      const projects = removedProject?.kind === "standalone" && !conversations.some((item) => (item.workspaceId ?? item.projectId) === workspaceId)
        ? current.projects.filter((item) => item.id !== workspaceId)
        : current.projects;
      if (current.activeConversationId !== id) return { ...current, conversations, projects };

      const nextConversation = conversations[0];
      if (nextConversation) {
        const nextWorkspaceId = nextConversation.workspaceId ?? nextConversation.projectId;
        return { ...current, conversations, projects, activeConversationId: nextConversation.id, activeProjectId: nextWorkspaceId, previewOpen: projects.find((item) => item.id === nextWorkspaceId)?.hasArtifact ?? false };
      }

      const fallbackId = crypto.randomUUID();
      const projectId = removedProject?.kind === "folder" || removedProject?.kind === "legacy" ? workspaceId : `standalone-${fallbackId}`;
      const fallbackProject: ProjectRecord | null = projectId === workspaceId && removedProject
        ? null
        : { id: projectId, name: "独立对话", kind: "standalone", updatedAt: Date.now(), hasArtifact: false, artifact: INITIAL_ARTIFACT, versions: [], activeVersion: "", annotations: [] };
      return {
        ...current,
        projects: fallbackProject ? [fallbackProject, ...projects] : projects,
        conversations: [{ id: fallbackId, projectId, ...(projectId !== workspaceId ? { workspaceId: projectId } : {}), title: "新对话", updatedAt: Date.now(), messages: [], threads: [], events: [] }],
        activeProjectId: projectId,
        activeConversationId: fallbackId,
        previewOpen: false,
      };
    });
  }

  return {
    data, hydrated, project, folderProject, conversation, setData, updateProject, updateConversation,
    setArtifact: projectSetter("artifact"), setVersions: projectSetter("versions"),
    setAnnotations: projectSetter("annotations"), setActiveVersion: projectSetter("activeVersion"),
    setMessages: conversationSetter("messages"), setThreads: conversationSetter("threads"), setEvents: conversationSetter("events"),
    createConversation, createProject, selectProject, selectConversation, renameConversation, deleteConversation,
  };
}
