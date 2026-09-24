# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated from the explicit BoardUI requirement: Next.js App Router, React, TypeScript, Tailwind CSS v4, and BoardUI source components. Desktop-first with a responsive mobile workspace.

## Users

People who use AI to create and revise websites, app prototypes, code, and long-form content. The primary user needs to point at a visible result and request a change without translating location into a long text description.

## Product Purpose

Magic Code turns visual selections, text selections, and annotations into structured AI context. Success means a user can inspect an artifact, point to the exact target, request a change, and keep side questions separate from the main conversation.

## Positioning

The product's distinctive mechanism is direct visual grounding: a click or region selection carries element identity, nearby content, and position into the request instead of sending only an ambiguous coordinate or prose description.

## Operating Context

- A main AI conversation and an artifact workspace are used side by side.
- Generated HTML or interface prototypes are previewed in an isolated surface.
- Users switch between normal preview, element targeting, region selection, and annotation.
- Selected chat text opens an independent question thread that does not alter the main conversation.
- The MVP is demonstrated locally and persists workspace state in the browser.

## Capabilities and Constraints

- Required MVP capabilities: main chat, artifact preview, click-to-target, region selection, annotation sync, independent selected-text questions, common command shortcuts, version history, rollback, before/after comparison, element properties, and export.
- AI behavior must remain demonstrable without credentials. A real model provider can be connected later without changing the interaction model.
- Previewed HTML must be isolated from the application shell.
- Multiplayer collaboration and production authentication are outside the local MVP; share review is represented as an invite/copy-link flow.
- Assumption: a single local user and one active project are sufficient for the first runnable MVP.

## Brand Commitments

- Product name: Magic Code.
- Core phrase: 指哪打哪的 AI 交互助手.
- Voice: direct, practical, calm, and understandable to non-specialists.
- BoardUI is the required component and token system.

## Evidence on Hand

The source brief and the documents in `outputs/` define the product scope. No customer claims, production metrics, logo asset, or external brand imagery are available and none should be fabricated.

## Product Principles

1. Pointing should be faster and more precise than describing.
2. Side questions must never disturb the main task.
3. Every AI change must remain inspectable and reversible.
4. The interface should reveal relevant tools in context, not overwhelm the workspace.
5. A no-credential demo must still show the full interaction loop.

## Accessibility & Inclusion

Core actions must be keyboard reachable, focus-visible, and never depend on color alone. Chinese interface copy is primary; controls use familiar icons with accessible labels and tooltips.
