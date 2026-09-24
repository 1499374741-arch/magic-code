"use client";

import { RiAddLine, RiAnthropicLine, RiArrowDownSLine, RiArrowRightSLine, RiArrowUpLine, RiChat3Line, RiCheckboxCircleLine, RiCloseLine, RiColorFilterLine, RiDeleteBin6Line, RiFile3Line, RiFileCopyLine, RiFileExcel2Line, RiFileTextLine, RiFolder3Line, RiFolderOpenLine, RiFocus3Line, RiFontSize2, RiGeminiLine, RiGitBranchLine, RiLoader4Line, RiMicLine, RiOpenaiLine, RiPencilLine, RiSearchLine, RiSendPlane2Line, RiServerLine, RiShare2Line, RiShieldCheckLine, RiSidebarUnfoldLine, RiSparkling2Line, RiText, RiTerminalBoxLine } from "@remixicon/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { AgentProgress, type AgentProgressStep } from "@/components/application/agent-progress/agent-progress";
import { TaskList, type TaskItem } from "@/components/application/task-list/task-list";
import { WebSearch, type WebSearchStep } from "@/components/application/web-search/web-search";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { TextareaBase } from "@/components/base/textarea/textarea";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { InputBase } from "@/components/base/input/input";
import ParticleText from "@/components/magic-code/particle-text";
import { cx } from "@/utils/cx";
import type { AgentApprovalRequest, AgentEvent, ChatMessage, ElementMeta, SideThread } from "./types";
import type { AgentProvider, AgentSettings } from "./workspace-store";

const QUICK_ACTIONS = [
  { label: "改颜色", icon: RiColorFilterLine, prompt: "把这个元素改成更有活力的绿色" },
  { label: "加文字", icon: RiText, prompt: "给这个区域补一行更具体的说明文字" },
  { label: "调大小", icon: RiFontSize2, prompt: "把这个元素放大一点，并保持周围间距协调" },
  { label: "删除", icon: RiDeleteBin6Line, prompt: "删除这个元素，并重新整理剩余布局" },
];

const COMPOSER_SKILLS = [
  { key: "targeting", label: "精确定位", detail: "点选、框选和元素属性", icon: RiFocus3Line },
  { key: "writing", label: "文案润色", detail: "围绕当前作品调整文案", icon: RiText },
  { key: "web-generation", label: "网页生成", detail: "生成并预览网页作品", icon: RiSparkling2Line },
  { key: "file-analysis", label: "文件分析", detail: "读取项目文件并提取上下文", icon: RiFileTextLine },
];

const COMPOSER_PLUGINS = [
  { id: "plugin-browser", label: "网页预览", detail: "在右侧画布打开生成作品", icon: RiFolderOpenLine },
  { id: "plugin-export", label: "文件导出", detail: "导出 Agent 生成的任意内容", icon: RiFile3Line },
];

const PERMISSION_MODES: Array<{ value: AgentSettings["permissionMode"]; label: string; detail: string; icon: typeof RiShieldCheckLine }> = [
  { value: "auto", label: "自动", detail: "Agent 自行决定", icon: RiCheckboxCircleLine },
  { value: "manual", label: "手动", detail: "每次修改前都询问", icon: RiGitBranchLine },
  { value: "plan", label: "计划模式", detail: "先创建计划再执行", icon: RiArrowUpLine },
  { value: "bypass", label: "全部跳过", detail: "Agent 自动处理权限", icon: RiShieldCheckLine },
];

const PROVIDER_ICONS: Record<AgentProvider["type"], typeof RiOpenaiLine> = {
  openai: RiOpenaiLine,
  anthropic: RiAnthropicLine,
  google: RiGeminiLine,
  "openai-compatible": RiServerLine,
  local: RiTerminalBoxLine,
};

const DEFAULT_MODELS: Record<AgentProvider["type"], string[]> = {
  openai: ["gpt-5.6 Mini", "gpt-5.6 Terra", "gpt-5.6 Sol", "gpt-5.5", "gpt-5.5 Mini", "gpt-5.4"],
  anthropic: ["Claude Sonnet 4", "Claude Opus 4", "Claude Haiku 3.5"],
  google: ["Gemini 2.5 Pro", "Gemini 2.5 Flash"],
  "openai-compatible": [],
  local: [],
};

function PermissionMenu({ value, onChange, compact = false }: { value: AgentSettings["permissionMode"]; onChange: (value: AgentSettings["permissionMode"]) => void; compact?: boolean }) {
  const current = PERMISSION_MODES.find((mode) => mode.value === value) ?? PERMISSION_MODES[0];
  const CurrentIcon = current.icon;
  return <Dropdown><DropdownTrigger className={compact ? "composer-permission-trigger composer-permission-trigger-compact" : "composer-permission-trigger"} aria-label={`权限模式：${current.label}`}><CurrentIcon aria-hidden /><span>{current.label}</span>{!compact && <RiArrowDownSLine aria-hidden />}</DropdownTrigger><DropdownPopover aria-label="权限模式" placement="top start" className="permission-picker-popover"><div className="permission-picker-heading"><span>Permissions</span><button type="button" onClick={() => undefined}>Learn more</button></div><DropdownGroup>{PERMISSION_MODES.map((mode) => { const ModeIcon = mode.icon; return <DropdownItem key={mode.value} selected={mode.value === value} onSelect={() => onChange(mode.value)}><ModeIcon className="permission-picker-icon" aria-hidden /><span className="permission-picker-copy"><strong>{mode.label}</strong><small>{mode.detail}</small></span></DropdownItem>; })}</DropdownGroup></DropdownPopover></Dropdown>;
}

function ContextUsage({ percent, compacting, detail }: { percent: number; compacting: boolean; detail: string }) {
  return <TooltipTrigger><span className={cx("composer-context-usage", compacting && "is-compacting")} tabIndex={0} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`上下文使用量 ${percent}%`}><span className="context-usage-ring" style={{ "--context-progress": `${percent}%` } as React.CSSProperties}><span>{percent}</span></span>{compacting && <span>压缩中</span>}</span><Tooltip>{detail}</Tooltip></TooltipTrigger>;
}

function ModelPicker({ isOpen, onOpenChange, providers, activeProviderId, model, modelLabel, onSelect }: { isOpen: boolean; onOpenChange: (open: boolean) => void; providers: AgentProvider[]; activeProviderId: string; model: string; modelLabel: string; onSelect: (providerId: string, model: string) => void }) {
  const [search, setSearch] = useState("");
  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers[0];
  const [providerId, setProviderId] = useState(activeProvider?.id ?? "");
  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? activeProvider;
  const Icon = selectedProvider ? PROVIDER_ICONS[selectedProvider.type] : RiOpenaiLine;
  const modelOptions = selectedProvider ? Array.from(new Set([...(DEFAULT_MODELS[selectedProvider.type] ?? []), selectedProvider.model].filter(Boolean))) : [];
  const filteredModels = modelOptions.filter((item) => item.toLowerCase().includes(search.toLowerCase()));
  return <Dropdown isOpen={isOpen} onOpenChange={onOpenChange}><DropdownTrigger className="composer-model-trigger" aria-label={`选择模型：${modelLabel}`}><span>{modelLabel}</span><RiArrowDownSLine aria-hidden /></DropdownTrigger><DropdownPopover aria-label="模型选择" placement="top end" className="model-picker-popover" dialogClassName="model-picker-dialog"><div className="model-picker"><aside className="model-picker-rail" aria-label="模型供应商">{providers.map((provider) => { const ProviderIcon = PROVIDER_ICONS[provider.type]; return <button type="button" key={provider.id} className={cx("model-provider-button", provider.id === selectedProvider?.id && "active")} onClick={() => { setProviderId(provider.id); setSearch(""); }} aria-label={provider.name} title={provider.name}><ProviderIcon aria-hidden /></button>; })}</aside><div className="model-picker-content"><header className="model-picker-header"><div><strong>Models</strong><small>{selectedProvider?.name ?? "选择供应商"}</small></div><InputBase size="small" leadingIcon={RiSearchLine} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Quick Search" aria-label="搜索模型" /></header><div className="model-picker-list">{filteredModels.map((option) => <button type="button" className={cx("model-option", selectedProvider?.id === activeProviderId && option === model && "active")} key={option} onClick={() => { if (selectedProvider) onSelect(selectedProvider.id, option); onOpenChange(false); }}><Icon aria-hidden /><span>{option}</span>{selectedProvider?.id === activeProviderId && option === model && <RiCheckboxCircleLine aria-hidden />}</button>)}{!filteredModels.length && <p className="model-picker-empty">没有匹配的模型，请先在设置中填写模型名称。</p>}</div></div></div></DropdownPopover></Dropdown>;
}

export interface AgentAttachment {
  id: string;
  name: string;
  kind: "image" | "document" | "spreadsheet";
  src?: string;
  relativePath?: string;
  mimeType?: string;
  size?: number;
  text?: string;
  progress: number;
}

type NewAttachment = AgentAttachment;

function attachmentKind(file: File): NewAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.includes("spreadsheet") || /\.(xlsx?|csv)$/i.test(file.name)) return "spreadsheet";
  return "document";
}

async function readAttachment(file: File): Promise<NewAttachment> {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined;
  const textLike = file.type.startsWith("text/") || /\.(md|mdx|txt|json|js|jsx|ts|tsx|css|scss|html|xml|yaml|yml|csv|sql|py|go|rs|java|kt|swift|sh)$/i.test(file.name);
  let text: string | undefined;
  if (textLike && file.size <= 160_000) {
    try {
      text = await file.text();
    } catch {
      text = undefined;
    }
  }
  return {
    id: `${file.name}-${file.lastModified}-${Math.random()}`,
    name: relativePath || file.name,
    relativePath,
    kind: attachmentKind(file),
    mimeType: file.type || undefined,
    size: file.size,
    text,
    src: file.type.startsWith("image/") && file.size <= 2_000_000 ? URL.createObjectURL(file) : undefined,
    progress: 100,
  };
}

function NewChatComposer({ draft, onDraftChange, onSubmit, modelOpen, onModelOpen, listening, onVoice, thinking, modelLabel, permissionMode, onPermissionModeChange, providers, activeProviderId, activeModel, onSelectModel, contextUsage }: { draft: string; onDraftChange: (value: string) => void; onSubmit: (attachments?: AgentAttachment[]) => void; modelOpen: boolean; onModelOpen: (open: boolean) => void; listening: boolean; onVoice: () => void; thinking: boolean; modelLabel: string; permissionMode: AgentSettings["permissionMode"]; onPermissionModeChange: (value: AgentSettings["permissionMode"]) => void; providers: AgentProvider[]; activeProviderId: string; activeModel: string; onSelectModel: (providerId: string, model: string) => void; contextUsage: { percent: number; compacting: boolean; detail: string } }) {
  const [attachments, setAttachments] = useState<NewAttachment[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!attachments.some((item) => item.progress < 100)) return;
    const timer = window.setInterval(() => setAttachments((current) => current.map((item) => item.progress >= 100 ? item : { ...item, progress: Math.min(100, item.progress + 18) })), 100);
    return () => window.clearInterval(timer);
  }, [attachments]);
  function addFiles(files: FileList | null) {
    if (!files) return;
    void Promise.all(Array.from(files).map(readAttachment)).then((next) => setAttachments((current) => [...current, ...next]));
  }
  function removeFile(id: string) { setAttachments((current) => current.filter((item) => item.id !== id)); }
  return <div className="new-chat-stage-composer">
    <div className="new-chat-context-bar"><span><RiGitBranchLine aria-hidden /> Main</span><span><RiFolder3Line aria-hidden /> project-local</span><PermissionMenu value={permissionMode} onChange={onPermissionModeChange} compact /><ContextUsage {...contextUsage} /></div>
    <div className="new-chat-input-shell">
      {!!attachments.length && <div className="new-chat-inline-attachments" aria-label="已添加附件">{attachments.map((item) => { const Icon = item.kind === "spreadsheet" ? RiFileExcel2Line : item.kind === "document" ? RiFileTextLine : RiFile3Line; return <div className="new-chat-inline-attachment" key={item.id}>{item.src ? <img src={item.src} alt="" /> : <Icon aria-hidden />}<span title={item.name}>{item.name}</span>{item.progress < 100 ? <small><RiLoader4Line aria-hidden />{item.progress}%</small> : <button type="button" aria-label={`移除${item.name}`} onClick={() => removeFile(item.id)}><RiCloseLine aria-hidden /></button>}</div>; })}</div>}
      <TextareaBase rows={1} autoResize maxRows={5} value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Hi, what do you need today?" aria-label="发送给主 Agent 的指令" fieldClassName="new-chat-prompt-field" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(attachments); } }} />
      <div className="new-chat-input-actions"><Dropdown isOpen={addOpen} onOpenChange={setAddOpen}><DropdownTrigger className="new-chat-add" aria-label="添加文件与文件夹"><RiAddLine aria-hidden /></DropdownTrigger><DropdownPopover aria-label="文件与文件夹" placement="top start" className="composer-add-popover"><DropdownGroup label="文件与文件夹"><DropdownItem onSelect={() => { fileInput.current?.click(); setAddOpen(false); }}><RiFile3Line className="size-4 text-foreground-icon-secondary" aria-hidden /><span className="composer-menu-item-copy"><strong>导入文件</strong><small>支持任意文件格式</small></span></DropdownItem><DropdownItem onSelect={() => { folderInput.current?.click(); setAddOpen(false); }}><RiFolderOpenLine className="size-4 text-foreground-icon-secondary" aria-hidden /><span className="composer-menu-item-copy"><strong>导入文件夹</strong><small>把整个目录加入当前上下文</small></span></DropdownItem></DropdownGroup></DropdownPopover></Dropdown><span className="new-chat-action-spacer" /><ModelPicker isOpen={modelOpen} onOpenChange={onModelOpen} providers={providers} activeProviderId={activeProviderId} model={activeModel} modelLabel={modelLabel} onSelect={onSelectModel} /><button type="button" className={cx("new-chat-mic", listening && "voice-button-listening")} onClick={onVoice} aria-label="语音输入"><RiMicLine aria-hidden /></button><button type="button" className="new-chat-send" disabled={!draft.trim() || thinking} onClick={() => onSubmit(attachments)} aria-label="发送指令"><RiArrowUpLine aria-hidden /></button></div>
    </div>
    <input ref={fileInput} type="file" multiple hidden onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} />
    <input ref={folderInput} type="file" multiple hidden {...({ webkitdirectory: "", directory: "" } as unknown as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} />
  </div>;
}

interface Props {
  mobileHidden: boolean;
  projectName: string;
  projectId: string;
  standalone: boolean;
  projects: Array<{ id: string; name: string }>;
  onSelectProject: (id: string) => void;
  title: string;
  previewOpen: boolean;
  messages: ChatMessage[];
  agentEvents: AgentEvent[];
  pendingApproval: AgentApprovalRequest | null;
  runStatus: "idle" | "running" | "awaiting_approval" | "paused";
  contextUsage: { percent: number; compacting: boolean; detail: string };
  modelLabel: string;
  providers: AgentProvider[];
  activeProviderId: string;
  activeModel: string;
  permissionMode: AgentSettings["permissionMode"];
  skills: Record<string, boolean>;
  plugins: Record<string, boolean>;
  onSelectModel: (providerId: string, model: string) => void;
  onPermissionModeChange: (value: AgentSettings["permissionMode"]) => void;
  onToggleSkill: (key: string) => void;
  onTogglePlugin: (id: string) => void;
  onImportFiles: (files: FileList | null) => void;
  onImportFolder: (files: FileList | null) => void;
  thinking: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  selected: ElementMeta | null;
  onClearTarget: () => void;
  onSubmit: (attachments?: AgentAttachment[]) => void;
  onApprove: () => void;
  onReject: () => void;
  onStop: () => void;
  onCopyMessage: (content: string) => void;
  onResendMessage: (content: string) => void;
  onQuickAction: (prompt: string) => void;
  listening: boolean;
  onVoice: () => void;
  onShare: () => void;
  onOpenPreview: () => void;
  onMessageSelection: () => void;
  threads: SideThread[];
  activeThread: SideThread | null;
  onCloseThread: () => void;
  onSwitchThread: (id: string) => void;
  threadDraft: string;
  onThreadDraftChange: (value: string) => void;
  onSubmitSide: () => void;
}

export function WorkspaceChat({ mobileHidden, projectName, projectId, standalone, projects, onSelectProject, title, previewOpen, messages, agentEvents, pendingApproval, runStatus, contextUsage, modelLabel, providers, activeProviderId, activeModel, permissionMode, skills, plugins, onSelectModel, onPermissionModeChange, onToggleSkill, onTogglePlugin, onImportFiles, onImportFolder, thinking, draft, onDraftChange, selected, onClearTarget, onSubmit, onApprove, onReject, onStop, onCopyMessage, onResendMessage, onQuickAction, listening, onVoice, onShare, onOpenPreview, onMessageSelection, threads, activeThread, onCloseThread, onSwitchThread, threadDraft, onThreadDraftChange, onSubmitSide }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [attachments, setAttachments] = useState<NewAttachment[]>([]);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function queueAttachments(files: FileList | null, notify = true) {
    if (!files?.length) return;
    void Promise.all(Array.from(files).map(readAttachment)).then((next) => setAttachments((current) => [...current, ...next]));
    if (notify) onImportFiles(files);
  }

  function resendMessage() {
    if (!editDraft.trim() || thinking) return;
    onResendMessage(editDraft.trim());
    setEditingId(null);
    setEditDraft("");
  }

  useLayoutEffect(() => {
    if (mobileHidden) return;
    const scroll = messageScrollRef.current;
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }, [messages.length, thinking, title, mobileHidden]);

  const latestPrompt = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
  const activeTurnId = agentEvents.at(-1)?.turnId;
  const activeEvents = activeTurnId ? agentEvents.filter((event) => event.turnId === activeTurnId) : [];
  const progressSteps: AgentProgressStep[] = activeEvents.slice(-8).map((event) => ({ label: event.detail ? `${event.label}：${event.detail}` : event.label, status: event.status === "running" ? "running" : event.status === "done" ? "done" : "pending" }));
  const taskGroups: Array<{ title: string; icon: typeof RiSearchLine; types: AgentEvent["type"][] }> = [
    { title: "整理项目上下文", icon: RiSearchLine, types: ["context.prepared"] },
    { title: "执行作品修改", icon: RiFileTextLine, types: ["model.requested", "approval.granted", "tool.requested", "tool.completed"] },
    { title: "验证并保存版本", icon: RiCheckboxCircleLine, types: ["verification.completed", "version.created", "turn.completed"] },
  ];
  const taskItems: TaskItem[] = taskGroups.flatMap((group) => {
    const events = activeEvents.filter((event) => group.types.includes(event.type));
    if (!events.length) return [];
    const status: TaskItem["status"] = events.some((event) => event.status === "running") ? "running" : events.every((event) => event.status === "done") ? "done" : "pending";
    return [{ title: group.title, runningTitle: `${group.title}…`, icon: group.icon, status, steps: events.map((event) => ({ label: event.label, status: event.status === "running" ? "running" : event.status === "done" ? "done" : "pending", chips: event.detail && event.type === "version.created" ? [{ label: event.detail }] : undefined })) }];
  });
  const searchText = `${latestPrompt} ${activeEvents.map((event) => `${event.label} ${event.detail ?? ""}`).join(" ")}`;
  const matchedSearchSteps = activeEvents.filter((event) => /搜索|联网|资料|web\s*search/i.test(`${event.label} ${event.detail ?? ""}`)).map((event) => ({ label: event.label, query: event.detail, meta: event.status === "done" ? "已完成" : "进行中" }));
  const webSearchSteps: WebSearchStep[] = /搜索|联网|资料|web\s*search/i.test(searchText)
    ? [{ label: matchedSearchSteps.length > 1 ? `已完成 ${matchedSearchSteps.length} 次检索` : "网络检索", icon: RiSearchLine, heading: true }, ...(matchedSearchSteps.length ? matchedSearchSteps : [{ label: "准备网络检索", query: latestPrompt, meta: thinking ? "等待结果" : "已完成" }])]
    : [];

  return <section className={cx("chat-pane", mobileHidden && "mobile-hidden", !messages.length && "new-chat-pane")} aria-label="主对话">
    <header className="pane-header">
      <div className="chat-heading">{!standalone && <><RiFolder3Line className="chat-heading-folder" aria-hidden /><span className="chat-heading-project" title={projectName}>{projectName}</span><RiArrowRightSLine className="chat-heading-separator" aria-hidden /></>}<h2 title={title}>{title}</h2></div>
      <div className="chat-header-actions">
        <TooltipTrigger><IconButton icon={RiShare2Line} size="small" aria-label="复制演示链接" onClick={onShare} /><Tooltip>复制演示链接</Tooltip></TooltipTrigger>
        {!previewOpen && <Button size="small" variant="secondary" leadingIcon={RiSidebarUnfoldLine} onClick={onOpenPreview}>打开预览</Button>}
      </div>
    </header>

    <div className={cx("message-scroll", !messages.length && "new-chat-scroll")} ref={messageScrollRef} onMouseUp={(event) => {
      if (!(event.target instanceof HTMLElement && event.target.closest("textarea, button"))) onMessageSelection();
    }}>
      <div className="message-inner">
        {!!activeEvents.length && <section className="agent-activity-stack" aria-label="Agent 过程可视化"><AgentProgress steps={progressSteps} running={thinking} />{taskItems.length > 0 && <TaskList tasks={taskItems} />}{webSearchSteps.length > 0 && <WebSearch steps={webSearchSteps} working={thinking} />}</section>}
        {!messages.length && <div className="new-chat-stage"><div className="new-chat-particle-stage"><ParticleText text="Magicode" particleSize={2.2} density={4} color="var(--particle-base-color)" highlightColor="var(--particle-highlight-color)" scatter={190} gatherDuration={1600} stagger={420} pointerRepel={42} repelRadius={120} idleDrift={0.8} trigger="mount" fontSize="clamp(2rem, 6.5vw, 4.5rem)" fontWeight={800} fontFamily="inherit" glow /></div><NewChatComposer draft={draft} onDraftChange={onDraftChange} onSubmit={onSubmit} modelOpen={modelOpen} onModelOpen={setModelOpen} listening={listening} onVoice={onVoice} thinking={thinking} modelLabel={modelLabel} permissionMode={permissionMode} onPermissionModeChange={onPermissionModeChange} providers={providers} activeProviderId={activeProviderId} activeModel={activeModel} onSelectModel={onSelectModel} contextUsage={contextUsage} /></div>}
        {messages.map((message) => <article key={message.id} className={cx("message-row", message.role === "user" && "message-row-user")}>
          <div className="message-content">
            {editingId === message.id ? <div className="message-edit">
              <TextareaBase autoFocus rows={2} autoResize maxRows={8} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} aria-label="编辑消息内容" fieldClassName="message-edit-field" onKeyDown={(event) => {
                if (event.key === "Escape") { setEditingId(null); setEditDraft(""); }
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); resendMessage(); }
              }} />
              <div className="message-edit-actions">
                <Button size="small" variant="secondary" onClick={() => { setEditingId(null); setEditDraft(""); }}>取消</Button>
                <Button size="small" disabled={!editDraft.trim() || thinking} onClick={resendMessage}>重新发送</Button>
              </div>
            </div> : <>
              <div className={cx("message-bubble", message.role === "user" && "message-bubble-user")}><p>{message.content}</p></div>
              <div className="message-actions">
                <TooltipTrigger><IconButton icon={RiFileCopyLine} size="small" className="message-action-button" aria-label="复制消息" onClick={() => onCopyMessage(message.content)} /><Tooltip>复制</Tooltip></TooltipTrigger>
                {message.role === "user" && <TooltipTrigger><IconButton icon={RiPencilLine} size="small" className="message-action-button" aria-label="编辑并重新发送消息" onClick={() => { setEditingId(message.id); setEditDraft(message.content); }} /><Tooltip>编辑并重新发送</Tooltip></TooltipTrigger>}
              </div>
            </>}
          </div>
        </article>)}
      </div>
    </div>

    {!!messages.length && <div className="chat-composer-wrap"><div className="composer-inner">
      <div className="composer-status-slot" aria-live="polite">{thinking && <><AgentThinking variant="wave" label="Agent 正在运行" className="composer-thinking" /><Button size="xs" variant="secondary" onClick={onStop}>停止</Button></>}{pendingApproval && <span className="composer-approval-hint">等待审批后继续</span>}{runStatus === "paused" && !thinking && !pendingApproval && <span className="composer-approval-hint">本轮已暂停，可继续发送指令</span>}</div>
      {pendingApproval && <section className="agent-approval-card" aria-label="Agent 审批请求"><div><strong>Agent 请求执行工具</strong><p>{pendingApproval.detail}</p><small>工具：{pendingApproval.tool}</small></div><div className="agent-approval-actions"><Button size="small" variant="secondary" onClick={onReject}>拒绝</Button><Button size="small" onClick={onApprove}>允许这次</Button></div></section>}
      <div className="chat-composer">
        {selected && <div className="composer-target"><RiFocus3Line aria-hidden /><span>{selected.name}</span><button type="button" aria-label="清除目标" onClick={onClearTarget}><RiCloseLine aria-hidden /></button></div>}
        {!!attachments.length && <div className="composer-attachments" aria-label="已导入文件与文件夹">{attachments.map((item) => <div className="composer-attachment" key={item.id}>{item.src ? <img src={item.src} alt="" /> : <RiFileTextLine aria-hidden />}<span title={item.name}>{item.name}</span><button type="button" aria-label={`移除${item.name}`} onClick={() => setAttachments((current) => current.filter((entry) => entry.id !== item.id))}><RiCloseLine aria-hidden /></button></div>)}</div>}
        <div className="composer-main-row">
          <Dropdown isOpen={addOpen} onOpenChange={setAddOpen}>
            <DropdownTrigger className="composer-round-button composer-add-button" aria-label="添加内容与快捷指令"><RiAddLine aria-hidden /></DropdownTrigger>
            <DropdownPopover aria-label="文件、技能和插件" placement="top start" className="composer-add-popover">
              <DropdownGroup label="文件与文件夹"><DropdownItem onSelect={() => { fileInputRef.current?.click(); setAddOpen(false); }}><RiFile3Line className="size-4 text-foreground-icon-secondary" aria-hidden /><span className="composer-menu-item-copy"><strong>导入文件</strong><small>支持任意文件格式</small></span></DropdownItem><DropdownItem onSelect={() => { folderInputRef.current?.click(); setAddOpen(false); }}><RiFolderOpenLine className="size-4 text-foreground-icon-secondary" aria-hidden /><span className="composer-menu-item-copy"><strong>导入文件夹</strong><small>把整个目录加入当前上下文</small></span></DropdownItem></DropdownGroup>
              <DropdownGroup label="技能"><div className="composer-capability-list">{COMPOSER_SKILLS.map((skill) => { const Icon = skill.icon; const enabled = Boolean(skills[skill.key]); return <DropdownItem key={skill.key} selected={enabled} onSelect={() => onToggleSkill(skill.key)}><Icon className="size-4 text-foreground-icon-secondary" aria-hidden /><span className="composer-menu-item-copy"><strong>{skill.label}</strong><small>{skill.detail}</small></span><span className={cx("composer-capability-state", enabled && "active")}>{enabled ? "已启用" : "启用"}</span></DropdownItem>; })}</div></DropdownGroup>
              <DropdownGroup label="插件"><div className="composer-capability-list">{COMPOSER_PLUGINS.map((plugin) => { const Icon = plugin.icon; const enabled = Boolean(plugins[plugin.id]); return <DropdownItem key={plugin.id} selected={enabled} onSelect={() => onTogglePlugin(plugin.id)}><Icon className="size-4 text-foreground-icon-secondary" aria-hidden /><span className="composer-menu-item-copy"><strong>{plugin.label}</strong><small>{plugin.detail}</small></span><span className={cx("composer-capability-state", enabled && "active")}>{enabled ? "已启用" : "启用"}</span></DropdownItem>; })}</div></DropdownGroup>
              <DropdownGroup label="常用指令">{QUICK_ACTIONS.map((action) => { const Icon = action.icon; return <DropdownItem key={action.label} onSelect={() => { onQuickAction(action.prompt); setAddOpen(false); }}><Icon className="size-4 text-foreground-icon-secondary" aria-hidden /><span>{action.label}</span></DropdownItem>; })}</DropdownGroup>
            </DropdownPopover>
          </Dropdown>
          <TextareaBase rows={1} autoResize maxRows={5} value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="问我任何问题…" aria-label="发送给主 Agent 的指令" fieldClassName="composer-field" className="composer-textarea" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(attachments); } }} />
          <ModelPicker isOpen={modelOpen} onOpenChange={setModelOpen} providers={providers} activeProviderId={activeProviderId} model={activeModel} modelLabel={modelLabel} onSelect={onSelectModel} />
          <TooltipTrigger><button type="button" className={cx("composer-round-button", "composer-voice-button", listening && "voice-button-listening")} onClick={onVoice} aria-label="语音输入"><RiMicLine aria-hidden /></button><Tooltip>{listening ? "正在听…" : "语音输入"}</Tooltip></TooltipTrigger>
          <TooltipTrigger><button type="button" className="composer-send-button" disabled={!draft.trim() || thinking} onClick={() => onSubmit(attachments)} aria-label="发送指令"><RiArrowUpLine aria-hidden /></button><Tooltip>发送指令</Tooltip></TooltipTrigger>
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple hidden onChange={(event) => { queueAttachments(event.target.files); event.currentTarget.value = ""; }} />
      <input ref={folderInputRef} type="file" multiple hidden {...({ webkitdirectory: "", directory: "" } as unknown as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(event) => { onImportFolder(event.target.files); queueAttachments(event.target.files, false); event.currentTarget.value = ""; }} />
      <div className="composer-context-row">
        <div className="composer-context-left">
          <TooltipTrigger><span className="composer-context-static" tabIndex={0}><RiGitBranchLine aria-hidden /><span>本地</span></span><Tooltip>本地演示，尚未关联 Git 分支</Tooltip></TooltipTrigger>
          {standalone ? <span className="composer-context-static"><RiChat3Line aria-hidden /><span>独立对话</span></span> : <Dropdown isOpen={projectOpen} onOpenChange={setProjectOpen}>
            <DropdownTrigger className="composer-context-trigger composer-project-trigger" aria-label={`当前项目：${projectName}`}><RiFolder3Line aria-hidden /><span>{projectName}</span><RiArrowDownSLine aria-hidden /></DropdownTrigger>
            <DropdownPopover aria-label="切换项目" placement="top start"><DropdownGroup label="项目记录">{projects.map((item) => <DropdownItem key={item.id} selected={item.id === projectId} onSelect={() => { onSelectProject(item.id); setProjectOpen(false); }}><RiFolder3Line className="size-4 text-foreground-icon-secondary" aria-hidden /><span className="min-w-0 truncate text-body-2-medium">{item.name}</span></DropdownItem>)}</DropdownGroup></DropdownPopover>
          </Dropdown>}
        </div>
        <div className="composer-context-right">
          <PermissionMenu value={permissionMode} onChange={onPermissionModeChange} compact />
          <ContextUsage {...contextUsage} />
        </div>
      </div>
    </div></div>}

    {activeThread && <aside className="side-thread-panel" aria-label="独立追问小窗">
      <header><div><span>独立追问</span><Chip color="purple" variant="caption">{activeThread.tag}</Chip></div><IconButton icon={RiCloseLine} size="small" aria-label="关闭独立追问" onClick={onCloseThread} /></header>
      {threads.length > 1 && <div className="thread-switcher">{threads.map((thread, index) => <button type="button" key={thread.id} className={thread.id === activeThread.id ? "active" : ""} onClick={() => onSwitchThread(thread.id)}>问题 {index + 1}</button>)}</div>}
      <blockquote>{activeThread.source}</blockquote>
      <div className="side-thread-messages">{activeThread.messages.map((message) => <p key={message.id} className={message.role}>{message.content}</p>)}</div>
      <div className="side-thread-composer"><TextareaBase rows={2} value={threadDraft} onChange={(event) => onThreadDraftChange(event.target.value)} aria-label="独立追问内容" placeholder="只问这段内容…" /><Button size="small" leadingIcon={RiSendPlane2Line} onClick={onSubmitSide}>提问</Button></div>
    </aside>}
  </section>;
}
