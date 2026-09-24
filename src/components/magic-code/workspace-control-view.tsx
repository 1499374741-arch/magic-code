"use client";

import {
  RiArrowLeftLine,
  RiAddLine,
  RiBookOpenLine,
  RiCheckLine,
  RiPlugLine,
  RiShieldCheckLine,
  RiSparklingLine,
  RiToolsLine,
} from "@remixicon/react";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Switch } from "@/components/base/switch/switch";
import type { AgentSettings, WorkspaceData } from "./workspace-store";
import type { SettingsSection, SidebarView } from "./workspace-sidebar";
import { WorkspaceAgentSettings } from "./workspace-agent-settings";

interface Props {
  view: Exclude<SidebarView, "home">;
  data: WorkspaceData;
  agentSettings: AgentSettings;
  settingsSection: SettingsSection;
  onBack: () => void;
  onCompose: (prompt: string) => void;
  onChange: (change: Partial<WorkspaceData>) => void;
  onAgentSettingsChange: (change: Partial<AgentSettings>) => void;
}

const titles: Record<Props["view"], string> = {
  plugins: "插件",
  skills: "技能",
  settings: "设置",
};

const settingsTitles: Record<SettingsSection, string> = {
  general: "常规", models: "模型与 API", permissions: "权限与安全", appearance: "外观", instructions: "Agent 指令", tools: "工具与 MCP", workspace: "项目工作区", shortcuts: "键盘快捷键", preview: "网页预览", exports: "文件导出", mcp: "MCP 服务器", browser: "浏览器", hooks: "钩子", connections: "连接", git: "Git", environment: "环境",
};

const pluginItems = [
  { id: "plugin-browser", title: "网页预览", detail: "把生成的网页和原型放进右侧可交互画布。", icon: RiPlugLine },
  { id: "plugin-export", title: "文件导出", detail: "导出 Agent 生成的内容并保存到项目文件夹。", icon: RiToolsLine },
];

const skillItems = [
  { id: "skill-target", title: "精确定位", detail: "将点选、框选、元素属性和坐标写入 Agent 上下文。", key: "targeting" },
  { id: "skill-writing", title: "文案润色", detail: "围绕当前页面语气修改标题、说明和行动文案。", key: "writing" },
  { id: "skill-web", title: "网页生成", detail: "生成可预览的网页作品，并在每次修改前保存版本。", key: "web-generation" },
  { id: "skill-files", title: "文件分析", detail: "读取项目工作区文件，提取与当前任务相关的上下文。", key: "file-analysis" },
];

export function WorkspaceControlView({ view, data, agentSettings, settingsSection, onBack, onCompose, onChange, onAgentSettingsChange }: Props) {
  function updateExtension(id: string, enabled: boolean) {
    onChange({ extensions: { ...data.extensions, [id]: enabled } });
  }

  function updateSkill(key: string, enabled: boolean, legacyId: string) {
    onAgentSettingsChange({ skills: { ...agentSettings.skills, [key]: enabled } });
    onChange({ extensions: { ...data.extensions, [legacyId]: enabled } });
  }

  return (
    <section className={view === "settings" ? "control-pane settings-control-pane" : "control-pane"} aria-labelledby="control-view-title">
      <header className="control-view-header">
        {view !== "settings" && <IconButton icon={RiArrowLeftLine} size="small" aria-label="返回对话" onClick={onBack} />}
        <h1 id="control-view-title">{view === "settings" ? settingsTitles[settingsSection] : titles[view]}</h1>
        <span className="control-view-context">{view === "settings" ? "设置" : "Magic Code Agent"}</span>
        {(view === "plugins" || view === "skills" || (view === "settings" && settingsSection === "mcp")) && <IconButton icon={RiAddLine} size="small" className="control-view-add-button" aria-label={view === "plugins" ? "在对话中添加插件" : view === "skills" ? "在对话中添加技能" : "在对话中添加 MCP 服务器"} onClick={() => onCompose(view === "plugins" ? "帮我添加一个插件：" : view === "skills" ? "帮我添加一个技能：" : "帮我添加一个 MCP 服务器，地址或命令是：")} />}
      </header>

      <div className="control-view-scroll">
        {view === "plugins" && (
          <div className="control-section-stack">
            <div className="control-intro"><RiPlugLine aria-hidden /><div><h2>工作区插件</h2><p>插件只影响当前本地工作区，启用后会出现在 Agent 的工具上下文里。</p></div></div>
            <div className="control-list">
              {pluginItems.map((item) => {
                const enabled = data.extensions[item.id];
                return <div className="control-row" key={item.id}><div className="control-row-icon"><item.icon aria-hidden /></div><div className="control-row-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{enabled ? "已启用" : "已停用"}</small></div><Switch size="sm" aria-label={`${enabled ? "停用" : "启用"}${item.title}`} isSelected={Boolean(enabled)} onChange={(next) => updateExtension(item.id, next)} /></div>;
              })}
            </div>
            <div className="control-callout"><RiShieldCheckLine aria-hidden /><span>联网、MCP 和外部工具不会默认获得权限。Agent 会在需要时先请求确认。</span></div>
          </div>
        )}

        {view === "skills" && (
          <div className="control-section-stack">
            <div className="control-intro"><RiBookOpenLine aria-hidden /><div><h2>Agent 技能</h2><p>技能是 Magic Code 面向作品修改的可组合能力，不会改变你的主对话结构。</p></div></div>
            <div className="control-list">
              {skillItems.map((item) => { const enabled = agentSettings.skills[item.key]; return <div className="control-row" key={item.id}><div className="control-row-icon"><RiSparklingLine aria-hidden /></div><div className="control-row-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{enabled ? "可用于当前 Agent" : "未加入当前 Agent"}</small></div><Switch size="sm" aria-label={`${enabled ? "停用" : "启用"}${item.title}`} isSelected={Boolean(enabled)} onChange={(next) => updateSkill(item.key, next, item.id)} /></div>; })}
            </div>
            <div className="control-callout"><RiCheckLine aria-hidden /><span>修改前自动写入版本记录，点选、批注和框选信息会随技能一起传给 Agent。</span></div>
          </div>
        )}

        {view === "settings" && <WorkspaceAgentSettings section={settingsSection} settings={agentSettings} onSettingsChange={onAgentSettingsChange} />}

      </div>
    </section>
  );
}
