"use client";

import {
  RiAddLine, RiArrowDownSLine, RiArrowLeftLine, RiBookOpenLine, RiCameraLine, RiChat3Line,
  RiCodeBoxLine, RiComputerLine, RiDownload2Line, RiFolder3Line, RiFolderOpenLine,
  RiDeleteBin6Line, RiEditLine, RiFolderSettingsLine, RiGitBranchLine, RiKeyboardLine, RiLinksLine,
  RiPuzzle2Line, RiSearchLine, RiSettings3Line, RiSidebarFoldLine, RiSidebarUnfoldLine,
  RiSparklingLine, RiSunLine, RiTerminalLine, RiWindowLine,
} from "@remixicon/react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { InputBase } from "@/components/base/input/input";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";
import type { WorkspaceData } from "./workspace-store";

export type SidebarView = "home" | "plugins" | "skills" | "settings";
export type SettingsSection = "general" | "models" | "permissions" | "appearance" | "instructions" | "tools" | "workspace" | "shortcuts" | "preview" | "exports" | "mcp" | "browser" | "hooks" | "connections" | "git" | "environment";

export const settingsSections: Array<{ id: SettingsSection; label: string; icon: typeof RiSettings3Line; group?: string }> = [
  { id: "general", label: "常规", icon: RiSettings3Line, group: "个人" },
  { id: "models", label: "模型与 API", icon: RiTerminalLine },
  { id: "permissions", label: "权限与安全", icon: RiFolderSettingsLine },
  { id: "appearance", label: "外观", icon: RiSunLine },
  { id: "instructions", label: "Agent 指令", icon: RiSparklingLine },
  { id: "tools", label: "工具与 MCP", icon: RiPuzzle2Line },
  { id: "workspace", label: "项目工作区", icon: RiFolder3Line },
  { id: "shortcuts", label: "键盘快捷键", icon: RiKeyboardLine },
  { id: "preview", label: "网页预览", icon: RiWindowLine, group: "集成" },
  { id: "exports", label: "文件导出", icon: RiDownload2Line },
  { id: "mcp", label: "MCP 服务器", icon: RiLinksLine },
  { id: "browser", label: "浏览器", icon: RiCameraLine },
  { id: "hooks", label: "钩子", icon: RiCodeBoxLine, group: "编码" },
  { id: "connections", label: "连接", icon: RiLinksLine },
  { id: "git", label: "Git", icon: RiGitBranchLine },
  { id: "environment", label: "环境", icon: RiComputerLine },
];

function recentLabel(updatedAt: number) {
  if (updatedAt <= 1) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时`;
  return `${Math.floor(minutes / 1440)}天`;
}

interface Props {
  data: WorkspaceData;
  onChange: (change: Partial<WorkspaceData>) => void;
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  settingsSection: SettingsSection;
  onSettingsSectionChange: (section: SettingsSection) => void;
  onNewConversation: (draft?: string) => void;
  onNewProject: (name: string) => Promise<boolean>;
  onOpenProject: () => Promise<void>;
  onNewProjectConversation: (id: string) => void;
  onSelectProject: (id: string) => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function WorkspaceSidebar({ data, onChange, view, onViewChange, settingsSection, onSettingsSectionChange, onNewConversation, onNewProject, onOpenProject, onNewProjectConversation, onSelectProject, onSelectConversation, onRenameConversation, onDeleteConversation }: Props) {
  const [query, setQuery] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const cancelRenameRef = useRef(false);
  const collapsed = data.sidebarCollapsed;
  const search = query.trim().toLowerCase();
  const projects = [...data.projects].filter((item) => item.kind === "folder" || item.kind === "legacy").sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((item) => !search || item.name.toLowerCase().includes(search) || data.conversations.some((chat) => chat.projectId === item.id && chat.title.toLowerCase().includes(search)));
  const standalone = [...data.conversations].filter((chat) => data.projects.find((item) => item.id === chat.projectId)?.kind === "standalone" && (!search || chat.title.toLowerCase().includes(search))).sort((a, b) => b.updatedAt - a.updatedAt);

  useEffect(() => {
    if (!editingId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editingId]);

  function openConversationMenu(event: MouseEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    setContextMenu({ id, x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 110) });
  }

  function startRename(id: string) {
    const conversation = data.conversations.find((item) => item.id === id);
    if (!conversation) return;
    setEditTitle(conversation.title);
    cancelRenameRef.current = false;
    setEditingId(id);
    setContextMenu(null);
  }

  function saveRename(id: string) {
    const title = editTitle.trim();
    if (title) onRenameConversation(id, title);
    setEditingId(null);
  }

  function renderConversation(chat: WorkspaceData["conversations"][number]) {
    const active = chat.id === data.activeConversationId;
    return <div className="sidebar-conversation-entry" key={chat.id}>
      {editingId === chat.id ? <form className="sidebar-conversation-rename" onSubmit={(event) => { event.preventDefault(); saveRename(chat.id); }}>
        <RiChat3Line aria-hidden />
        <input ref={editInputRef} value={editTitle} maxLength={80} aria-label="对话名称" onChange={(event) => setEditTitle(event.target.value)} onBlur={() => { if (!cancelRenameRef.current) saveRename(chat.id); }} onKeyDown={(event) => { if (event.key === "Escape") { cancelRenameRef.current = true; setEditingId(null); } event.stopPropagation(); }} />
      </form> : <button type="button" className={cx("sidebar-list-item", active && "active")} onClick={() => onSelectConversation(chat.id)} onContextMenu={(event) => openConversationMenu(event, chat.id)} title={chat.title} aria-current={active ? "page" : undefined}>
        <RiChat3Line aria-hidden /><span>{chat.title}</span>{recentLabel(chat.updatedAt) && <small>{recentLabel(chat.updatedAt)}</small>}
      </button>}
    </div>;
  }

  async function submitProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectName.trim() || busy) return;
    setBusy(true);
    try {
      if (await onNewProject(projectName.trim())) {
        setCreating(false);
        setProjectName("");
      }
    } finally {
      setBusy(false);
    }
  }

  function show(next: SidebarView) {
    onViewChange(next);
    if (collapsed) onChange({ sidebarCollapsed: false });
  }

  function collapsedAction(label: string, icon: typeof RiAddLine, onClick: () => void) {
    return <TooltipTrigger key={label}><IconButton icon={icon} size="small" aria-label={label} onClick={onClick} className="sidebar-rail-button" /><Tooltip placement="right">{label}</Tooltip></TooltipTrigger>;
  }

  return (
    <aside className={cx("workspace-sidebar", collapsed && "workspace-sidebar-collapsed")} aria-label="工作区导航">
      <div className="sidebar-brand">
        <span className="sidebar-logo" aria-label="magiccode"><img className="sidebar-logo-wordmark theme-logo-light" src="/magic-code-logo.png" alt="magiccode" /><img className="sidebar-logo-wordmark theme-logo-dark" src="/magic-code-logo-dark.png" alt="" aria-hidden="true" /><img className="sidebar-logo-mark theme-logo-light" src="/magic-code-mark.png" alt="" /><img className="sidebar-logo-mark theme-logo-dark" src="/magic-code-mark-dark.png" alt="" aria-hidden="true" /></span>
        <TooltipTrigger>
          <IconButton icon={collapsed ? RiSidebarUnfoldLine : RiSidebarFoldLine} size="small" aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"} onClick={() => onChange({ sidebarCollapsed: !collapsed })} className="sidebar-collapse-button" />
          <Tooltip placement="right">{collapsed ? "展开侧边栏" : "收起侧边栏"}</Tooltip>
        </TooltipTrigger>
      </div>

      {collapsed ? (
        <>
          <nav className="sidebar-rail-nav" aria-label="快捷导航">
            {collapsedAction("新对话", RiAddLine, () => onNewConversation())}
            {collapsedAction("插件", RiPuzzle2Line, () => show("plugins"))}
            {collapsedAction("技能", RiBookOpenLine, () => show("skills"))}
            {collapsedAction("项目记录", RiFolder3Line, () => show("home"))}
            {collapsedAction("对话记录", RiChat3Line, () => show("home"))}
          </nav>
          <div className="sidebar-rail-footer">
            {collapsedAction("设置", RiSettings3Line, () => show("settings"))}
          </div>
        </>
      ) : view === "settings" ? (
        <div className="settings-sidebar" aria-label="设置分类">
          <button type="button" className="settings-back-button" onClick={() => onViewChange("home")}><RiArrowLeftLine aria-hidden /><span>返回应用</span></button>
          <div className="settings-search"><InputBase size="small" leadingIcon={RiSearchLine} placeholder="搜索设置…" aria-label="搜索设置" /></div>
          <div className="settings-sidebar-scroll">
            {settingsSections.map((item, index) => <div key={item.id}>
              {item.group && <div className="settings-nav-group">{item.group}</div>}
              <button type="button" className={cx("settings-nav-item", settingsSection === item.id && "active")} onClick={() => onSettingsSectionChange(item.id)}><item.icon aria-hidden /><span>{item.label}</span></button>
              {index === settingsSections.length - 1 && <span className="settings-nav-spacer" />}
            </div>)}
          </div>
        </div>
      ) : (
        <>
          <div className="sidebar-search"><InputBase size="small" leadingIcon={RiSearchLine} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目或对话" aria-label="搜索项目或对话" /></div>
          <div className="sidebar-primary-actions">
            <Button size="small" variant="secondary" leadingIcon={RiAddLine} onClick={() => { show("home"); onNewConversation(); }} className="sidebar-new-chat">新对话</Button>
            <div className="sidebar-nav-pair">
              <button type="button" className={cx("sidebar-nav-button", view === "plugins" && "active")} onClick={() => show("plugins")}><RiPuzzle2Line aria-hidden />插件</button>
              <button type="button" className={cx("sidebar-nav-button", view === "skills" && "active")} onClick={() => show("skills")}><RiBookOpenLine aria-hidden />技能</button>
            </div>
          </div>

          <div className="sidebar-content">
              <div className="sidebar-group sidebar-project-tree">
                <div className="sidebar-group-head">
                  <span>项目</span>
                  <TooltipTrigger><IconButton icon={RiAddLine} size="small" aria-label="新建项目" onClick={() => setCreating(true)} className="sidebar-small-action" /><Tooltip>新建项目</Tooltip></TooltipTrigger>
                </div>
                {creating && <form className="sidebar-create-project" onSubmit={submitProject}>
                  <label htmlFor="project-folder-name">项目文件夹名称</label>
                  <InputBase id="project-folder-name" size="small" autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="例如：品牌网站" />
                  <div><Button size="small" type="submit" disabled={!projectName.trim() || busy}>{busy ? "选择中…" : "选择父文件夹"}</Button><Button size="small" variant="secondary" type="button" onClick={() => setCreating(false)}>取消</Button></div>
                </form>}
                <div className="sidebar-list">
                  {projects.map((item) => {
                    const itemChats = [...data.conversations].filter((chat) => chat.projectId === item.id && (!search || item.name.toLowerCase().includes(search) || chat.title.toLowerCase().includes(search))).sort((a, b) => b.updatedAt - a.updatedAt);
                    const expanded = search ? true : expandedProjects[item.id] ?? true;
                    const FolderIcon = expanded ? RiFolderOpenLine : RiFolder3Line;
                    return <div className="sidebar-project" key={item.id}>
                      <div className="sidebar-project-row">
                        <button type="button" className="sidebar-project-select" onClick={() => { onSelectProject(item.id); setExpandedProjects((current) => ({ ...current, [item.id]: true })); }} title={item.kind === "legacy" ? `${item.name}（旧版浏览器项目，未关联文件夹）` : item.name} aria-expanded={expanded}><FolderIcon aria-hidden /><span>{item.name}</span></button>
                        <TooltipTrigger><IconButton icon={RiAddLine} size="small" aria-label={`在${item.name}中新建对话`} onClick={() => { onNewProjectConversation(item.id); setExpandedProjects((current) => ({ ...current, [item.id]: true })); }} className="sidebar-project-add" /><Tooltip>项目内新对话</Tooltip></TooltipTrigger>
                        <button type="button" className="sidebar-project-expand" aria-label={`${expanded ? "折叠" : "展开"}${item.name}的对话`} aria-expanded={expanded} onClick={() => setExpandedProjects((current) => ({ ...current, [item.id]: !expanded }))}><RiArrowDownSLine className={expanded ? "" : "rotated"} aria-hidden /></button>
                      </div>
                      {expanded && <div className="sidebar-conversation-tree">
                        {itemChats.map(renderConversation)}
                        {!itemChats.length && <p className="sidebar-empty">暂无对话</p>}
                      </div>}
                    </div>;
                  })}
                  {!projects.length && <p className="sidebar-empty">{search ? "没有匹配的项目" : "还没有项目文件夹"}</p>}
                </div>
                {!search && <button type="button" className="sidebar-open-folder" onClick={onOpenProject}><RiFolderOpenLine aria-hidden />打开本地文件夹</button>}
              </div>
              <div className="sidebar-group">
                <div className="sidebar-group-head"><span>对话</span><TooltipTrigger><IconButton icon={RiAddLine} size="small" aria-label="新建独立对话" onClick={() => onNewConversation()} className="sidebar-small-action" /><Tooltip>新建独立对话</Tooltip></TooltipTrigger></div>
                <div className="sidebar-list">
                  {standalone.map(renderConversation)}
                  {!standalone.length && <p className="sidebar-empty">{search ? "没有匹配的对话" : "暂无独立对话"}</p>}
                </div>
              </div>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-footer-theme"><ThemeToggle appearance="segmented" /></div>
            <button type="button" className="sidebar-footer-button" onClick={() => show("settings")}><RiSettings3Line aria-hidden /><span>设置</span></button>
          </div>
        </>
      )}
      {contextMenu && <>
        <button type="button" className="sidebar-context-dismiss" aria-label="关闭对话菜单" onClick={() => setContextMenu(null)} />
        <div className="sidebar-context-menu" role="menu" aria-label="对话选项" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button type="button" role="menuitem" onClick={() => startRename(contextMenu.id)}><RiEditLine aria-hidden />重命名</button>
          <button type="button" role="menuitem" className="danger" onClick={() => {
            const title = data.conversations.find((item) => item.id === contextMenu.id)?.title ?? "此对话";
            setContextMenu(null);
            if (window.confirm(`确定删除「${title}」吗？此操作无法撤销。`)) onDeleteConversation(contextMenu.id);
          }}><RiDeleteBin6Line aria-hidden />删除对话</button>
        </div>
      </>}
    </aside>
  );
}
