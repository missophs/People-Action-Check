---
name: anti-slop
description: Detect and eliminate generic AI-slop patterns in code and visual design (variable names, over-engineering, template layouts, generic gradients). Defers text/prose slop to the existing humanize skill.
---

# Anti-Slop: Code and Design

Scope note: this skill covers code and visual design only. A request to review writing, copy, or prose for AI-isms belongs to the `humanize` skill, which already has a detailed removal list and voice rules. Route it there instead of applying the checklist below to sentences.

## When to use

* Reviewing AI-generated code or a design mockup before delivery
* Cleaning up an existing codebase or design file that feels generic
* Setting quality standards for a project (code review checklist, design QA)
* User explicitly asks to check for "AI slop," "generic AI patterns," or "does this look AI-generated" in code or design

## Code slop

### High-priority targets

Generic names — rename to what the thing actually is:

* `data`, `result`, `temp`, `item`, `obj`, `value`, `input`, `output` → name the actual content (`invoiceRows`, `parsedConfig`, `staleSessionIds`)
* `handleData()`, `processItems()`, `manageUsers()` → name the specific action and object (`normalizeInvoiceRows()`, `archiveExpiredSessions()`)
* Generic class names (`Manager`, `Handler`, `Processor`, `Helper`, `Util`) with no more specific responsibility → name the responsibility directly

Obvious comments — a comment that restates the line below it in English adds nothing; delete it. Keep comments that explain why, not what:

```
# Bad — restates the code
# Create a user
user = User()

# Bad — restates the code
# Loop through items
for item in items:

# Fine — explains a non-obvious reason
# Retry once: the upstream API drops ~1% of requests under load
response = call_with_retry(endpoint)
```

Over-engineering — flag and simplify:

* A factory, strategy, or abstract base class wrapping a single implementation with no second caller in sight
* A config object, options bag, or dependency-injection layer for a function called from exactly one place
* Defensive null-checks and type guards around values the type system or caller contract already guarantees
* A generic/parameterized solution built for one concrete case, "in case we need it later"

Empty or filler docstrings — a docstring that just repeats the function signature in prose ("This function takes a user and returns a result") should be cut or replaced with the actual contract: preconditions, side effects, error cases.

### Quality principles

* Clarity over cleverness: prefer the boring, direct implementation. Optimize only when profiling or a stated requirement demands it.
* Meaningful names: a variable name should tell you what's in it without opening the assignment; a function name should tell you the action and the object it acts on.
* Match abstraction to actual reuse. Build the second and third case before building the generic one — don't pre-abstract for a future that hasn't shown up yet.
* Document why, not what. Skip comments on self-evident code; put effort into public API docs and genuinely non-obvious logic.

### Workflow

1. Scan for generic names first (variables, then functions, then classes) — this is the highest-signal, lowest-effort pass.
2. Strip comments that only restate the adjacent line.
3. Look for abstraction with a single concrete caller; inline it unless there's a stated reason more callers are coming soon.
4. Re-read function and class names against what they actually do now, after the above changes — a rename upstream often makes a downstream name wrong too.
5. Run tests after each significant change, not just at the end.

## Design slop

### High-priority targets

Visual:

* Generic purple/pink/cyan gradient backgrounds with no relationship to the content or brand
* Glassmorphism or neumorphism applied because it's trendy, not because it clarifies layering or hierarchy
* Floating 3D shapes, blobs, or abstract mesh backgrounds with no connection to what the page is about
* Every element on the page getting the identical visual treatment (same card style, same shadow, same border-radius) regardless of its importance

Layout:

* A template dropped in wholesale, ignoring what this specific content actually needs (e.g., forcing tabular data into a card grid)
* Everything wrapped in a card regardless of whether it's a discrete, browsable unit or just a section of a longer document
* Center-aligning every block by default instead of building a real reading hierarchy
* Whitespace used to fill space rather than to group related things and separate unrelated ones

Copy:

* Headlines like "Empower your business," "Unlock your potential," "Elevate your workflow" — no specific claim, swappable into any product
* CTAs that just say "Get Started" / "Learn More" with no object (start what? learn what?)
* Descriptions built from buzzwords ("seamless," "robust," "cutting-edge," "next-generation") instead of a concrete capability or number
* Stock-photo aesthetic: generic people-in-an-office imagery standing in for an actual product screenshot or real content

### Quality principles

* Content-first: let the actual content decide the layout. A comparison table needs a table, not three cards side by side.
* Every visual choice should be justifiable in one sentence tied to this content — "there's a gradient here because..." should have a real answer, not "it looked more finished."
* Vary treatment by importance. The primary action should look different from a secondary one; not every card is equally important.
* Copy should name the actual thing: what specifically does the product do, for whom, with what number or example — not a swappable claim.

### Workflow

1. Check backgrounds and decorative elements first: does each one serve the content, or is it filler? Cut filler.
2. Check whether the layout was chosen for this content or dropped in from a template — look for content awkwardly forced into a shape (long text in a narrow card, a table flattened into a list).
3. Read every headline and CTA out loud — if it could sit on a completely different product's page unchanged, it's generic. Make it specific to this one.
4. Check visual hierarchy: pick the single most important element on the page or screen and confirm it actually looks the most important.

## General principles

* Quality over uniformity: a codebase or design doesn't need every file or screen to look identical — it needs each part to fit its own job.
* Context over rules: a pattern flagged above can be the right call in context (a generic `Manager` class name is fine if the codebase's whole vocabulary is built around that word already). Use judgment, not a blanket ban.
* Specificity over generality, in both code and design: name the real thing instead of the category it belongs to.
