---
name: Magic Code
description: 精密标注台式 AI 工作区
colors:
  primary: "var(--color-accent-600)"
  primary-soft: "var(--color-accent-50)"
  surface: "var(--color-background-primary-default)"
  surface-muted: "var(--color-background-secondary-default)"
  ink: "var(--color-text-primary)"
  ink-muted: "var(--color-text-secondary)"
  separator: "var(--color-separator-border)"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  artifact-display:
    fontFamily: "Avenir Next, Avenir, Helvetica Neue, sans-serif"
    fontSize: "clamp(44px, 7vw, 84px)"
    fontWeight: 700
  artifact-body:
    fontFamily: "Avenir Next, Avenir, Helvetica Neue, sans-serif"
    fontSize: "18px"
    fontWeight: 400
rounded:
  small: "6px"
  control: "7px"
  icon: "8px"
  panel: "9px"
  artifact-button: "10px"
  mobile-composer: "18px"
  composer-tray: "24px"
  composer-pill: "999px"
spacing:
  tight: "8px"
  regular: "16px"
  spacious: "24px"
components:
  workbench-nav:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    height: "36px"
  inspector-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
---

# Magic Code Visual System

## Overview

**Creative North Star: "精密标注台"**

This is an operating workspace, not a landing page. A quiet three-column shell puts conversation beside the artifact while navigation and inspection remain available without claiming attention. The user should see exactly which element or region a request addresses.

## Colors

BoardUI semantic tokens are the source of truth. Neutral surfaces and separators establish the panes; the accent marks the active target and primary command. Status and annotation colors are used only where their meaning is visible. Dark mode follows the same semantic tokens rather than duplicating raw colors.

**The Target Rule.** A selection needs a visible outline and a textual element name; color alone is never the only signal.

## Typography

The application uses BoardUI composite Inter styles. Compact body and caption roles support repeated scanning; title roles identify the active conversation and artifact. Exported sample HTML uses the distinct Avenir stack and a fluid hero display scale; it is content, not workbench chrome. Code, coordinates, and dimensions may use monospace, not ordinary navigation.

## Layout

Desktop uses a 256px navigation pane, flexible conversation pane, and 420-900px preview pane. Navigation collapses to a 64px rail; preview collapses to a 42px reopening tab and can be resized. At constrained desktop widths the navigation rail makes room for the conversation. The existing narrow-screen chat/canvas switch remains available.

**The Artifact Rule.** Inspection tools belong inside the preview as a contextual drawer, never as a permanent fourth column.

## Elevation & Depth

Pane boundaries are semantic hairlines. The artifact viewport has a restrained offset shadow; floating question and inspector surfaces use BoardUI elevation. Ordinary page sections do not float as cards.

## Shapes

Toolbars and row selections use compact 6-10px corners. The chat composer is a distinct 24px tray with a pill-shaped input and circular tool buttons; at narrow widths its tray reduces to 18px. Target outlines, region rectangles, and annotation pins follow the underlying artifact geometry. The authored HTML preview retains its own visual identity independent of the workbench.

## Components

Use installed BoardUI Button, IconButton, Tooltip, Input, Textarea, Switch, SegmentedControl, Tabs, Avatar, Chip, and AgentThinking. The navigation presents project and conversation records as compact rows. The preview mode switch is a segmented control; properties, annotations, and versions use tabs within a contextual inspector. Hover identifies a target, click pins it, and a drag defines a region with dimensions.

The chat composer groups add actions, text input, model selection, voice, and send in one horizontal pill. Project, local branch, Agent mode, and unavailable context usage occupy a restrained row below it. Model and usage labels must reflect real connection state, not invented providers or metrics.

## Do's and Don'ts

- Do show the project and conversation currently being edited.
- Do keep independent text-selection questions separate from the main message stream.
- Do preserve keyboard focus, tooltip labels, version history, and local-only account language.
- Don't make the preview inspector permanent or add decorative marketing panels to the workbench.
- Don't use hard-coded application colors where BoardUI semantic tokens provide the role.
