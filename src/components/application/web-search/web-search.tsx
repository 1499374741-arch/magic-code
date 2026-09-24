"use client";

import { RiGithubLine, RiGlobalLine, RiLinkedinLine, RiMoreLine, RiNotionLine, RiRedditLine, RiSearchLine, RiTwitterXLine, type RemixiconComponentType } from "@remixicon/react";
import { cx } from "@/utils/cx";

export interface WebSearchStep {
  label: string;
  query?: string;
  brand?: string;
  meta?: string;
  icon?: RemixiconComponentType;
  heading?: boolean;
  sources?: Array<{ title: string; domain: string; brand?: string; href: string }>;
}

const BRAND_ICONS: Record<string, RemixiconComponentType> = {
  github: RiGithubLine,
  linkedin: RiLinkedinLine,
  notion: RiNotionLine,
  reddit: RiRedditLine,
  x: RiTwitterXLine,
};

function BrandMark({ brand }: { brand?: string }) {
  const Icon = brand ? BRAND_ICONS[brand.toLowerCase()] ?? RiGlobalLine : RiGlobalLine;
  return <Icon aria-hidden />;
}

export function WebSearch({ steps, working = false }: { steps: WebSearchStep[]; working?: boolean }) {
  return <section className="agent-web-search" aria-label="Agent 网络检索">
    <div className="agent-web-search-steps">{steps.map((step, index) => { const Icon = step.icon ?? RiGlobalLine; return <article className={cx("agent-web-search-step", step.heading && "is-heading")} key={`${step.label}-${index}`}><span className="agent-web-search-guide" aria-hidden /><span className="agent-web-search-icon"><Icon aria-hidden /></span><div><strong>{step.label}</strong>{step.query && <code>{step.query}</code>}{step.meta && <small>{step.meta}</small>}{step.sources && step.sources.length > 0 && <div className="agent-web-search-sources" aria-label="来源">{step.sources.slice(0, 6).map((source) => <a href={source.href} target="_blank" rel="noreferrer" key={source.href} title={`${source.title} · ${source.domain}`} aria-label={`${source.title}，${source.domain}`}><BrandMark brand={source.brand} /></a>)}{step.sources.length > 6 && <span className="agent-web-search-more"><RiMoreLine aria-hidden /></span>}</div>}</div></article>; })}{working && <div className="agent-web-search-working"><RiSearchLine aria-hidden /><span>正在检索</span></div>}</div>
  </section>;
}
