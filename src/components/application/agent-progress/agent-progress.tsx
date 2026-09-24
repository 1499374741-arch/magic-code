"use client";

import { useState } from "react";
import { RiArrowDownSLine, RiCheckLine, RiLoader4Line } from "@remixicon/react";
import { cx } from "@/utils/cx";

export interface AgentProgressStep {
  label: string;
  status?: "pending" | "running" | "done";
}

export function AgentProgress({ steps, running = false, title }: { steps: Array<string | AgentProgressStep>; running?: boolean; title?: string }) {
  const [open, setOpen] = useState(true);
  const normalized = steps.map((step) => typeof step === "string" ? { label: step, status: "done" as const } : step);
  const completed = normalized.filter((step) => step.status === "done").length;
  return <section className={cx("agent-progress", !open && "is-collapsed")} aria-label="Agent 进度">
    <button type="button" className="agent-progress-header" onClick={() => setOpen((value) => !value)} aria-expanded={open}><span className="agent-progress-status">{running ? <RiLoader4Line className="agent-task-spinner" aria-hidden /> : <RiCheckLine aria-hidden />}</span><strong>{title ?? (running ? "Agent 正在执行" : "Agent 执行完成")}</strong><span className="agent-progress-count">{completed}/{normalized.length}</span><RiArrowDownSLine className={cx(open && "is-open")} aria-hidden /></button>
    {open && <div className="agent-progress-steps">{normalized.map((step, index) => <div className={cx("agent-progress-step", `agent-progress-${step.status ?? "pending"}`)} key={`${step.label}-${index}`}><span className="agent-progress-step-mark" aria-hidden /> <span>{step.label}</span></div>)}</div>}
  </section>;
}
