# Flider Canvas Roadmap (Post-Release)

## Product target

True WYSIWYG workflow where Canvas, Preview, and Live share one rendering system.

## Fast-track estimate

- MVP: 9-14 working days
- V2 enhancements: +3-5 weeks

## MVP scope (strict)

### 1. Shared Renderer Foundation

- Build reusable render components for page/blocks/layout.
- Use same rendering layer for local preview and website output.

### 2. Canvas UI (minimum usable)

- Left: pages + block library.
- Center: editable canvas with drag/sort blocks.
- Right: inspector for selected block settings.
- Initial block set: `heading`, `text`, `image`, `gallery`, `contact`.

### 3. Persistence + Safety

- Save through one backend path only.
- Atomic writes for all project-state files.
- Serialized save queue per project.

### 4. Kirby Integration

- Kirby content remains single source of truth.
- Canvas writes to Kirby-compatible structure.
- Existing Kirby editor kept as fallback during rollout.

### 5. Acceptance criteria

- User can build/edit a page fully inside Canvas.
- Preview and Live match layout/content behavior.
- Reopen project preserves exact block order/content.

## V2 scope

- Breakpoint editing (desktop/tablet/mobile).
- Inline text editing on canvas.
- Undo/redo + duplicate/copy/paste blocks.
- Advanced visibility/spacing controls.

## Delivery strategy

- Implement in separate workspace/branch.
- Keep production branch frozen except hotfixes.
