"use client";

import {
  RiCheckDoubleLine,
  RiEyeLine,
  RiQuestionAnswerLine,
} from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";
import { WorkspaceChat, type AgentAttachment } from "./workspace-chat";
import { WorkspaceControlView } from "./workspace-control-view";
import { WorkspacePreview } from "./workspace-preview";
import { WorkspaceSidebar, type SettingsSection, type SidebarView } from "./workspace-sidebar";
import { isPickerCancellation, loadDirectory, pickDirectory, saveDirectory, supportsLocalFolders } from "./local-folders";
import { useWorkspaceStore } from "./workspace-store";
import {
  type AgentApprovalRequest,
  type AgentAction,
  type AgentEvent,
  type Annotation,
  type ArtifactState,
  type CanvasMode,
  type ChatMessage,
  type ElementMeta,
  type RegionSelection,
  type VersionEntry,
} from "./types";
import type { AgentSettings } from "./workspace-store";

function currentTime() {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function readElement(target: EventTarget | null): ElementMeta | null {
  if (!(target instanceof HTMLElement)) return null;
  const node = target.closest<HTMLElement>("[data-magic-element='true']");
  if (!node) return null;
  return {
    id: node.dataset.elementId ?? "unknown",
    name: node.dataset.elementName ?? "未命名元素",
    tag: node.dataset.elementTag ?? node.tagName.toLowerCase(),
    font: node.dataset.elementFont || undefined,
    color: node.dataset.elementColor || undefined,
    size: node.dataset.elementSize || undefined,
  };
}

function applyAgentActions(previous: ArtifactState, actions: AgentAction[]) {
  const next: ArtifactState = { ...previous, hiddenElements: [...previous.hiddenElements] };
  for (const action of actions) {
    if (action.type === "artifact.update") {
      const changes = action.changes;
      if (changes.accent === "blue" || changes.accent === "lime" || changes.accent === "orange") next.accent = changes.accent;
      if (typeof changes.heading === "string") next.heading = changes.heading.slice(0, 500);
      if (typeof changes.subheading === "string") next.subheading = changes.subheading.slice(0, 2000);
      if (typeof changes.ctaLabel === "string") next.ctaLabel = changes.ctaLabel.slice(0, 120);
      if (changes.ctaScale === "normal" || changes.ctaScale === "large") next.ctaScale = changes.ctaScale;
      if (typeof changes.darkHero === "boolean") next.darkHero = changes.darkHero;
    }
    if (action.type === "artifact.hide" && !next.hiddenElements.includes(action.targetId)) next.hiddenElements.push(action.targetId);
    if (action.type === "artifact.show") next.hiddenElements = next.hiddenElements.filter((id) => id !== action.targetId);
  }
  return next;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function exportHtml(state: ArtifactState, image: string) {
  const hidden = new Set(state.hiddenElements);
  const accent = state.accent === "lime" ? "#65a30d" : state.accent === "orange" ? "#ea580c" : "#2563eb";
  const overlay = state.darkHero ? "rgba(10,18,20,.88),rgba(10,18,20,.12)" : "rgba(255,255,255,.94),rgba(255,255,255,.12)";
  const foreground = state.darkHero ? "#fff" : "#171717";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Luma Studio</title><style>body{margin:0;font-family:"Avenir Next",Avenir,"Helvetica Neue",sans-serif;color:#171717}.hero{min-height:90vh;display:grid;align-items:end;padding:8vw;background:linear-gradient(90deg,${overlay}),url('${image}') center/cover;color:${foreground}}h1{max-width:760px;font-size:clamp(44px,7vw,84px);line-height:1.02;margin:0}.copy{max-width:620px;font-size:18px;line-height:1.7;opacity:.8}.cta{margin-top:24px;padding:${state.ctaScale === "large" ? "18px 28px" : "14px 22px"};border:0;border-radius:10px;background:${accent};color:#fff;font-weight:700}</style></head><body><main class="hero">${hidden.has("hero-title") ? "" : `<h1>${escapeHtml(state.heading)}</h1>`}${hidden.has("hero-copy") ? "" : `<p class="copy">${escapeHtml(state.subheading)}</p>`}${hidden.has("primary-cta") ? "" : `<button class="cta">${escapeHtml(state.ctaLabel)}</button>`}</main></body></html>`;
}

interface RectOverlay {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function MagicCodeWorkspace() {
  const store = useWorkspaceStore();
  const { data, project, folderProject, conversation, setData, updateProject, updateConversation, setAnnotations, setMessages, setThreads, setEvents } = store;
  const artifact = project.artifact;
  const versions = project.versions;
  const annotations = project.annotations;
  const activeVersion = project.activeVersion;
  const activeProvider = data.agentSettings.providers.find((item) => item.id === data.agentSettings.activeProviderId) ?? data.agentSettings.providers[0];
  const runtimeReady = Boolean(activeProvider?.enabled && activeProvider.status === "ready" && activeProvider.apiKey && activeProvider.model);
  const modelLabel = runtimeReady ? `${activeProvider.name} · ${activeProvider.model}` : "未连接模型";
  const messages = conversation?.messages ?? [];
  const threads = conversation?.threads ?? [];
  const [chatDraft, setChatDraft] = useState("");
  const contextLimit = data.agentSettings.contextWindow === "full" ? 24000 : data.agentSettings.contextWindow === "compact" ? 9000 : 16000;
  const contextChars = data.agentSettings.systemInstructions.length + messages.reduce((total, message) => total + message.content.length, 0) + (conversation?.events ?? []).reduce((total, event) => total + event.label.length + (event.detail?.length ?? 0), 0) + chatDraft.length;
  const contextPercent = Math.min(99, Math.round((contextChars / contextLimit) * 100));
  const contextCompacting = data.agentSettings.autoContextCompaction && contextPercent >= 80;
  const contextUsage = { percent: contextPercent, compacting: contextCompacting, detail: contextCompacting ? "上下文接近当前模型窗口，Agent 会自动压缩较早的对话和工具记录" : `当前会话上下文估算使用 ${contextPercent}%，包含对话、工具记录和项目指令` };
  const [mobileView, setMobileView] = useState<"chat" | "canvas">("canvas");
  const [sidebarView, setSidebarView] = useState<SidebarView>("home");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [mode, setMode] = useState<CanvasMode>("target");
  const [selected, setSelected] = useState<ElementMeta | null>(null);
  const [hovered, setHovered] = useState<ElementMeta | null>(null);
  const [hoverRect, setHoverRect] = useState<RectOverlay | null>(null);
  const [selectedRect, setSelectedRect] = useState<RectOverlay | null>(null);
  const [region, setRegion] = useState<RegionSelection | null>(null);
  const [regionStart, setRegionStart] = useState<{ x: number; y: number } | null>(null);
  const regionPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const [inspectorTab, setInspectorTab] = useState<"props" | "notes" | "versions">("props");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [compare, setCompare] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<AgentApprovalRequest | null>(null);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "awaiting_approval" | "paused">("idle");
  const activeAbortRef = useRef<AbortController | null>(null);
  const [listening, setListening] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectionAction, setSelectionAction] = useState<{ text: string; x: number; y: number } | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadDraft, setThreadDraft] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fitDesktop = () => {
      if (window.innerWidth <= 1120) {
        setData((current) => current.previewOpen && !current.sidebarCollapsed ? { ...current, sidebarCollapsed: true } : current);
      }
    };
    fitDesktop();
    window.addEventListener("resize", fitDesktop);
    return () => window.removeEventListener("resize", fitDesktop);
  }, [data.sidebarCollapsed, data.previewOpen, store.hydrated, setData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const activeVersionIndex = versions.findIndex((version) => version.id === activeVersion);
  const comparisonIndex = Math.max(1, activeVersionIndex);
  const compareBefore = versions[comparisonIndex - 1];
  const compareAfter = versions[comparisonIndex];
  const pendingAnnotations = annotations.filter((annotation) => !annotation.synced);
  const mobileSelection = useMemo(() => new Set([mobileView]), [mobileView]);

  function rectFor(target: EventTarget | null) {
    if (!(target instanceof HTMLElement) || !previewRef.current) return null;
    const node = target.closest<HTMLElement>("[data-magic-element='true']");
    if (!node || !previewRef.current.contains(node)) return null;
    const viewport = previewRef.current;
    const outer = viewport.getBoundingClientRect();
    const inner = node.getBoundingClientRect();
    return {
      left: inner.left - outer.left + viewport.scrollLeft,
      top: inner.top - outer.top + viewport.scrollTop,
      width: inner.width,
      height: inner.height,
    };
  }

  function handlePreviewMove(event: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "target") return;
    setHovered(readElement(event.target));
    setHoverRect(rectFor(event.target));
  }

  function annotationPoint(event: React.MouseEvent<HTMLDivElement>) {
    const viewport = previewRef.current;
    // Pins are absolutely positioned against the hero, which is the stable
    // visual surface used by the existing annotation data.
    const content = viewport?.querySelector<HTMLElement>(".artifact-hero") ?? viewport;
    const bounds = content?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
  }

  function handlePreviewClick(event: React.MouseEvent<HTMLDivElement>) {
    if (mode === "preview") return;
    event.preventDefault();
    event.stopPropagation();
    if (mode === "target") {
      const meta = readElement(event.target);
      if (!meta) return;
      setSelected(meta);
      setSelectedRect(rectFor(event.target));
      setInspectorTab("props");
      setInspectorOpen(true);
      setChatDraft(`把“${meta.name}”改得更突出一些`);
    }
    if (mode === "annotate" && previewRef.current) {
      const point = annotationPoint(event);
      const annotation: Annotation = {
        id: `a-${Date.now()}`,
        x: point.x,
        y: point.y,
        note: "在这里补充修改意见…",
        author: "你",
        synced: false,
      };
      setAnnotations((current) => [...current, annotation]);
      setInspectorTab("notes");
      setInspectorOpen(true);
      setToast("批注已放到画布上");
    }
  }

  function relativePoint(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = previewRef.current;
    const bounds = viewport?.getBoundingClientRect();
    if (!bounds || !viewport) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(viewport.scrollWidth, event.clientX - bounds.left + viewport.scrollLeft)),
      y: Math.max(0, Math.min(viewport.scrollHeight, event.clientY - bounds.top + viewport.scrollTop)),
    };
  }

  function boundsForPoints(points: Array<{ x: number; y: number }>) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "region") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = relativePoint(event);
    setRegionStart(start);
    regionPointsRef.current = [start];
    setRegion({ ...start, width: 0, height: 0, points: [start] });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    handlePreviewMove(event);
    if (mode !== "region" || !regionStart) return;
    const point = relativePoint(event);
    const points = [...regionPointsRef.current, point];
    regionPointsRef.current = points;
    setRegion({ ...boundsForPoints(points), points });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "region" || !regionStart) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const point = relativePoint(event);
    const points = [...regionPointsRef.current, point];
    regionPointsRef.current = points;
    const nextRegion: RegionSelection = { ...boundsForPoints(points), points };
    setRegionStart(null);
    setRegion(nextRegion);
    if (nextRegion.width < 8 && nextRegion.height < 8) {
      setRegion(null);
      regionPointsRef.current = [];
      return;
    }
    setSelected({ id: "selected-region", name: "圈选区域", tag: "region", size: `${Math.round(nextRegion.width)} x ${Math.round(nextRegion.height)}px` });
    setChatDraft("统一优化这块区域的层级、间距和按钮样式");
    setInspectorTab("props");
    setInspectorOpen(true);
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "region") return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setRegionStart(null);
    setRegion(null);
    regionPointsRef.current = [];
  }

  function appendAgentEvent(event: Omit<AgentEvent, "id" | "createdAt">) {
    setEvents((current) => [...current, { ...event, id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`, createdAt: currentTime() }]);
  }

  function requiresApproval(prompt: string) {
    if (data.agentSettings.permissionMode === "bypass" || data.agentSettings.approvalPolicy === "never") return false;
    if (data.agentSettings.permissionMode === "manual" || data.agentSettings.permissionMode === "plan") return true;
    return /删除|写入|导出|联网|搜索|MCP|执行|覆盖/.test(prompt);
  }

  async function executeCommand(prompt: string, target: ElementMeta | null, projectId: string, conversationId: string, turnId: string, attachments: AgentAttachment[] = []) {
    const provider = data.agentSettings.providers.find((item) => item.id === data.agentSettings.activeProviderId) ?? data.agentSettings.providers[0];
    const contextualPrompt = target ? `[目标元素：${target.name}${target.tag ? ` <${target.tag}>` : ""}] ${prompt}` : prompt;
    const controller = new AbortController();
    activeAbortRef.current = controller;
    setThinking(true);
    setRunStatus("running");
    appendAgentEvent({ turnId, type: "context.prepared", label: "已整理视觉上下文", detail: target ? `${target.name} · ${target.tag}` : "当前作品与会话上下文", status: "done" });
    appendAgentEvent({ turnId, type: "model.requested", label: "请求模型下一步", detail: provider?.model || "尚未配置模型", status: "running" });
    if (!provider?.enabled || provider.status !== "ready" || !provider.apiKey || !provider.model) {
      const message = "还没有可用的模型 API。请先到设置 → 模型与 API 配置服务商、API Key 和模型名称，然后重新发送。";
      appendAgentEvent({ turnId, type: "model.requested", label: "模型尚未配置", detail: message, status: "error" });
      updateConversation(conversationId, (current) => ({ ...current, messages: [...current.messages, { id: `m-${Date.now()}-ai`, role: "assistant", content: message, time: currentTime() }] }));
      appendAgentEvent({ turnId, type: "turn.failed", label: "本轮未执行", detail: "没有调用本地演示逻辑，也没有修改作品。", status: "error" });
      setThinking(false);
      setRunStatus("idle");
      activeAbortRef.current = null;
      setToast("请先配置模型 API");
      return;
    }
    let modelReply = "";
    let modelError = "";
    let modelActions: AgentAction[] = [];
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: provider ? { type: provider.type, baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: provider.model } : null,
          systemInstructions: data.agentSettings.systemInstructions,
          messages: [...(conversation?.messages ?? []).slice(-10), { role: "user", content: contextualPrompt }],
          runtime: true,
          artifact: project.artifact,
          target: target ? { id: target.id, name: target.name, tag: target.tag, size: target.size } : null,
          maxToolCalls: data.agentSettings.maxToolCalls,
          attachments: attachments.map(({ id, name, relativePath, kind, mimeType, size, text }) => ({ id, name, relativePath, kind, mimeType, size, text })),
        }),
      });
      if (response.ok) {
        const payload = await response.json() as { content?: string; actions?: AgentAction[] };
        modelReply = payload.content?.trim() ?? "";
        modelActions = Array.isArray(payload.actions) ? payload.actions : [];
      } else {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        modelError = payload.error ?? "模型连接失败";
      }
    } catch (error) {
      if (controller.signal.aborted) {
        appendAgentEvent({ turnId, type: "turn.paused", label: "已停止本次运行", detail: "你可以继续发送新的指令。", status: "waiting" });
        setRunStatus("paused");
        setThinking(false);
        return;
      }
      modelError = error instanceof Error ? error.message : "模型连接失败";
    }
    if (modelError || (!modelReply && modelActions.length === 0)) {
      const message = modelError ? `模型请求失败：${modelError}\n\n请检查 API 地址、密钥和模型名称后重试。本次没有修改作品。` : "模型返回了空响应。本次没有修改作品，请重试。";
      appendAgentEvent({ turnId, type: "model.requested", label: "模型请求失败", detail: modelError || "响应内容为空", status: "error" });
      updateConversation(conversationId, (current) => ({ ...current, messages: [...current.messages, { id: `m-${Date.now()}-ai`, role: "assistant", content: message, time: currentTime() }] }));
      appendAgentEvent({ turnId, type: "turn.failed", label: "本轮未完成", detail: "作品保持原样，未创建新版本。", status: "error" });
      setThinking(false);
      setRunStatus("idle");
      activeAbortRef.current = null;
      setToast("模型请求失败，作品未更改");
      return;
    }
    appendAgentEvent({ turnId, type: "model.requested", label: "模型已返回结果", status: "done" });
    const actions = modelActions;
    const writeActions = actions.filter((action) => action.type !== "context.inspect");
    const hasArtifactChange = writeActions.some((action) => action.type === "artifact.update" || action.type === "artifact.hide" || action.type === "artifact.show");
    const next = hasArtifactChange ? applyAgentActions(project.artifact, writeActions) : project.artifact;
    const annotationActions = writeActions.filter((action): action is Extract<AgentAction, { type: "annotation.create" }> => action.type === "annotation.create");
    if (annotationActions.length) setAnnotations((current) => [...current, ...annotationActions.map((action, index) => ({ id: `a-agent-${Date.now()}-${index}`, x: action.x, y: action.y, note: action.note, author: action.author ?? "Agent", synced: false }))]);
    const summary = modelReply || "模型已完成处理。";
    if (writeActions.length) appendAgentEvent({ turnId, type: "tool.requested", label: "执行结构化工具", detail: writeActions.map((action) => action.type).join("、"), status: "running" });
    if (hasArtifactChange) {
      const versionId = `v-${Date.now()}`;
      const version: VersionEntry = { id: versionId, label: project.hasArtifact ? `AI 修改 ${project.versions.length}` : "初始生成", detail: summary, createdAt: currentTime(), state: next };
      updateProject(projectId, (current) => ({ ...current, hasArtifact: true, artifact: next, activeVersion: versionId, versions: current.hasArtifact ? [...current.versions, version] : [version] }));
      appendAgentEvent({ turnId, type: "tool.completed", label: "结构化修改已应用", detail: summary, status: "done" });
      appendAgentEvent({ turnId, type: "verification.completed", label: "预览验证通过", detail: "作品已重新渲染，目标上下文仍然可定位。", status: "done" });
      appendAgentEvent({ turnId, type: "version.created", label: "已保存新版本", detail: version.label, status: "done" });
    } else if (writeActions.length) {
      appendAgentEvent({ turnId, type: "tool.completed", label: "上下文工具已执行", detail: "没有产生作品写入。", status: "done" });
    }
    updateConversation(conversationId, (current) => ({ ...current, messages: [...current.messages, { id: `m-${Date.now()}-ai`, role: "assistant", content: modelReply || (modelError ? `模型连接提示：${modelError}\n\n${summary} 修改前版本仍可在预览区回退。` : `${summary} 修改前版本仍可在预览区回退。`), time: currentTime() }] }));
    appendAgentEvent({ turnId, type: "turn.completed", label: "本轮 Agent 已完成", detail: hasArtifactChange ? "作品修改已应用并保存新版本。" : "已收到模型回复；本轮未修改作品。", status: "done" });
    if (hasArtifactChange) setData((current) => ({ ...current, previewOpen: true }));
    setThinking(false);
    setRunStatus("idle");
    activeAbortRef.current = null;
    setToast(hasArtifactChange ? "修改已完成并保存新版本" : "收到模型回复");
  }

  function submitCommand(command = chatDraft, options?: { ignoreTarget?: boolean; attachments?: AgentAttachment[] }) {
    const prompt = command.trim();
    if (!prompt || thinking || pendingApproval || !conversation) return;
    activateCapabilitiesFromPrompt(prompt);
    const target = options?.ignoreTarget ? null : selected;
    const projectId = project.id;
    const conversationId = conversation.id;
    const turnId = `turn-${window.crypto.randomUUID()}`;
    const contextualPrompt = target ? `[目标元素：${target.name}${target.tag ? ` <${target.tag}>` : ""}] ${prompt}` : prompt;
    setMessages((current) => [...current, { id: `m-${window.crypto.randomUUID()}`, role: "user", content: contextualPrompt, time: currentTime() }]);
    if (conversation.title === "新对话") updateConversation(conversationId, (current) => ({ ...current, title: prompt.slice(0, 22) }));
    appendAgentEvent({ turnId, type: "turn.started", label: "Agent 已开始工作", detail: target ? `目标：${target.name}` : "当前作品", status: "running" });
    setChatDraft("");
    if (requiresApproval(prompt)) {
      const approval: AgentApprovalRequest = { id: `approval-${window.crypto.randomUUID()}`, turnId, tool: "apply_artifact_patch", detail: `即将修改${target ? `“${target.name}”` : "当前作品"}，并创建新的作品版本。`, prompt, projectId, conversationId, target };
      setPendingApproval(approval);
      setRunStatus("awaiting_approval");
      appendAgentEvent({ turnId, type: "approval.requested", label: "等待你的审批", detail: approval.detail, status: "waiting" });
      return;
    }
    void executeCommand(prompt, target, projectId, conversationId, turnId, options?.attachments);
  }

  function approvePending() {
    if (!pendingApproval) return;
    const approval = pendingApproval;
    setPendingApproval(null);
    appendAgentEvent({ turnId: approval.turnId, type: "approval.granted", label: "已批准工具调用", detail: approval.tool, status: "done" });
    void executeCommand(approval.prompt, approval.target ?? null, approval.projectId, approval.conversationId, approval.turnId);
  }

  function rejectPending() {
    if (!pendingApproval) return;
    const approval = pendingApproval;
    setPendingApproval(null);
    appendAgentEvent({ turnId: approval.turnId, type: "approval.rejected", label: "已拒绝工具调用", detail: "本次修改未执行。", status: "error" });
    appendAgentEvent({ turnId: approval.turnId, type: "turn.paused", label: "Agent 已暂停", detail: "你可以调整指令后重新发送。", status: "waiting" });
    updateConversation(approval.conversationId, (current) => ({ ...current, messages: [...current.messages, { id: `m-${Date.now()}-ai`, role: "assistant", content: "我没有执行这次修改。你可以调整指令后重新发送。", time: currentTime() }] }));
    setRunStatus("idle");
  }

  function stopAgent() {
    activeAbortRef.current?.abort();
    if (!activeAbortRef.current) {
      setThinking(false);
      setRunStatus("paused");
    }
  }

  function applyQuickAction(prompt: string) {
    setChatDraft(prompt);
    if (!selected) setMode("target");
  }

  function activateCapabilitiesFromPrompt(prompt: string) {
    if (!/(增加|添加|启用|安装|接入|加入)/.test(prompt)) return;
    const nextSkills = { ...data.agentSettings.skills };
    const nextExtensions = { ...data.extensions };
    const activated: string[] = [];
    const skillMatches: Array<[string, RegExp]> = [
      ["targeting", /精确定位|点选|框选|视觉定位/],
      ["writing", /文案润色|写作|改文案/],
      ["web-generation", /网页生成|生成网页|网页制作/],
      ["file-analysis", /文件分析|分析文件|读取文件/],
    ];
    for (const [key, pattern] of skillMatches) {
      if (/(skill|技能)/i.test(prompt) && pattern.test(prompt) && !nextSkills[key]) {
        nextSkills[key] = true;
        activated.push(`技能：${key === "targeting" ? "精确定位" : key === "writing" ? "文案润色" : key === "web-generation" ? "网页生成" : "文件分析"}`);
      }
    }
    const pluginMatches: Array<[string, RegExp, string]> = [
      ["plugin-browser", /网页预览|浏览器预览|右侧预览/, "网页预览"],
      ["plugin-export", /文件导出|导出文件|导出能力/, "文件导出"],
    ];
    for (const [id, pattern, label] of pluginMatches) {
      if (/(plugin|插件)/i.test(prompt) && pattern.test(prompt) && !nextExtensions[id]) {
        nextExtensions[id] = true;
        activated.push(`插件：${label}`);
      }
    }
    if (/(mcp|MCP)/.test(prompt) && /(服务器|server|连接|接入|添加|安装)/i.test(prompt)) {
      const endpoint = prompt.match(/https?:\/\/[^\s，。；]+/i)?.[0] ?? prompt.match(/(?:npx|node|python)\s+[^，。；]+/i)?.[0]?.trim();
      if (endpoint && !data.agentSettings.mcpServers.some((server) => server.endpoint === endpoint)) {
        const serverName = endpoint.startsWith("http") ? new URL(endpoint).hostname : "新 MCP 服务器";
        const server = { id: `mcp-${Date.now()}`, name: serverName, transport: endpoint.startsWith("http") ? "http" as const : "stdio" as const, endpoint, enabled: true, requireApproval: true, status: "connected" as const, allowedTools: [] };
        setData((current) => ({ ...current, agentSettings: { ...current.agentSettings, mcpServers: [...current.agentSettings.mcpServers, server], tools: { ...current.agentSettings.tools, mcp: true } } }));
        activated.push(`MCP：${serverName}`);
      } else if (!endpoint) {
        setToast("已识别 MCP 添加请求，请在指令中提供服务器地址或命令");
      }
    }
    if (activated.length) {
      setData((current) => ({ ...current, extensions: nextExtensions, agentSettings: { ...current.agentSettings, skills: nextSkills } }));
      setToast(`已自动启用 ${activated.join("、")}`);
    }
  }

  function restoreVersion(version: VersionEntry) {
    updateProject(project.id, (current) => ({ ...current, artifact: version.state, activeVersion: version.id }));
    setToast(`已回到“${version.label}”`);
  }

  function clearTransientContext() {
    setSelected(null);
    setSelectedRect(null);
    setHovered(null);
    setHoverRect(null);
    setRegion(null);
    regionPointsRef.current = [];
    setActiveThreadId(null);
    setInspectorOpen(false);
    setChatDraft("");
  }

  async function openLocalProject() {
    if (!supportsLocalFolders()) {
      setToast("当前浏览器不支持本地文件夹访问，请使用支持此功能的浏览器");
      return;
    }
    try {
      const directory = await pickDirectory();
      for (const existing of data.projects.filter((item) => item.kind === "folder")) {
        const handle = await loadDirectory(existing.id);
        if (handle && await handle.isSameEntry(directory)) {
          clearTransientContext();
          store.selectProject(existing.id);
          setToast(`已打开“${existing.name}”`);
          return;
        }
      }
      const id = crypto.randomUUID();
      await saveDirectory(id, directory);
      clearTransientContext();
      store.createProject(directory.name, id);
      setToast(`已打开本地文件夹“${directory.name}”`);
    } catch (error) {
      if (!isPickerCancellation(error)) setToast(error instanceof Error ? error.message : "打开文件夹失败，请检查访问权限");
    }
  }

  async function createLocalProject(name: string) {
    if (!supportsLocalFolders()) {
      setToast("当前浏览器不支持创建本地文件夹，请使用支持此功能的浏览器");
      return false;
    }
    try {
      const parent = await pickDirectory();
      try {
        await parent.getDirectoryHandle(name);
        setToast("同名文件夹已存在，请使用“打开本地文件夹”或更换名称");
        return false;
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
      }
      const directory = await parent.getDirectoryHandle(name, { create: true });
      const id = crypto.randomUUID();
      await saveDirectory(id, directory);
      clearTransientContext();
      store.createProject(name, id);
      setToast(`已在“${parent.name}”中新建项目文件夹`);
      return true;
    } catch (error) {
      if (!isPickerCancellation(error)) setToast(error instanceof Error ? error.message : "创建文件夹失败，请检查写入权限");
      return false;
    }
  }

  function openInspector(tab: "props" | "notes" | "versions") {
    setInspectorTab(tab);
    setInspectorOpen(true);
  }

  function resizePreview(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePreviewDivider(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const sidebarSize = data.sidebarCollapsed ? 64 : 272;
    const available = window.innerWidth - sidebarSize - 480;
    const width = Math.max(420, Math.min(900, available, window.innerWidth - event.clientX));
    setData((current) => ({ ...current, previewWidth: width }));
  }

  function syncAnnotations() {
    if (!pendingAnnotations.length) {
      setToast("没有待同步批注");
      return;
    }
    const summary = pendingAnnotations.map((item, index) => `${index + 1}. ${item.note}`).join("；");
    setAnnotations((current) => current.map((item) => ({ ...item, synced: true })));
    submitCommand(`按画布批注统一修改：${summary}`);
  }

  function updateAgentSettings(change: Partial<AgentSettings>) {
    setData((current) => ({ ...current, agentSettings: { ...current.agentSettings, ...change } }));
  }

  function selectModel(providerId: string, model: string) {
    updateAgentSettings({ activeProviderId: providerId, model, providers: data.agentSettings.providers.map((provider) => provider.id === providerId ? { ...provider, model } : provider) });
  }

  function toggleComposerSkill(key: string) {
    const next = !data.agentSettings.skills[key];
    const legacyId = key === "targeting" ? "skill-target" : key === "writing" ? "skill-writing" : key === "web-generation" ? "skill-web" : "skill-files";
    updateAgentSettings({ skills: { ...data.agentSettings.skills, [key]: next } });
    setData((current) => ({ ...current, extensions: { ...current.extensions, [legacyId]: next } }));
  }

  function toggleComposerPlugin(id: string) {
    const next = !data.extensions[id];
    setData((current) => ({ ...current, extensions: { ...current.extensions, [id]: next }, agentSettings: { ...current.agentSettings, tools: { ...current.agentSettings.tools, ...(id === "plugin-mcp" ? { mcp: next } : {}) } } }));
  }

  function notifyImportedFiles(files: FileList | null) {
    if (files?.length) setToast(`已加入 ${files.length} 个文件到当前 Agent 上下文`);
  }

  function notifyImportedFolder(files: FileList | null) {
    if (files?.length) setToast(`已加入文件夹，共 ${files.length} 个文件`);
  }

  function updateAnnotation(id: string, note: string) {
    setAnnotations((current) => current.map((item) => (item.id === id ? { ...item, note, synced: false } : item)));
  }

  function deleteAnnotation(id: string) {
    setAnnotations((current) => current.filter((item) => item.id !== id));
  }

  async function exportArtifact() {
    try {
      const response = await fetch("/studio-board.png");
      if (!response.ok) throw new Error("image unavailable");
      const imageBlob = await response.blob();
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(imageBlob);
      });
      const blob = new Blob([exportHtml(artifact, image)], { type: "text/html;charset=utf-8" });
      if (folderProject.kind === "folder") {
        const directory = await loadDirectory(folderProject.id);
        if (!directory) throw new Error("文件夹连接已失效，请重新打开项目文件夹");
        const filename = `magic-code-${Date.now()}.html`;
        const file = await directory.getFileHandle(filename, { create: true });
        const writable = await file.createWritable();
        await writable.write(blob);
        await writable.close();
        setToast(`已导出到项目文件夹：${filename}`);
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "luma-studio.html";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast("HTML 已导出");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "导出失败，请检查文件夹权限");
    }
  }

  async function shareReview() {
    const link = `${window.location.origin}${window.location.pathname}?demo=1`;
    try {
      await navigator.clipboard.writeText(link);
      setToast("演示链接已复制，作品仍仅保存在本机");
    } catch {
      setToast("协作链接已生成，可从地址栏复制");
    }
  }

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setToast("消息已复制");
    } catch {
      setToast("复制失败，请检查浏览器剪贴板权限");
    }
  }

  function handleMessageSelection() {
    window.setTimeout(() => {
      const active = window.getSelection();
      const text = active?.toString().trim() ?? "";
      if (!text || text.length < 2) {
        setSelectionAction(null);
        return;
      }
      const range = active?.rangeCount ? active.getRangeAt(0) : null;
      const rect = range?.getBoundingClientRect();
      if (!rect) return;
      setSelectionAction({ text, x: Math.min(window.innerWidth - 156, rect.left + rect.width / 2 - 70), y: Math.max(12, rect.top - 44) });
    }, 0);
  }

  function openSideQuestion(source: string) {
    const id = `thread-${Date.now()}`;
    const tag = source.includes("坐标") || source.includes("元素") ? "逻辑疑问" : "文案理解";
    setThreads((current) => [
      ...current,
      {
        id,
        source,
        tag,
        messages: [
          { id: `${id}-context`, role: "assistant", content: "我会只围绕这段选中文字回答，不把内容写回主对话。", time: currentTime() },
        ],
      },
    ]);
    setActiveThreadId(id);
    setThreadDraft("这句话具体是什么意思？");
    setSelectionAction(null);
    window.getSelection()?.removeAllRanges();
  }

  function submitSideQuestion() {
    if (!activeThread || !threadDraft.trim()) return;
    const question = threadDraft.trim();
    const threadId = activeThread.id;
    const conversationId = data.activeConversationId;
    const source = activeThread.source;
    const userMessage: ChatMessage = { id: `side-${window.crypto.randomUUID()}`, role: "user", content: question, time: currentTime() };
    updateConversation(conversationId, (current) => ({ ...current, threads: current.threads.map((thread) => thread.id === threadId ? { ...thread, messages: [...thread.messages, userMessage] } : thread) }));
    setThreadDraft("");
    window.setTimeout(() => {
      const answer: ChatMessage = {
        id: `side-${window.crypto.randomUUID()}-ai`,
        role: "assistant",
        content: `这里强调的是：AI 收到的不只是屏幕上的一个点，还会收到“${source.slice(0, 32)}${source.length > 32 ? "…" : ""}”对应的元素语义，因此修改目标更稳定。`,
        time: currentTime(),
      };
      updateConversation(conversationId, (current) => ({ ...current, threads: current.threads.map((thread) => thread.id === threadId ? { ...thread, messages: [...thread.messages, answer] } : thread) }));
    }, 520);
  }

  function startVoiceInput() {
    type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
    type Recognition = {
      lang: string;
      interimResults: boolean;
      onresult: (event: RecognitionResult) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    type RecognitionConstructor = new () => Recognition;
    const speechWindow = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const RecognitionApi = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionApi) {
      setToast("当前浏览器不支持语音输入");
      return;
    }
    const recognition = new RecognitionApi();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setChatDraft(transcript);
      setListening(false);
    };
    recognition.onerror = () => {
      setListening(false);
      setToast("没有听清，请再试一次");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  return (
    <main className="magic-shell">
      <header className="magic-topbar magic-mobile-topbar">
        <div className="magic-brand-group"><img className="magic-wordmark theme-logo-light" src="/magic-code-logo.png" alt="magiccode" /><img className="magic-wordmark theme-logo-dark" src="/magic-code-logo-dark.png" alt="" aria-hidden="true" /></div>
        <div className="magic-mobile-switch">
          <SegmentedControl selectedKeys={mobileSelection} onSelectionChange={(keys) => setMobileView(Array.from(keys)[0] as "chat" | "canvas")} aria-label="移动端工作区">
            <SegmentedControlItem id="chat">对话</SegmentedControlItem>
            <SegmentedControlItem id="canvas">画布</SegmentedControlItem>
          </SegmentedControl>
        </div>
      </header>

      <section className={cx("magic-workspace", data.sidebarCollapsed && "sidebar-is-collapsed", !data.previewOpen && "preview-is-collapsed", sidebarView === "settings" && "settings-mode")} style={{ "--preview-width": `${data.previewWidth}px` } as React.CSSProperties}>
        <WorkspaceSidebar
          data={data}
          view={sidebarView}
          settingsSection={settingsSection}
          onSettingsSectionChange={setSettingsSection}
          onViewChange={(next) => { setSidebarView(next); if (next === "settings") setSettingsSection("general"); }}
          onChange={(change) => setData((current) => ({ ...current, ...change, ...(change.sidebarCollapsed === false && window.innerWidth <= 1120 ? { previewOpen: false } : {}) }))}
          onNewConversation={(draft) => { clearTransientContext(); setSidebarView("home"); store.createConversation(); if (draft) setChatDraft(draft); }}
          onNewProject={createLocalProject}
          onOpenProject={openLocalProject}
          onNewProjectConversation={(id) => { clearTransientContext(); setSidebarView("home"); store.createConversation(id); }}
          onSelectProject={(id) => { clearTransientContext(); setSidebarView("home"); store.selectProject(id); }}
          onSelectConversation={(id) => { clearTransientContext(); setSidebarView("home"); store.selectConversation(id); }}
          onRenameConversation={store.renameConversation}
          onDeleteConversation={(id) => { clearTransientContext(); store.deleteConversation(id); }}
        />

        {sidebarView === "home" ? <WorkspaceChat
            key={conversation?.id ?? ""} mobileHidden={mobileView !== "chat"} projectName={folderProject.name} projectId={folderProject.id} standalone={folderProject.kind === "standalone"}
            projects={data.projects.filter((item) => item.kind === "folder" || item.kind === "legacy").map((item) => ({ id: item.id, name: item.name }))}
            onSelectProject={(id) => { clearTransientContext(); store.selectProject(id); }} title={conversation?.title ?? "新对话"}
            previewOpen={data.previewOpen} messages={messages} agentEvents={conversation?.events ?? []} pendingApproval={pendingApproval} runStatus={runStatus} contextUsage={contextUsage} modelLabel={modelLabel} providers={data.agentSettings.providers} activeProviderId={data.agentSettings.activeProviderId} activeModel={data.agentSettings.model} permissionMode={data.agentSettings.permissionMode} skills={data.agentSettings.skills} plugins={data.extensions} onSelectModel={selectModel} onPermissionModeChange={(value) => updateAgentSettings({ permissionMode: value })} onToggleSkill={toggleComposerSkill} onTogglePlugin={toggleComposerPlugin} onImportFiles={notifyImportedFiles} onImportFolder={notifyImportedFolder} thinking={thinking} draft={chatDraft} onDraftChange={setChatDraft}
            selected={selected} onClearTarget={() => { setSelected(null); setSelectedRect(null); }} onSubmit={(attachments) => submitCommand(chatDraft, { attachments })} onApprove={approvePending} onReject={rejectPending} onStop={stopAgent}
            onCopyMessage={copyMessage} onResendMessage={(content) => submitCommand(content, { ignoreTarget: true })}
            onQuickAction={applyQuickAction} listening={listening} onVoice={startVoiceInput} onShare={shareReview}
            onOpenPreview={() => setData((current) => ({ ...current, previewOpen: true, sidebarCollapsed: window.innerWidth <= 1120 ? true : current.sidebarCollapsed }))}
            onMessageSelection={handleMessageSelection} threads={threads} activeThread={activeThread}
            onCloseThread={() => setActiveThreadId(null)} onSwitchThread={setActiveThreadId} threadDraft={threadDraft}
            onThreadDraftChange={setThreadDraft} onSubmitSide={submitSideQuestion}
          /> : <WorkspaceControlView view={sidebarView} settingsSection={settingsSection} data={data} agentSettings={data.agentSettings} onBack={() => setSidebarView("home")} onCompose={(prompt) => { setSidebarView("home"); setChatDraft(prompt); }} onChange={(change) => setData((current) => ({ ...current, ...change }))} onAgentSettingsChange={updateAgentSettings} />}

        {data.previewOpen && sidebarView !== "settings" && <div className="preview-resizer" role="separator" aria-label="调整预览宽度" aria-orientation="vertical" tabIndex={0} onPointerDown={resizePreview} onPointerMove={movePreviewDivider} onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            setData((current) => ({ ...current, previewWidth: Math.max(420, Math.min(900, current.previewWidth + (event.key === "ArrowLeft" ? 24 : -24))) }));
          }
        }} />}

        {sidebarView === "settings" ? null : data.previewOpen ? <WorkspacePreview
          projectName={folderProject.name} hasArtifact={project.hasArtifact} mobileHidden={mobileView !== "canvas"}
          artifact={artifact} annotations={annotations} mode={mode} onModeChange={(next) => { setMode(next); setHoverRect(null); if (next !== "region") { setRegion(null); setRegionStart(null); regionPointsRef.current = []; } }}
          compare={compare} onCompareChange={() => setCompare((value) => !value)} compareBefore={compareBefore} compareAfter={compareAfter}
          hovered={hovered} selected={selected} hoverRect={hoverRect} selectedRect={selectedRect} region={region} previewRef={previewRef}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={() => { if (mode === "target") { setHovered(null); setHoverRect(null); } }} onClick={handlePreviewClick}
          onElementAction={(meta) => setToast(`已触发“${meta.name}”`)} inspectorOpen={inspectorOpen} inspectorTab={inspectorTab}
          onOpenInspector={openInspector} onCloseInspector={() => setInspectorOpen(false)} onExport={exportArtifact}
          onCollapse={() => { setInspectorOpen(false); setData((current) => ({ ...current, previewOpen: false })); }}
          pendingCount={pendingAnnotations.length} versions={versions} activeVersion={activeVersion} activeVersionIndex={activeVersionIndex}
          onSyncAnnotations={syncAnnotations} onUpdateAnnotation={updateAnnotation} onDeleteAnnotation={deleteAnnotation}
          onClearSelection={() => { setSelected(null); setSelectedRect(null); }} onRestoreVersion={restoreVersion}
        /> : <button type="button" className={cx("preview-collapsed-tab", mobileView !== "canvas" && "mobile-hidden")} onClick={() => setData((current) => ({ ...current, previewOpen: true, sidebarCollapsed: window.innerWidth <= 1120 ? true : current.sidebarCollapsed }))} aria-label="打开作品预览"><RiEyeLine aria-hidden /><span>预览</span></button>}
      </section>

      {selectionAction && (
        <button type="button" className="selection-question-action" style={{ left: selectionAction.x, top: selectionAction.y }} onClick={() => openSideQuestion(selectionAction.text)}>
          <RiQuestionAnswerLine aria-hidden /> 单独提问
        </button>
      )}

      {toast && <div className="magic-toast" role="status"><RiCheckDoubleLine aria-hidden />{toast}</div>}
    </main>
  );
}
