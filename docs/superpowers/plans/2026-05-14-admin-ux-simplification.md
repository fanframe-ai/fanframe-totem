# Admin UX Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin panel feel simpler, more professional, and easier to operate remotely.

**Architecture:** Keep the current React/Vite admin app and Supabase data model. First improve the shared visual system and the highest-friction area, the team editor, without changing backend contracts.

**Tech Stack:** React, Vite, Supabase, lucide-react, plain CSS.

---

### Task 1: Visual System Cleanup

**Files:**
- Modify: `apps/admin/src/styles.css`
- Modify: `apps/admin/src/App.tsx`

- [ ] Add a calmer visual foundation with better spacing, lighter sidebar, cleaner panels, stronger button hierarchy, professional badges, and table/list affordances.
- [ ] Keep existing class names working so dashboard, devices, sales, problems, users, and settings continue rendering.
- [ ] Add new reusable classes for simplified lists, tabbed editors, sticky action bars, preview panels, and compact field groups.
- [ ] Run `npm run admin:build`.

### Task 2: Teams List Redesign

**Files:**
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] Replace the dense teams table with scannable team cards.
- [ ] Show only the useful summary: name, status, price, number of shirts/backgrounds, kiosk enabled, and edit action.
- [ ] Keep the existing `/times/:slug` edit route.
- [ ] Run `npm run admin:build`.

### Task 3: Team Editor Simplification

**Files:**
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] Replace the long vertical team form with tab buttons: `Basico`, `Venda`, `Visual`, `Textos`, `Camisas`, `Cenarios`, `IA`, `Avancado`.
- [ ] Show one section at a time, with simple human language.
- [ ] Keep saving the same `teams` payload and keep remote kiosk sync after save.
- [ ] Split shirts and backgrounds into separate tabs while reusing `AssetEditor`.
- [ ] Add a right-side preview/status panel summarizing how the totem will look and what is missing.
- [ ] Run `npm run admin:build`.

### Task 4: Verification

**Files:**
- No new files.

- [ ] Run `npm run lint`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Commit and push to `origin main`.
