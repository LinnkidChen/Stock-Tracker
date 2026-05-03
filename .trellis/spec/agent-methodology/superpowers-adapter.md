# Trellis + Superpowers Adapter Contract

## Precedence

Trellis is the only workflow controller for this project.

Use:

- Trellis task lifecycle
- Trellis PRDs
- Trellis specs
- Trellis check
- Trellis update-spec
- Trellis workspace journals
- Trellis sub-agent mechanisms where available

Do not use:

- Full Superpowers plugin workflow
- `using-superpowers` as a controlling skill
- Superpowers SessionStart / bootstrap behavior
- `docs/superpowers/plans/` as the canonical plan location

## Canonical Locations

- Requirements and acceptance criteria: `.trellis/tasks/<active-task>/prd.md`
- Implementation plan: `.trellis/tasks/<active-task>/implementation-plan.md`
- Durable project knowledge: `.trellis/spec/`
- Session memory: `.trellis/workspace/<developer>/journal-*.md`
- Adapter reference: `.trellis/integrations/superpowers/reference/`

## Conflict Rule

If a Superpowers reference says to use a different path, command, phase, or controller, translate the intent into Trellis equivalents. Trellis wins.
