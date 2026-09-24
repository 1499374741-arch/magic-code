"use client";

import { RiArrowGoBackLine, RiCheckDoubleLine, RiCloseLine, RiCursorLine, RiDeleteBin6Line, RiFocus3Line, RiHistoryLine, RiMagicLine, RiStickyNoteAddLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Chip } from "@/components/base/badges/chip";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { TextareaBase } from "@/components/base/textarea/textarea";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";
import type { Annotation, CanvasMode, ElementMeta, VersionEntry } from "./types";

export type InspectorTab = "props" | "notes" | "versions";

interface Props {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  selected: ElementMeta | null;
  annotations: Annotation[];
  pendingCount: number;
  versions: VersionEntry[];
  activeVersion: string;
  activeVersionIndex: number;
  onSyncAnnotations: () => void;
  onUpdateAnnotation: (id: string, note: string) => void;
  onDeleteAnnotation: (id: string) => void;
  onSetMode: (mode: CanvasMode) => void;
  onClearSelection: () => void;
  onRestoreVersion: (version: VersionEntry) => void;
}

export function PreviewInspector({ tab, onTabChange, onClose, selected, annotations, pendingCount, versions, activeVersion, activeVersionIndex, onSyncAnnotations, onUpdateAnnotation, onDeleteAnnotation, onSetMode, onClearSelection, onRestoreVersion }: Props) {
  return <aside className="inspector" aria-label="预览检查器">
    <div className="inspector-topline"><strong>检查器</strong><TooltipTrigger><IconButton icon={RiCloseLine} size="small" aria-label="关闭检查器" onClick={onClose} /><Tooltip>关闭检查器</Tooltip></TooltipTrigger></div>
    <Tabs selectedKey={tab} onSelectionChange={(key) => onTabChange(key as InspectorTab)}>
      <TabList aria-label="检查器分类">
        <Tab id="props" icon={RiFocus3Line}>属性</Tab>
        <Tab id="notes" icon={RiStickyNoteAddLine} count={annotations.length}>批注</Tab>
        <Tab id="versions" icon={RiHistoryLine} count={versions.length}>版本</Tab>
      </TabList>
      <TabPanel id="props" className="inspector-panel">
        {selected ? <>
          <div className="selection-summary"><span className="selection-icon"><RiCursorLine aria-hidden /></span><div><small>当前目标</small><strong>{selected.name}</strong><code>{selected.tag} · {selected.id}</code></div></div>
          <dl className="property-list">
            <div><dt>字号</dt><dd>{selected.font ?? "自动"}</dd></div>
            <div><dt>尺寸</dt><dd>{selected.size ?? "自适应"}</dd></div>
            <div><dt>颜色</dt><dd>{selected.color ?? "语义令牌"}</dd></div>
            <div><dt>定位</dt><dd>DOM + 坐标</dd></div>
          </dl>
          <div className="context-note"><RiMagicLine aria-hidden /><p>发送时会附带元素文本、可访问名称、父级区域和当前位置。</p></div>
          <Button variant="secondary" size="small" leadingIcon={RiCloseLine} onClick={onClearSelection}>清除选择</Button>
        </> : <div className="inspector-empty"><RiCursorLine aria-hidden /><strong>还没有选择目标</strong><p>切到点选或框选模式，在页面上直接指出要修改的地方。</p><Button size="small" onClick={() => onSetMode("target")}>开始点选</Button></div>}
      </TabPanel>
      <TabPanel id="notes" className="inspector-panel">
        <div className="inspector-section-head"><div><strong>页面批注</strong><span>{pendingCount} 条待同步</span></div><Button size="xs" leadingIcon={RiCheckDoubleLine} onClick={onSyncAnnotations}>同步给 AI</Button></div>
        <div className="annotation-list">
          {annotations.map((annotation, index) => <article key={annotation.id} className="annotation-item">
            <div className="annotation-item-head"><span className="annotation-number">{index + 1}</span><strong>{annotation.author}</strong><Chip color={annotation.synced ? "soft" : "yellow"} variant="caption">{annotation.synced ? "已同步" : "待同步"}</Chip><button type="button" aria-label="删除批注" onClick={() => onDeleteAnnotation(annotation.id)}><RiDeleteBin6Line aria-hidden /></button></div>
            <TextareaBase rows={2} value={annotation.note} onChange={(event) => onUpdateAnnotation(annotation.id, event.target.value)} aria-label={`批注 ${index + 1}`} />
          </article>)}
        </div>
        <Button variant="secondary" size="small" leadingIcon={RiStickyNoteAddLine} onClick={() => onSetMode("annotate")}>在画布添加批注</Button>
      </TabPanel>
      <TabPanel id="versions" className="inspector-panel">
        <div className="inspector-section-head"><div><strong>历史版本</strong><span>自动保存每次修改</span></div></div>
        <div className="version-list">
          {[...versions].reverse().map((version) => <button key={version.id} type="button" className={cx("version-item", version.id === activeVersion && "version-item-active")} onClick={() => onRestoreVersion(version)}>
            <span className="version-node" /><span><strong>{version.label}</strong><small>{version.detail}</small></span><time>{version.createdAt}</time>{version.id === activeVersion && <RiCheckDoubleLine aria-hidden />}
          </button>)}
        </div>
        <Button variant="secondary" size="small" leadingIcon={RiArrowGoBackLine} disabled={activeVersionIndex <= 0} onClick={() => { const previous = versions[Math.max(0, activeVersionIndex - 1)]; if (previous) onRestoreVersion(previous); }}>回退上一个版本</Button>
      </TabPanel>
    </Tabs>
  </aside>;
}
