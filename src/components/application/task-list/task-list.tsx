"use client";

import { RiCheckLine, RiLoader4Line, type RemixiconComponentType } from "@remixicon/react";
import { cx } from "@/utils/cx";

export interface TaskStep {
  label: string;
  chips?: Array<{ label: string }>;
  status?: "pending" | "running" | "done";
}

export interface TaskItem {
  title: string;
  runningTitle?: string;
  icon?: RemixiconComponentType;
  steps: TaskStep[];
  status?: "pending" | "running" | "done";
}

export function TaskList({ tasks }: { tasks: TaskItem[] }) {
  return <section className="agent-task-list" aria-label="Agent 执行任务">
    {tasks.map((task, index) => {
      const Icon = task.icon;
      const running = task.status === "running";
      return <article className={cx("agent-task", running && "agent-task-running")} key={`${task.title}-${index}`}>
        <header className="agent-task-header"><span className="agent-task-icon">{running ? <RiLoader4Line className="agent-task-spinner" aria-hidden /> : Icon ? <Icon aria-hidden /> : <RiCheckLine aria-hidden />}</span><strong>{running ? task.runningTitle ?? task.title : task.title}</strong></header>
        <div className="agent-task-steps">{task.steps.map((step, stepIndex) => <div className={cx("agent-task-step", step.status === "running" && "is-running", step.status === "done" && "is-done")} key={`${step.label}-${stepIndex}`}><span className="agent-task-step-guide" aria-hidden /><span className="agent-task-step-mark" aria-hidden /> <span className="agent-task-step-label">{step.label}</span>{step.chips?.map((chip) => <span className="agent-task-chip" key={chip.label}>{chip.label}</span>)}</div>)}</div>
      </article>;
    })}
  </section>;
}
