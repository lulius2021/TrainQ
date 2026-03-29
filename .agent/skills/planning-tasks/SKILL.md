---
name: planning-tasks
description: Generates detailed, step-by-step implementation plans from requirements. Use when you need to break down a complex feature into small, testable tasks before coding.
---

# Planning Tasks

## When to use this skill
- When the user asks to "plan", "spec", or "break down" a feature.
- Before starting any complex coding task that touches multiple files.
- When requirements are clear but the implementation path is complex.

## Workflow

1.  **Analyze Requirements**: Ensure you have a clear understanding of the goal.
2.  **Define Architecture**: Briefly outline the approach (2-3 sentences).
3.  **Break Down Tasks**: Create bite-sized, atomic tasks (2-5 minutes execution time each).
4.  **Write the Plan**: meticulous detail, including specific file paths and test cases.
5.  **Review**: Ensure the plan is complete and feasible.
6.  **Save**: Write the plan to `docs/plans/YYYY-MM-DD-<feature-name>.md`.

## Instructions

**Bite-Sized Task Granularity**
Each step should be one atomic action:
- "Write the failing test"
- "Run it to make sure it fails"
- "Implement the minimal code to make the test pass"
- "Run the tests and make sure they pass"
- "Commit"

**Plan Document Format**
Every plan MUST start with this header and modify it for the specific context:

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---

### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `tests/exact/path/to/test.ts`

**Step 1: Write the failing test**

\`\`\`typescript
// test code here
\`\`\`

**Step 2: Run test to verify it fails**
Expected: FAIL with "function not defined"

**Step 3: Write minimal implementation**

\`\`\`typescript
// implementation code here
\`\`\`

**Step 4: Run test to verify it passes**
Expected: PASS

**Step 5: Commit**
\`\`\`bash
git add ...
git commit -m "feat: ..."
\`\`\`
```

## Key Principles
- **Exact file paths always**: No vague "the component file".
- **Complete code in plan**: Don't say "add validation", write the validation logic.
- **DRY, YAGNI, TDD**: Don't overengineer the plan.
- **Reference existing skills**: If a task requires `brand-identity`, note it.

## Execution Hand-off
After saving the plan, ask the user if they want to proceed with implementation immediately (interactive session) or if they want to review the plan first.
