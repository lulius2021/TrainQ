---
name: brainstorming-ideas
description: Facilitates a collaborative design session to clarify requirements and explore solutions. Use this skill when the user has a vague idea or requests a new feature without a spec.
---

# Brainstorming Ideas Into Designs

## When to use this skill
- When the user says "I have an idea..."
- When a task is vague or lacks a clear specification.
- Before starting a planning phase for a new, complex feature.

## Workflow

1.  **Understand Context**: Check project state (files, docs, logic).
2.  **Ask Questions**: Clarify the idea *one question at a time*.
3.  **Propose Options**: Offer 2-3 approaches with trade-offs.
4.  **Refine Design**: Present the design in small chunks (200-300 words), validating each chunk.
5.  **Document**: Write the validated design to `docs/plans/YYYY-MM-DD-<topic>-design.md`.

## Instructions

**Principles of Brainstorming**
- **One question at a time**: Don't overwhelm the user.
- **Multiple choice preferred**: "Should we use A or B?" is better than "How should we do this?".
- **YAGNI ruthlessly**: Remove bloat.
- **Incremental validation**: "Does this section look right?"

**The Dialogue Flow**
1.  **Discovery**: "What is the core problem we are solving?"
2.  **Options**: "We could do X (fast but limited) or Y (scalable but complex). I recommend X because..."
3.  **Design**: "Here's the data model. Does this look right?" -> "Here's the API. Does this look right?"

**Output**
Once the brainstorming is complete and the design is validated, create a design document.
Do not start coding immediately. Ask if the user wants to proceed to the **planning-tasks** skill to create an implementation plan.

## Resources
- Use `brand-identity` skill if design questions come up.
