# DDAM: Differential Dependency Analysis Merge
## Exact Algorithm for Concurrent Signature-Refactor / Body-Addition Conflict Resolution

**Decision**: D011 (e3d5c1ca)  
**Phronesis Cycle**: b23e458a (decide-and-enact, pass 1)  
**Predecessor Cycle**: c559e4cb (recommend-only, produced framework; this specification upgrades to exact algorithm)  
**Date**: 2026-03-27

---

## 1. Problem Statement (Precise)

In a local-first, eventually-consistent code editor, two clients concurrently edit the same function:

- **Op A** (Client 1): Refactors the function signature — renames, retypes, removes, or adds parameters  
- **Op B** (Client 2): Adds new statements to the function body (may reference parameters by name)

Neither client knows about the other's edit when it is authored (causally independent operations).

**The conflict is NOT structural**: `formal_parameters` and `statement_block` are sibling AST nodes — no structural/positional collision occurs. Standard merge algorithms (OT, CRDT, AST-merge) converge to a syntactically valid state. The conflict is **semantic**: newly inserted body code may reference parameter names that Op A has renamed or removed.

**Example of the failure case (naive merge)**:
```typescript
// Base state:
function calculateTotal(a: number, b: number): number {
  return a + b;
}

// Op A (Client 1 — concurrent): rename params
function calculateTotal(x: number, y: number): number {
  return a + b;  // (body not updated during concurrent sig refactor)
}

// Op B (Client 2 — concurrent): add body logic
function calculateTotal(a: number, b: number): number {
  const tax = a * 0.1;  // uses 'a'
  return a + b + tax;
}

// After naive merge (standard CRDT/OT convergence):
function calculateTotal(x: number, y: number): number {
  const tax = a * 0.1;    // ← 'a' is UNDEFINED — semantic breakage
  return a + b + tax;      // ← 'a', 'b' are UNDEFINED — semantic breakage
}
```

DDAM resolves this correctly:
```typescript
// After DDAM merge:
function calculateTotal(x: number, y: number): number {
  const tax = x * 0.1;    // ← repaired: 'a' → 'x'
  return x + y + tax;      // ← repaired: 'a' → 'x', 'b' → 'y'
}
```

---

## 2. Input Contract

```
DDAM(
  base:  FunctionAST,        // Common-ancestor function state
  opA:   SignatureRefactor,  // Set of parameter mutations
  opB:   BodyAddition        // Set of AST node insertions into body
) → MergedResult | Escalation
```

### Types

```typescript
type FunctionAST = {
  params: Parameter[];
  body:   StatementNode[];
};

type Parameter = {
  nodeID: UUID;       // Stable ID assigned at creation — NOT positional index
  name:   string;
  type:   TypeAnnotation;
};

type SignatureRefactor = Array<
  | { type: 'RENAME';  paramIndex: number; oldName: string; newName: string }
  | { type: 'RETYPE';  paramIndex: number; oldType: TypeAnnotation; newType: TypeAnnotation }
  | { type: 'REMOVE';  paramIndex: number; name: string }
  | { type: 'ADD';     position: number;   name: string; type: TypeAnnotation }
>;

type BodyAddition = {
  insertedNodes: ASTNode[];  // Parsed subtrees of inserted code
};

type BindingManifest = Map<NodeID, number>;
//   key:   NodeID of an identifier node in the function body
//   value: paramIndex of the parameter it resolves to in base.params

type MergedResult = {
  signature: Parameter[];
  body:      StatementNode[];
};

type Escalation = {
  conflicts:    ConflictRecord[];  // Each records: identifier node, the removed param it referenced
  partialMerge: StatementNode[];   // Body with all non-conflicting repairs applied
  signature:    Parameter[];       // The fully-merged signature (Op A applied)
};
```

---

## 3. The Algorithm (6 Steps)

### Step 1 — Compute BindingManifest from Base State

```
binding_manifest: BindingManifest = {}

for each identifier_node in base.body (depth-first traversal):
  resolved = scope_resolve(identifier_node, base.params)
  if resolved ≠ UNRESOLVED:
    binding_manifest[identifier_node.nodeID] = resolved.paramIndex
```

**Purpose**: Establish the ground-truth identifier→parameter dependency map from the common ancestor. Every identifier in the existing body that is bound to a parameter is recorded.

**Note**: `scope_resolve` must respect lexical scoping. An identifier in the body that shadows a parameter with a local variable of the same name returns UNRESOLVED — it is NOT a parameter reference.

---

### Step 2 — Derive rename_map from Op A

```
rename_map: Map<number, { newName: string } | REMOVED> = {}

for each change in opA:
  if change.type == 'RENAME':
    rename_map[change.paramIndex] = { newName: change.newName }
  elif change.type == 'REMOVE':
    rename_map[change.paramIndex] = REMOVED
  // ADD and RETYPE: no implications for existing identifier bindings
```

**Purpose**: Record which parameter indices were renamed or removed. `RETYPE` changes the type annotation but not the name — existing body references remain valid (type correctness is downstream validation). `ADD` introduces a new parameter — no existing body identifiers refer to it.

---

### Step 3 — Apply Op B to Base Body

```
body_B: StatementNode[] = apply(opB, base.body)
new_identifier_nodes: IdentifierNode[] = 
  all identifier nodes in opB.insertedNodes (depth-first traversal)
```

**Purpose**: Produce the body as Op B's author intended, and extract the identifier nodes from newly inserted code that will need binding analysis.

---

### Step 4 — Extend BindingManifest with New Identifiers

```
for each ident in new_identifier_nodes:
  resolved = scope_resolve(ident, base.params)
  if resolved ≠ UNRESOLVED:
    binding_manifest[ident.nodeID] = resolved.paramIndex
  // UNRESOLVED: 'ident' is not a parameter reference in base scope
  //             (free variable, local var, imported name, etc.) — no entry added
```

**Purpose**: Establish bindings for identifiers introduced by Op B. Scope resolution uses the **base** parameter list (the world as Op B's author knew it). This correctly captures intent: Op B's author named `a` intending to reference the parameter `a` as it existed at base state.

**Critical**: Use `base.params` (not `signature_A`) for scope resolution in this step. Op B was authored against the base state.

---

### Step 5 — Detect and Repair Cross-Reference Conflicts

```
repairs:     Repair[] = []
escalations: ConflictRecord[] = []

for each (nodeID, paramIndex) in binding_manifest:
  if paramIndex is NOT in rename_map:
    continue  // Parameter unchanged by Op A — no action needed

  outcome = rename_map[paramIndex]
  ident_node = lookup(nodeID, body_B)
  
  if outcome == REMOVED:
    escalations.push({
      identifierNode: ident_node,
      removedParam:   base.params[paramIndex]
    })
  elif ident_node.text ≠ outcome.newName:
    repairs.push({
      node:    ident_node,
      newText: outcome.newName
    })
  // else: ident_node.text == outcome.newName → already correct, no action
```

**Purpose**: For each identifier that is (a) bound to a parameter in the binding manifest AND (b) that parameter was mutated by Op A — either repair the identifier to use the new name, or escalate if the parameter was removed.

---

### Step 6 — Apply Repairs and Return

```
repaired_body = apply(repairs, body_B)
signature_A = apply(opA, base.params)

if escalations is non-empty:
  return Escalation(
    conflicts:    escalations,
    partialMerge: repaired_body,
    signature:    signature_A
  )
else:
  return MergedResult(
    signature: signature_A,
    body:      repaired_body
  )
```

**Purpose**: Produce the final merged function. If escalations exist, return a partial merge (all non-conflicting repairs applied) alongside the conflict records for user resolution. Do NOT silently suppress escalations or produce code with dangling references.

---

## 4. Determinism Proof

The algorithm is deterministic if and only if all clients computing `DDAM(base, opA, opB)` for identical inputs produce identical outputs.

| Step | Determinism Ground |
|------|-------------------|
| Step 1 | `scope_resolve` is a pure function of `(identifier_node, params)`. Given identical `base`, identical `binding_manifest` results. |
| Step 2 | `rename_map` is computed purely from `opA`. Given identical `opA`, identical result. |
| Step 3 | `body_B` is computed by applying `opB` to `base.body`. Given identical inputs, identical result. |
| Step 4 | New identifier scope resolution uses identical `base.params` and identical `opB.insertedNodes`. Identical result. |
| Step 5 | Each `(nodeID, paramIndex)` pair has exactly one entry in `rename_map` (or none). The repair/escalate decision is fully determined. No ties. |
| Step 6 | Repair application is a sequence of node-text substitutions — fully determined by Step 5's outputs. |

**Convergence (commutativity)**: DDAM is asymmetric — it designates one operation as `SignatureRefactor` (Op A) and one as `BodyAddition` (Op B). Convergence requires:

- If both clients receive both operations, they must independently classify which is Op A and which is Op B. Classification rule: **any operation that modifies `formal_parameters` is Op A; any operation that inserts into `statement_block` is Op B**. This classification is deterministic given the operations themselves (their target AST node is embedded in the operation).

- If a single client simultaneously emits both a signature refactor AND a body addition (authored on the same client), DDAM processes them as a single atomic change, not a concurrent conflict.

- Concurrent body-only edits (Op B₁ and Op B₂, no signature change) are handled by standard CRDT/OT. DDAM is not invoked.

---

## 5. scope_resolve Specification

`scope_resolve(identifier_node: IdentifierNode, params: Parameter[]) → { paramIndex: number } | UNRESOLVED`

**Contract**:
1. If the identifier's name matches a parameter in `params` at index `i`, AND the identifier is in the lexical scope where that parameter is visible (i.e., it is inside the function body and not shadowed by an intervening binding), return `{ paramIndex: i }`.
2. Otherwise return `UNRESOLVED`.

**Shadowing rule**: An identifier `x` is shadowed (→ UNRESOLVED) if there exists a `let`, `const`, `var`, or function declaration for `x` in any enclosing scope between the identifier and the function boundary.

**Edge cases**:
- **Destructured parameters** (e.g., `{ a, b }: Options`): The destructured names `a` and `b` are themselves parameter-bound identifiers. scope_resolve should record the binding at the destructured leaf level, indexed to the parameter declaration node.
- **Default parameter values** (e.g., `function f(a = 0, b = a + 1)`): The `a` in `b = a + 1` in the parameter list is in scope; it references the prior parameter. scope_resolve must handle this by including parameter-list positions in scope analysis.
- **Rest parameters** (e.g., `...args`): Rest parameter elements are bound to the rest parameter declaration. scope_resolve should track `args` references back to the rest parameter.
- **Partial insertions**: If Op B inserts syntactically incomplete code (a fragment without a closed expression), scope_resolve returns UNRESOLVED for any identifiers within — do not infer partial bindings.

**Implementation note**: tree-sitter is available in the project's `codegraph` package. The `formal_parameters` node traversal is already implemented. scope_resolve is a natural extension: given a node and a function boundary, walk up the scope chain and check each binding point.

---

## 6. The Irresolvable Case

When Op A removes a parameter AND Op B inserts code that references that parameter, DDAM emits an `Escalation`. This is not a defect — it is the epistemically correct response.

**Why no algorithm can auto-resolve this case**:

Given:
- Op A removes parameter `a`
- Op B inserts `const tax = a * 0.1;`

Candidate resolutions:
1. Use the new first parameter (if one was added by Op A) — but what if no new parameter matches the type?
2. Insert a new local variable `a` — but what value?
3. Delete the inserted line — but it may be essential to Op B's intent
4. Treat `a` as a free variable referring to an outer scope — but there may be no outer `a`

None of these can be chosen without knowing Op B's author's intent. The algorithm cannot know that intent. **Surfacing the conflict to the user with full context is the only behavior that does not violate the 'without breakage' requirement**.

**Escalation content (for UI/UX resolution)**:
- The function in partial-merge state (all non-conflicting repairs applied, dangling references highlighted)
- The removed parameter's name, type, and original index
- The identifier nodes that reference the removed parameter (location in body)
- Both operations in human-readable form
- Suggested resolution options (for UX layer to offer): "Rename reference to X" (if a replacement parameter exists), "Remove this statement", "Add local variable `a = ...`"

---

## 7. Scaling Generalization: DDAM → Event-Sourced Replay (F)

For concurrent sessions with more than 2 clients or complex concurrent editing sequences, DDAM generalizes to event-sourced semantic replay:

1. All operations are stored in a total-ordered log: `{opID: UUID, timestamp: LamportClock, siteID: ClientID, op: Operation}`
2. Total order: `(timestamp, siteID)` — lexicographic, deterministic
3. On divergence, replay all operations in total order
4. During replay, scope_resolve is called at replay time (against the state at each replay point), and DDAM's Step 5 repair logic is applied when a `SignatureRefactor` event precedes a `BodyAddition` event for the same function in total order

The binding_manifest and repair logic are identical between DDAM (3-way merge) and the replay engine (n-operation case). The implementation should ensure this shared logic is factored into a standalone module.

---

## 8. Forward-Binding Architectural Intention (AI-0065 / 08fe1436)

The binding_manifest (Map[NodeID → ParamIndex]) computed by DDAM is architecturally identical to the reference edges in the Directed Hypergraph CRDT (Possibility C, P2). The path to C's full graph-based representation is:

- **Now (DDAM)**: binding_manifest is computed transiently at merge time from the base state
- **Future (C)**: binding_manifest is stored persistently as a first-class CRDT object (Y.Map or Automerge Map), with reference edges from identifier nodes to parameter declaration nodes (identified by UUID, not by name)

To make this migration natural:
- NodeIDs must be stable UUIDs assigned at AST-node creation (not positional paths — fragility demonstrated in Possibility B analysis)
- ParamIndex must use parameter UUID (not array position) — position changes when parameters are added/removed
- The binding_manifest must be serializable (JSON-compatible key-value pairs)

An implementation that uses positional paths for NodeIDs or integer indices for parameter identity will create a **blind alley** — a high-survival scheme that blocks C's emergence. This intention (AI-0065) must be honored during implementation.

---

## 9. Summary: What DDAM Resolves

DDAM resolves the implicit unknown of cycle b23e458a:

> "The precise structural and algorithmic topology required to deterministically resolve concurrent edits where one edit changes the semantic container (function signature) and another edits the content inside that container — without knowing in advance how these two operations interact at the graph, token, or AST level."

**The topology**: A 3-way merge where the third dimension is not a text buffer or AST node tree but a **binding manifest** — a map from identifier node identity to parameter index, computed from the common ancestor. The conflict is detected by intersecting the binding manifest with the rename map; the resolution is either mechanical repair (update identifier text to new parameter name) or honest escalation (surface the genuinely underdetermined case).

**Why it is deterministic**: Every step is a pure function of its inputs. No step involves randomness, timestamp ordering among concurrent events, or last-write-wins semantics.

**Why it does not break**: The ESCALATE branch prevents any silently-broken code from being committed. The repair branch produces code that is semantically equivalent to what Op B's author would have written had they known about Op A.

**What it creates**: Conditions for the emergence of C (Directed Hypergraph CRDT) by establishing the binding_manifest as the fundamental data structure for identifier-parameter relationships in function-level merges.
