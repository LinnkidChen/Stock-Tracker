# Plans

Use this directory for implementation context that should survive beyond a
single agent run.

## Layout

- `active/`: current project plans that are not yet implemented.
- `completed/`: plans retained after implementation for historical context.

Superpowers-generated specs and plans live separately:

- `../superpowers/specs/`
- `../superpowers/plans/`

Spec Kit assets live under `../../.specify/`.

## Rules

- A plan should name exact files it expects to create or modify.
- Move or copy completed plans into `completed/` when the team wants to retain
  them outside the Superpowers directory.
- Remove stale plans or mark them superseded from the plan file itself.
- Keep execution status factual; avoid claiming checks passed unless the command
  output was observed.
