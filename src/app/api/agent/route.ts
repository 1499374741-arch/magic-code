import { NextResponse } from "next/server";

type Provider = {
  type: "openai" | "anthropic" | "google" | "openai-compatible" | "local";
  baseUrl: string;
  apiKey: string;
  model: string;
};

type AgentMessage = { role: "user" | "assistant" | "tool"; content: string; tool_call_id?: string; name?: string };
type ArtifactSnapshot = {
  accent: "blue" | "lime" | "orange";
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaScale: "normal" | "large";
  darkHero: boolean;
  hiddenElements: string[];
};
type AgentAction =
  | { type: "artifact.update"; changes: Partial<Pick<ArtifactSnapshot, "accent" | "heading" | "subheading" | "ctaLabel" | "ctaScale" | "darkHero">>; targetId?: string; reason?: string }
  | { type: "artifact.hide"; targetId: string; reason?: string }
  | { type: "artifact.show"; targetId: string; reason?: string }
  | { type: "annotation.create"; x: number; y: number; note: string; author?: string }
  | { type: "context.inspect"; targetId?: string };
type AgentToolCall = { id: string; name: string; arguments: Record<string, unknown> };

type AgentRequest = {
  provider: Provider;
  runtime?: boolean;
  systemInstructions?: string;
  messages: AgentMessage[];
  attachments?: Array<{ id?: string; name: string; relativePath?: string; kind?: string; mimeType?: string; size?: number; text?: string }>;
  artifact?: ArtifactSnapshot;
  target?: { id: string; name: string; tag: string; size?: string } | null;
  maxToolCalls?: number;
};

type ModelPayload = {
  error?: { message?: string } | string;
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }>; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }>;
  content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }> } }>;
};

const toolDefinitions = [
  { name: "update_artifact", description: "修改当前作品中的标题、说明、按钮、颜色、明暗或尺寸。只提出用户明确要求的字段。", parameters: { type: "object", properties: { changes: { type: "object", properties: { accent: { type: "string", enum: ["blue", "lime", "orange"] }, heading: { type: "string" }, subheading: { type: "string" }, ctaLabel: { type: "string" }, ctaScale: { type: "string", enum: ["normal", "large"] }, darkHero: { type: "boolean" } }, additionalProperties: false }, targetId: { type: "string" }, reason: { type: "string" } }, required: ["changes"], additionalProperties: false } },
  { name: "hide_artifact_element", description: "隐藏当前作品中的一个已定位元素。", parameters: { type: "object", properties: { targetId: { type: "string" }, reason: { type: "string" } }, required: ["targetId"], additionalProperties: false } },
  { name: "show_artifact_element", description: "恢复当前作品中已隐藏的一个元素。", parameters: { type: "object", properties: { targetId: { type: "string" }, reason: { type: "string" } }, required: ["targetId"], additionalProperties: false } },
  { name: "create_annotation", description: "在作品上创建批注，坐标使用 0 到 100 的百分比。", parameters: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, note: { type: "string" }, author: { type: "string" } }, required: ["x", "y", "note"], additionalProperties: false } },
  { name: "inspect_context", description: "读取当前作品和选中目标的结构，用于理解上下文。", parameters: { type: "object", properties: { targetId: { type: "string" } }, additionalProperties: false } },
];

function errorResponse(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function trimUrl(value: string) { return value.replace(/\/$/, ""); }
function textFromContent(content: string | Array<{ text?: string }> | undefined) {
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.map((item) => item.text ?? "").join("\n") : "";
}

function googleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(googleSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key === "type" && typeof item === "string" ? item.toUpperCase() : key, googleSchema(item)]));
}

function attachmentContext(attachments: AgentRequest["attachments"] = []) {
  const valid = attachments.filter((attachment) => attachment.name.trim());
  if (!valid.length) return "";
  return "\n\n[附件上下文]\n" + valid.map((attachment) => {
    const path = attachment.relativePath && attachment.relativePath !== attachment.name ? "（路径：" + attachment.relativePath + "）" : "";
    const content = attachment.text ? "\n内容摘录：\n" + attachment.text.slice(0, 12000) : "";
    return "- " + attachment.name + path + "，" + (attachment.kind ?? "file") + (attachment.mimeType ? "，" + attachment.mimeType : "") + content;
  }).join("\n");
}

function runtimeInstructions(request: AgentRequest) {
  const target = request.target ? "\n当前目标：" + request.target.name + "（" + request.target.id + "，" + request.target.tag + "）。" : "";
  const artifact = request.artifact
    ? "\n当前作品：标题“" + request.artifact.heading + "”，说明“" + request.artifact.subheading + "”，按钮“" + request.artifact.ctaLabel + "”，强调色 " + request.artifact.accent + "，" + (request.artifact.darkHero ? "深色" : "浅色") + "，已隐藏 " + (request.artifact.hiddenElements.join("、") || "无") + "。"
    : "";
  return (request.systemInstructions ?? "") + "\n你是 Magic Code 的原生 Agent。先理解用户目标，再按需调用工具。只有用户明确要求修改、隐藏、恢复或添加批注时才调用写入工具；普通问题直接回答。修改必须使用结构化工具，不要假装已经改动。工具执行后，用简洁中文说明做了什么。" + target + artifact;
}

function normalizeAction(call: AgentToolCall): AgentAction | null {
  const args = call.arguments;
  if (call.name === "update_artifact" && args.changes && typeof args.changes === "object") return { type: "artifact.update", changes: args.changes as Partial<Pick<ArtifactSnapshot, "accent" | "heading" | "subheading" | "ctaLabel" | "ctaScale" | "darkHero">>, targetId: typeof args.targetId === "string" ? args.targetId : undefined, reason: typeof args.reason === "string" ? args.reason : undefined };
  if (call.name === "hide_artifact_element" && typeof args.targetId === "string") return { type: "artifact.hide", targetId: args.targetId, reason: typeof args.reason === "string" ? args.reason : undefined };
  if (call.name === "show_artifact_element" && typeof args.targetId === "string") return { type: "artifact.show", targetId: args.targetId, reason: typeof args.reason === "string" ? args.reason : undefined };
  if (call.name === "create_annotation" && typeof args.note === "string") return { type: "annotation.create", x: Math.max(0, Math.min(100, Number(args.x) || 0)), y: Math.max(0, Math.min(100, Number(args.y) || 0)), note: args.note.slice(0, 1000), author: typeof args.author === "string" ? args.author : undefined };
  if (call.name === "inspect_context") return { type: "context.inspect", targetId: typeof args.targetId === "string" ? args.targetId : undefined };
  return null;
}

function parseJsonActions(content: string): AgentAction[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const payload = JSON.parse(match[0]) as { actions?: AgentAction[] };
    return Array.isArray(payload.actions) ? payload.actions.slice(0, 8) : [];
  } catch { return []; }
}

async function readModel(response: Response) {
  const payload = await response.json().catch(() => ({})) as ModelPayload;
  if (!response.ok) {
    const detail = typeof payload.error === "string" ? payload.error : payload.error?.message;
    throw new Error(detail || "模型请求失败（" + response.status + "）");
  }
  return payload;
}

async function callProvider(provider: Provider, system: string, messages: AgentMessage[], withTools: boolean) {
  const base = trimUrl(provider.baseUrl);
  if (provider.type === "anthropic") {
    const endpoint = base.endsWith("/v1") ? base + "/messages" : base + "/v1/messages";
    return readModel(await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(60000), headers: { "content-type": "application/json", "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: provider.model, max_tokens: 4096, system, messages: messages.filter((message) => message.role !== "tool").map((message) => ({ role: message.role, content: message.content })), tools: withTools ? toolDefinitions.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) : undefined }) }));
  }
  if (provider.type === "google") {
    const endpoint = (base.endsWith("/v1beta") ? base : base + "/v1beta") + "/models/" + provider.model + ":generateContent?key=" + encodeURIComponent(provider.apiKey);
    const contents = messages.filter((message) => message.role !== "tool").map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] }));
    return readModel(await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(60000), headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools: withTools ? [{ functionDeclarations: toolDefinitions.map((tool) => ({ name: tool.name, description: tool.description, parameters: googleSchema(tool.parameters) })) }] : undefined }) }));
  }
  const endpoint = base.endsWith("/chat/completions") ? base : base + "/chat/completions";
  return readModel(await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(60000), headers: { "content-type": "application/json", ...(provider.apiKey ? { authorization: "Bearer " + provider.apiKey } : {}) }, body: JSON.stringify({ model: provider.model, messages: [{ role: "system", content: system }, ...messages], temperature: 0.2, tools: withTools ? toolDefinitions.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) : undefined, tool_choice: withTools ? "auto" : undefined }) }));
}

function extractResponse(provider: Provider, payload: ModelPayload) {
  const calls: AgentToolCall[] = [];
  let content = "";
  if (provider.type === "anthropic") {
    for (const item of payload.content ?? []) {
      if (item.type === "tool_use") calls.push({ id: item.id ?? crypto.randomUUID(), name: item.name ?? "", arguments: item.input ?? {} });
      else content += item.text ?? "";
    }
  } else if (provider.type === "google") {
    for (const part of payload.candidates?.[0]?.content?.parts ?? []) { if (part.functionCall) calls.push({ id: crypto.randomUUID(), name: part.functionCall.name, arguments: part.functionCall.args ?? {} }); content += part.text ?? ""; }
  } else {
    const message = payload.choices?.[0]?.message;
    content = textFromContent(message?.content);
    for (const call of message?.tool_calls ?? []) { try { calls.push({ id: call.id ?? crypto.randomUUID(), name: call.function?.name ?? "", arguments: JSON.parse(call.function?.arguments ?? "{}") }); } catch { /* invalid calls are ignored */ } }
  }
  return { content: content.trim(), calls };
}

export async function POST(request: Request) {
  let body: AgentRequest;
  try { body = await request.json() as AgentRequest; } catch { return errorResponse("请求内容不是有效 JSON"); }
  const provider = body.provider;
  if (!provider?.model || (provider.type !== "local" && !provider.apiKey)) return errorResponse("请先在设置中填写 API Key 和模型");
  const messages = body.messages.filter((message) => message.content.trim()).map((message) => ({ ...message, content: message.content.trim() }));
  if (!messages.length) return errorResponse("至少需要一条消息");
  const last = messages.at(-1);
  if (last?.role === "user") last.content += attachmentContext(body.attachments);
  try {
    let first: ModelPayload;
    try {
      first = await callProvider(provider, runtimeInstructions(body), messages, body.runtime !== false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      if (body.runtime !== false && /tool|function|unsupported|unknown parameter/i.test(detail)) {
        first = await callProvider(provider, runtimeInstructions(body) + "\n如果当前模型不支持工具调用，请只返回普通文本。", messages, false);
      } else {
        throw error;
      }
    }
    const extracted = extractResponse(provider, first);
    const actions = extracted.calls.map(normalizeAction).filter((action): action is AgentAction => Boolean(action)).slice(0, Math.max(1, Math.min(16, body.maxToolCalls ?? 12)));
    const fallbackActions = actions.length ? actions : (body.runtime !== false ? parseJsonActions(extracted.content) : []);
    return NextResponse.json({ content: extracted.content || (fallbackActions.length ? "已生成执行计划。" : "模型没有返回文本。"), actions: fallbackActions, toolCalls: extracted.calls.map(({ id, name }) => ({ id, name })), runtime: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "模型请求失败", 502);
  }
}
