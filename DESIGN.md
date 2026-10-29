# Vector Intelligence design system

## Direction

The site pairs a direct, image-led hero with an editorial service story. The supplied mascot is the hero's primary image. White, deep navy, cobalt, and cyan come from the supplied brand assets. Large, clear typography carries the offer; shadcn/ui components provide consistent controls.

## Tokens

- Canvas: `#F7F9FC`; white surfaces: `#FFFFFF`.
- Ink: `#101D35`; secondary ink: `#3D506A`.
- Primary action: `#0B39D1`; brighter blue: `#1697F2`.
- Deep field: `#061C45`.
- Typography: Manrope for display and body. Headings use close spacing and short lines.
- Corners: 12px for cards and controls. Flat fields distinguish sections; resting cards have no shadow.

## Composition

- Desktop hero: direct copy on white at left; large mascot crop on navy at right. The supplied logo sits in the header.
- The expertise section uses a broad white field, a strong heading, and three service surfaces with distinct tints.
- Later sections use generous spacing and solid blue fields to avoid a uniform card grid.
- On phones, copy leads and the mascot follows as one full-width image panel.

## Interaction

- One primary action name throughout: “Start a conversation.”
- Expertise tabs reveal focused service details.
- Contact action requests an email link only after a click, keeping the address out of static HTML and client bundles.
- Keyboard focus is visible, and motion respects reduced-motion settings.
