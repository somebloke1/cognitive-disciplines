# noetic-pi Self-Development Protocol

noetic-pi is used for its own development. You are a running agent inside the app you are modifying. This creates a constraint: changes to the app can disrupt your own session. This document defines the protocol.

---

## HMR Is Disabled

Vite's Hot Module Replacement is disabled (`hmr: false` in `packages/web/vite.config.ts`).

**What this means:**
- Code changes to `packages/web/src/` do NOT automatically reload the browser
- Your terminal session, WebSocket connection, and conversation history are preserved across file edits
- The browser only reloads when you or the user explicitly refreshes

**Protocol:** Make all your web changes, verify them (read, typecheck, test), then tell the user the changes are ready and ask them to refresh the browser when convenient.

---

## Three Tiers of Changes

Changes fall into three tiers with different restart requirements:

### Tier 1 — Web UI (`packages/web/src/`)
**Requires:** Browser refresh only  
**Your session:** Survives intact  
**Protocol:**
1. Make changes
2. Run `pnpm --filter @noetic-pi/web typecheck` to verify TypeScript
3. Run `pnpm --filter @noetic-pi/web test` to run tests
4. Tell the user: "Changes ready — please refresh the browser when convenient"
5. Continue working; the user refreshes at their discretion

### Tier 2 — Server (`packages/server/src/`)
**Requires:** Server restart (`tsx --watch` restarts automatically on file save)  
**Your session:** **DISRUPTED** — server restart kills all PTY sessions and WebSocket connections  
**Protocol:**
1. Batch all server changes before saving
2. Warn the user before saving: "I am about to save server changes. This will restart the server and disconnect your terminal session. Please be ready."
3. Save all server changes at once
4. The server auto-restarts via tsx --watch
5. The browser reconnects automatically; you will need to re-establish your session

### Tier 3 — APM (`packages/apm/src/`)
**Requires:** Rebuild + full restart  
**Your session:** **DISRUPTED** — APM restart kills orchestration state  
**Protocol:**
1. Make source changes
2. Run `pnpm --filter @noetic-pi/apm build` to compile
3. Tell the user: "APM changes are compiled. A full restart (`pnpm dev`) is required. All running agents and orchestration cycles will be lost."
4. User restarts at their discretion
5. Do NOT restart the APM yourself — this is a user-only operation

---

## Key Constraints

**Never restart the APM yourself.** APM restart is a user-only operation. If you determine a restart is needed, say so clearly and wait.

**Batch changes.** When modifying server or APM code, plan the full set of changes before saving any of them. Partial server changes that auto-restart mid-edit leave the app in a broken state.

**Typecheck before signaling ready.** Never ask the user to refresh without first running typecheck and tests. A broken app after a refresh is worse than a stale one.

**Preserve the session.** You are developing inside a running system. Treat your own continuity as a constraint: choose approaches that let you remain operational throughout development where possible. Tier 1 changes are always safe. Tiers 2 and 3 require explicit coordination.
