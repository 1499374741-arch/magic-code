"use client";

import { RiArrowLeftRightLine, RiBrushLine, RiCloseLine, RiCursorLine, RiDownload2Line, RiEyeLine, RiFocus3Line, RiHistoryLine, RiStickyNoteAddLine } from "@remixicon/react";
import type { MouseEvent, PointerEvent, RefObject } from "react";
import { IconButton } from "@/components/base/buttons/icon-button";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";
import { ArtifactDocument } from "./artifact-document";
import { PreviewInspector, type InspectorTab } from "./preview-inspector";
import type { Annotation, ArtifactState, CanvasMode, ElementMeta, RegionSelection, VersionEntry } from "./types";

const MODES: Array<{ id: CanvasMode; label: string; icon: typeof RiEyeLine }> = [
  { id: "preview", label: "预览", icon: RiEyeLine },
  { id: "target", label: "点选", icon: RiCursorLine },
  { id: "region", label: "框选", icon: RiFocus3Line },
  { id: "annotate", label: "批注", icon: RiBrushLine },
];

interface RectOverlay { left: number; top: number; width: number; height: number }

interface Props {
  projectName: string;
  hasArtifact: boolean;
  mobileHidden: boolean;
  artifact: ArtifactState;
  annotations: Annotation[];
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  compare: boolean;
  onCompareChange: () => void;
  compareBefore: VersionEntry | undefined;
  compareAfter: VersionEntry | undefined;
  hovered: ElementMeta | null;
  selected: ElementMeta | null;
  hoverRect: RectOverlay | null;
  selectedRect: RectOverlay | null;
  region: RegionSelection | null;
  previewRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  onElementAction: (meta: ElementMeta) => void;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  onOpenInspector: (tab: InspectorTab) => void;
  onCloseInspector: () => void;
  onExport: () => void;
  onCollapse: () => void;
  pendingCount: number;
  versions: VersionEntry[];
  activeVersion: string;
  activeVersionIndex: number;
  onSyncAnnotations: () => void;
  onUpdateAnnotation: (id: string, note: string) => void;
  onDeleteAnnotation: (id: string) => void;
  onClearSelection: () => void;
  onRestoreVersion: (version: VersionEntry) => void;
}

export function WorkspacePreview(props: Props) {
  const { projectName, hasArtifact, mobileHidden, artifact, annotations, mode, onModeChange, compare, onCompareChange,
    compareBefore, compareAfter, hovered, selected, hoverRect, selectedRect, region, previewRef,
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onClick, onElementAction,
    inspectorOpen, inspectorTab, onOpenInspector, onCloseInspector, onExport, onCollapse,
    pendingCount, versions, activeVersion, activeVersionIndex, onSyncAnnotations, onUpdateAnnotation, onDeleteAnnotation,
    onClearSelection, onRestoreVersion } = props;
  const modeLabel = MODES.find((item) => item.id === mode)?.label ?? "预览";
  const visibleMeta = hovered ?? selected;
  const regionPoints = region?.points ?? [];
  const regionPath = regionPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x - (region?.x ?? 0)} ${point.y - (region?.y ?? 0)}`).join(" ");

  return <section className={cx("canvas-pane", mobileHidden && "mobile-hidden")} aria-label="产物预览">
    <header className="canvas-header">
      <div className="preview-view-tabs" role="group" aria-label={`${projectName}工作面板`}>
        <button type="button" className={cx("preview-view-tab", !(inspectorOpen && inspectorTab === "versions") && "active")} aria-pressed={!(inspectorOpen && inspectorTab === "versions")} onClick={onCloseInspector}><RiEyeLine aria-hidden />预览</button>
        <button type="button" className={cx("preview-view-tab", inspectorOpen && inspectorTab === "versions" && "active")} aria-pressed={inspectorOpen && inspectorTab === "versions"} disabled={!hasArtifact} onClick={() => onOpenInspector("versions")}><RiHistoryLine aria-hidden />版本</button>
      </div>
      <div className="canvas-actions">
        <TooltipTrigger><IconButton icon={RiFocus3Line} size="small" aria-label="元素属性" disabled={!hasArtifact} onClick={() => onOpenInspector("props")} className={inspectorOpen && inspectorTab === "props" ? "icon-active" : ""} /><Tooltip>元素属性</Tooltip></TooltipTrigger>
        <TooltipTrigger><IconButton icon={RiStickyNoteAddLine} size="small" aria-label="页面批注" disabled={!hasArtifact} onClick={() => onOpenInspector("notes")} className={inspectorOpen && inspectorTab === "notes" ? "icon-active" : ""} /><Tooltip>页面批注</Tooltip></TooltipTrigger>
        <TooltipTrigger><IconButton icon={RiArrowLeftRightLine} size="small" aria-label="切换修改对比" disabled={!hasArtifact || versions.length < 2} onClick={onCompareChange} className={compare ? "icon-active" : ""} /><Tooltip>修改前后对比</Tooltip></TooltipTrigger>
        <TooltipTrigger><IconButton icon={RiDownload2Line} size="small" aria-label="导出 HTML" disabled={!hasArtifact} onClick={onExport} /><Tooltip>导出 HTML</Tooltip></TooltipTrigger>
        <TooltipTrigger><IconButton icon={RiCloseLine} size="small" aria-label="收起预览" onClick={onCollapse} /><Tooltip>收起预览</Tooltip></TooltipTrigger>
      </div>
    </header>
    <div className="canvas-body">
      {!hasArtifact ? <div className="preview-empty"><RiEyeLine aria-hidden /><strong>还没有作品</strong></div> : <>
        <div className="preview-stage">
          <div className="mode-toolbar" aria-label="画布模式">
            <SegmentedControl selectedKeys={new Set([mode])} onSelectionChange={(keys) => onModeChange(Array.from(keys)[0] as CanvasMode)}>
              {MODES.map((item) => { const Icon = item.icon; return <SegmentedControlItem key={item.id} id={item.id}><Icon aria-hidden />{item.label}</SegmentedControlItem>; })}
            </SegmentedControl>
            <span className="mode-hint">{mode === "target" ? "点击页面元素以锁定" : mode === "region" ? "按住鼠标圈选区域" : mode === "annotate" ? "点击任意位置添加批注" : "页面可正常交互"}</span>
          </div>
          <div className={cx("preview-viewport", `preview-mode-${mode}`)} ref={previewRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onPointerLeave={onPointerLeave} onClick={onClick}>
            {compare && compareBefore && compareAfter ? <div className="compare-grid">
              <div className="compare-side"><span>{compareBefore.label}</span><ArtifactDocument state={compareBefore.state} compact /></div>
              <div className="compare-side"><span>{compareAfter.label}</span><ArtifactDocument state={compareAfter.state} compact /></div>
            </div> : <ArtifactDocument state={artifact} annotations={annotations} onElementAction={mode === "preview" ? onElementAction : undefined} />}
            {mode === "target" && hoverRect && <div className="element-outline element-outline-hover" style={hoverRect}><span>{hovered?.name}</span></div>}
            {mode === "target" && selectedRect && <div className="element-outline element-outline-selected" style={selectedRect}><span><RiFocus3Line aria-hidden /> 已锁定</span></div>}
            {mode === "region" && region && <div className={cx("region-box", regionPoints.length > 1 && "region-box-lasso")} style={{ left: region.x, top: region.y, width: region.width, height: region.height }}>
              {regionPoints.length > 1 && <svg className="region-lasso" viewBox={`0 0 ${Math.max(region.width, 1)} ${Math.max(region.height, 1)}`} preserveAspectRatio="none" aria-hidden><path d={`${regionPath} Z`} /></svg>}
              <span>{Math.round(region.width)} × {Math.round(region.height)}</span>
            </div>}
          </div>
          <footer className="preview-statusbar"><span><i className={cx("status-dot", `status-${mode}`)} /> {modeLabel}模式</span><span className="hover-property">{visibleMeta ? `${visibleMeta.tag} · ${visibleMeta.name}${visibleMeta.size ? ` · ${visibleMeta.size}` : ""}` : "移动到元素上查看属性"}</span><span>100%</span></footer>
        </div>
        {inspectorOpen && <PreviewInspector tab={inspectorTab} onTabChange={onOpenInspector} onClose={onCloseInspector} selected={selected} annotations={annotations} pendingCount={pendingCount} versions={versions} activeVersion={activeVersion} activeVersionIndex={activeVersionIndex} onSyncAnnotations={onSyncAnnotations} onUpdateAnnotation={onUpdateAnnotation} onDeleteAnnotation={onDeleteAnnotation} onSetMode={onModeChange} onClearSelection={onClearSelection} onRestoreVersion={onRestoreVersion} />}
      </>}
    </div>
  </section>;
}
