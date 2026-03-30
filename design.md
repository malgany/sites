# Design System Strategy: High-End Editorial

## 1. Overview & Creative North Star: "The Digital Curator"
This design system is built upon the concept of **The Digital Curator**. It moves away from the "template" aesthetic of the modern web by treating the screen as a high-end gallery or an avant-garde architectural blueprint.

The Creative North Star emphasizes **Functional Brutalism**: where the clarity of the information is the primary decoration. We achieve this through extreme contrast, intentional asymmetry, and "breathing" layouts that favor generous white space over cluttered containment. This system doesn't just display data; it presents it with authority.

By using massive typography scales and a strict monochromatic palette, we create a signature visual identity that feels both premium and timeless.

---

## 2. Colors
Our palette is a study in tonal depth. While the foundation is high-contrast black and white, we use an intricate scale of "Surface" tokens to define hierarchy without relying on archaic borders.

### The "No-Line" Rule
**Explicit Instruction:** Junior designers are prohibited from using `1px` solid borders to section off major page areas. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit directly on a `surface` background.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers: like stacked sheets of fine, heavy-weight paper.
- **Surface (Pure White #FFFFFF):** The base canvas.
- **Surface-Container-Low (#F3F3F4):** Used for large section backgrounds to provide a subtle "dip" in the layout.
- **Surface-Container-Lowest (#FFFFFF):** High-priority interactive cards nested within a lower-tier container to create a "pop-out" effect.
- **Primary (#000000):** Reserved for the most critical actions and headers.

### The "Glass & Gradient" Rule
To prevent the design from feeling "flat" or "cheap," floating elements (like navigation bars or hovering menus) should utilize **Glassmorphism**. Use semi-transparent versions of `surface` with a `backdrop-blur` of `12px`-`20px`.

For high-end CTAs, employ a subtle linear gradient transitioning from `primary` (#000000) to `primary-container` (#3B3B3B) at a `45deg` angle. This provides a "carbon" depth that flat black lacks.

---

## 3. Typography
Typography is the core of this system's personality. We use **Inter** to bridge the gap between technical precision and editorial elegance.

- **Display (Large/Bold):** Used for "Hero" statements. The `display-lg` (`3.5rem`) should be used with `tight` letter-spacing (`-0.02em`) to create a dense, authoritative block of text.
- **Headline (Bold):** Defines clear content sections. These should be strictly `primary` (#000000).
- **Body (Regular):** The `body-md` (`0.875rem`) provides a clean, readable contrast to the aggressive headers.
- **Labels (Medium):** Used for metadata and overlines. These are often in `secondary` (#5E5E5E) to create a visual "recede."

The hierarchy is intentional: massive headers demand attention, while generous `6` (`2rem`) and `8` (`2.75rem`) spacing units ensure the body copy remains effortless to consume.

---

## 4. Elevation & Depth
In this system, depth is earned, not given. We eschew traditional drop shadows for **Tonal Layering**.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural "lift" based on color logic rather than artificial shadows.
- **Ambient Shadows:** For elements that truly float (modals, dropdowns), use an extra-diffused shadow.
  Formula: `0px 24px 48px rgba(0, 0, 0, 0.06)`.
- The shadow must be low-opacity and "airy."
- **The "Ghost Border" Fallback:** If accessibility requires a border, use the `outline-variant` token at `15%` opacity. This defines the edge without introducing visual "noise." `100%` opaque borders are strictly forbidden for cards.

---

## 5. Components

### Buttons
- **Primary:** Solid `primary` (#000000) background, `on-primary` (#E2E2E2) text. Corner radius: `md` (`0.375rem`). Use `5` (`1.7rem`) horizontal padding for a wide, premium footprint.
- **Secondary:** `surface-container-highest` background. Subtle, non-intrusive.
- **States:** On hover, the primary button should shift to `primary-container` (#3B3B3B).

### Cards & Lists
- **Forbid Dividers:** Do not use line-rules to separate list items. Use the spacing scale, specifically `4` (`1.4rem`), or alternating surface tints to separate rows.
- **Layout:** Cards should favor vertical stacks with `headline-sm` titles and `label-md` category tags.

### Input Fields
- **Style:** Minimalist. No background fill; only a `1px` bottom border using `outline` (#777777).
- **Focus State:** The bottom border transforms into a `2px` solid `primary` (#000000) line.

### Chips (Selection)
- **Selection Chips:** Pill-shaped (`full` roundedness). Unselected: `surface-container-high` with `on-surface-variant` text. Selected: `primary` with `on-primary` text.

---

## 6. Do's and Don'ts

### Do
- **Use Intentional Asymmetry:** Align a large header to the left while keeping the body text in a narrower, offset column.
- **Embrace White Space:** If a section feels crowded, double the spacing token (for example, move from `10` to `20`).
- **Thin Strokes:** All icons must use a `1px` or `1.5px` stroke weight.

### Don't
- **Don't use "Grey":** Use our specific `surface` tokens. Neutral `#808080` has no place here.
- **Don't use Shadows on everything:** If a card is sitting on a different colored surface, a shadow is redundant.
- **Don't use "Standard" Grids:** Avoid the 12-column "Bootstrap" look. Experiment with 3-column or 5-column layouts to create a bespoke, "designed" feel.
- **Don't use Rounded Corners > 8px:** Keep the aesthetic sharp and architectural. Excessive roundness (for example, `16px+`) makes the system feel "bubbly" and consumer-grade rather than professional.
