"use client";

/* eslint-disable @next/next/no-img-element */

import { RiArrowRightUpLine, RiSparkling2Line } from "@remixicon/react";
import { cx } from "@/utils/cx";
import type { Annotation, ArtifactState, ElementMeta } from "./types";

interface ArtifactDocumentProps {
  state: ArtifactState;
  annotations?: Annotation[];
  compact?: boolean;
  onElementAction?: (element: ElementMeta) => void;
}

const element = (meta: ElementMeta) => ({
  "data-magic-element": "true",
  "data-element-id": meta.id,
  "data-element-name": meta.name,
  "data-element-tag": meta.tag,
  "data-element-font": meta.font ?? "",
  "data-element-color": meta.color ?? "",
  "data-element-size": meta.size ?? "",
});

function visible(state: ArtifactState, id: string) {
  return !state.hiddenElements.includes(id);
}

export function ArtifactDocument({ state, annotations = [], compact = false, onElementAction }: ArtifactDocumentProps) {
  const accentClass = {
    blue: "artifact-accent-blue",
    lime: "artifact-accent-lime",
    orange: "artifact-accent-orange",
  }[state.accent];

  return (
    <article className={cx("artifact-page", accentClass, compact && "artifact-page-compact")}>
      <header className="artifact-nav" {...element({ id: "nav", name: "顶部导航", tag: "header", size: "64px" })}>
        <button
          type="button"
          className="artifact-brand"
          {...element({ id: "brand", name: "Luma 品牌标识", tag: "button", font: "15px / 600" })}
          onClick={() => onElementAction?.({ id: "brand", name: "Luma 品牌标识", tag: "button" })}
        >
          <span className="artifact-mark"><RiSparkling2Line aria-hidden /></span>
          Luma
        </button>
        <nav aria-label="演示网页导航" className="artifact-nav-links" {...element({ id: "nav-links", name: "导航链接组", tag: "nav" })}>
          <a href="#space">空间</a>
          <a href="#method">方法</a>
          <a href="#stories">客户故事</a>
        </nav>
        {visible(state, "nav-cta") && (
          <button
            type="button"
            className="artifact-nav-cta"
            {...element({ id: "nav-cta", name: "导航预约按钮", tag: "button", size: "96 x 36px" })}
            onClick={() => onElementAction?.({ id: "nav-cta", name: "导航预约按钮", tag: "button" })}
          >
            预约参观
          </button>
        )}
      </header>

      <section className={cx("artifact-hero", !state.darkHero && "artifact-hero-light")} {...element({ id: "hero", name: "首屏主视觉区域", tag: "section", size: "100% x 520px" })}>
        <img
          src="/studio-board.png"
          alt="阳光下的创意工作室，木桌上放着电脑、笔记本与材料样本"
          className="artifact-hero-image"
          {...element({ id: "hero-image", name: "工作室主图", tag: "img", size: "1680 x 945px" })}
        />
        <div className="artifact-hero-scrim" aria-hidden />
        <div className="artifact-hero-copy">
          {visible(state, "hero-label") && (
            <p className="artifact-availability" {...element({ id: "hero-label", name: "开放状态标签", tag: "p", font: "12px / 600" })}>
              <span aria-hidden /> 上海静安 · 本周还有 3 个空位
            </p>
          )}
          {visible(state, "hero-title") && (
            <h1 {...element({ id: "hero-title", name: "主标题", tag: "h1", font: "48px / 600", color: "#FFFFFF" })}>
              {state.heading}
            </h1>
          )}
          {visible(state, "hero-copy") && (
            <p className="artifact-subheading" {...element({ id: "hero-copy", name: "主标题说明", tag: "p", font: "16px / 400", color: "rgba(255,255,255,.78)" })}>
              {state.subheading}
            </p>
          )}
          <div className="artifact-actions">
            {visible(state, "primary-cta") && (
              <button
                type="button"
                className={cx("artifact-primary-cta", state.ctaScale === "large" && "artifact-primary-cta-large")}
                {...element({ id: "primary-cta", name: "主行动按钮", tag: "button", font: "14px / 600", size: state.ctaScale === "large" ? "188 x 48px" : "168 x 42px" })}
                onClick={() => onElementAction?.({ id: "primary-cta", name: "主行动按钮", tag: "button" })}
              >
                {state.ctaLabel}<RiArrowRightUpLine aria-hidden />
              </button>
            )}
            {visible(state, "secondary-cta") && (
              <button
                type="button"
                className="artifact-secondary-cta"
                {...element({ id: "secondary-cta", name: "次要行动按钮", tag: "button", font: "14px / 500" })}
                onClick={() => onElementAction?.({ id: "secondary-cta", name: "次要行动按钮", tag: "button" })}
              >
                看看真实项目
              </button>
            )}
          </div>
        </div>
        <div className="artifact-proof" {...element({ id: "proof", name: "客户数据", tag: "div", size: "3 columns" })}>
          <div><strong>42</strong><span>个活跃项目</span></div>
          <div><strong>8.6h</strong><span>每周少切换窗口</span></div>
          <div><strong>4.9</strong><span>团队平均评分</span></div>
        </div>
      </section>

      <section className="artifact-story" id="method" {...element({ id: "story", name: "方法介绍区域", tag: "section" })}>
        <div>
          <p className="artifact-story-kicker">项目空间</p>
          <h2 {...element({ id: "story-title", name: "方法区域标题", tag: "h2", font: "30px / 600" })}>从第一张草图，到最后一次确认。</h2>
        </div>
        <p {...element({ id: "story-copy", name: "方法区域说明", tag: "p", font: "15px / 400" })}>
          用一个清晰空间收拢灵感、任务和反馈。每个人都知道最新版本在哪里，也知道下一步由谁推进。
        </p>
      </section>

      {annotations.map((annotation, index) => (
        <button
          key={annotation.id}
          type="button"
          className="artifact-annotation-pin"
          style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
          aria-label={`批注 ${index + 1}：${annotation.note}`}
          title={annotation.note}
        >
          {index + 1}
        </button>
      ))}
    </article>
  );
}
