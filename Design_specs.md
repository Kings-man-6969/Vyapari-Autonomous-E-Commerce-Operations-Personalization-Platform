<vyapari_frontend_context>
You are building frontends for Vyapari, an autonomous e-commerce platform powered by AI agents. The platform has three distinct user surfaces, each requiring a unique visual identity that conveys intelligence, trust, and control.

**Project Identity:**
- Domain: AI-driven e-commerce operations
- Tech Stack: React 18 + Vite + Tailwind CSS
- Philosophy: Autonomous yet human-controlled; modern yet approachable
- Target Users: Customers (casual), Sellers (operational), Operators (technical)

**Design System Constraints:**
Avoid generic AI aesthetics. The design should feel intentional, reflect operational competency, and differentiate between the three surfaces through typography and color hierarchy (not by adding visual clutter).

---

### **Typography Strategy**

**Customer Dashboard (Shopping Experience):**
- Display font: Playfair Display or Fraunces (editorial, premium feel for product showcase)
- Body font: Source Sans 3 or IBM Plex Sans (readable, professional)
- Principle: High contrast between display and body weights (800 vs. 400). Large size jumps (3x+) for headings.
- Rationale: Customers browse products — typography should evoke quality and discovery.

**Seller Dashboard (Operations):**
- Display font: Space Grotesk or Clash Display (geometric, technical confidence)
- Body font: JetBrains Mono or IBM Plex Mono for data/metrics (legible, familiar to operators)
- Principle: Clear hierarchy between action labels and data values. Monospace for numbers and timestamps.
- Rationale: Sellers manage inventory and pricing — typeface should signal precision and control.

**HITL Operations Dashboard (AI Oversight):**
- Display font: Newsreader or Obviously (distinctive, editorial authority)
- Body font: Source Code Pro or IBM Plex Mono (signals technical depth)
- Principle: Monospace for decision IDs, confidence scores, and audit trails. Sans-serif for narrative context.
- Rationale: Operators review and approve AI decisions — typography should convey trustworthiness and auditability.

**Font Loading:** Load all fonts from Google Fonts. Declare font choice in comments before code generation.

---

### **Color & Theme Strategy**

**Customer Dashboard:**
- Dominant: Warm, accessible palette (emerald green, warm gray, gold accents)
- Accent: Confidence orange for stock warnings, success green for ratings
- Background: Subtle gradient or texture (not pure white) to add depth
- Rationale: Warm tones encourage browsing and conversion; product cards should feel premium but approachable
- Do NOT use: Purple gradients, bland whites, default Tailwind grays

**Seller Dashboard:**
- Dominant: Cool, professional palette (slate blue, charcoal, teal)
- Accent: Alert red for low stock, success teal for approved actions
- Background: Dark or light mode toggle; high contrast for data visibility
- Rationale: Operational dashboards need clarity and precision; color conveys action urgency
- Do NOT use: Soft pastels, colorful charts without hierarchy, low-contrast data tables

**HITL Operations Dashboard:**
- Dominant: High-contrast monochromatic (charcoal, white, slate)
- Accent: Amber for escalations, green for auto-executed, blue for advisory
- Background: Dark mode preferred for audit trails and decision queues
- Rationale: Human operators need clarity and visual hierarchy for rapid decision-making
- Do NOT use: Warm colors that distract, ambiguous grays, icon-heavy layouts

**CSS Variables:** Define all colors as CSS variables for consistency. Use a naming system:
```css
--color-primary, --color-accent, --color-success, --color-alert, --color-bg-primary, --color-text-primary
```

---

### **Motion & Interaction**

**Principle:** Animations serve a purpose — they guide attention, confirm actions, or reveal information progressively. Avoid decorative motion.

**High-Impact Moments:**
- Page load: Staggered reveal of cards/rows using `animation-delay` (100ms increments)
- Form submission: Confirmation pulse or success checkmark transition
- Decision queue updates (HITL): New items slide in with a subtle glow, fade-in for confidence scores
- Stock warnings (Seller): Alert badge with gentle bounce or color shift

**Implementation:**
- Use CSS `@keyframes` for simple transitions (fade, slide, pulse)
- Reserve JavaScript animations only for complex state changes
- Debounce interactions to prevent motion overload
- Always provide `prefers-reduced-motion` fallback

---

### **Backgrounds & Depth**

**Customer Dashboard:**
- Layered CSS gradients (top-to-bottom or subtle diagonal)
- Geometric patterns or organic shapes in the hero section
- Card-based layout with shadow depth (sm shadows for products, md for featured sections)
- Whitespace should feel intentional, not empty

**Seller Dashboard:**
- Minimal, functional backgrounds (light or dark mode)
- Data tables with alternating row backgrounds for legibility
- Cards grouped by decision tier (Autonomous/Advisory/Escalation) with subtle border colors
- Charts should have grid overlays for data reference

**HITL Operations Dashboard:**
- Dark background with monospace font for audit logs
- Decision cards with color-coded left borders (green/amber/red)
- Timeline or list view with timestamps and confidence scores as small badges
- Escape hatches for quick actions (Approve, Escalate, View Details)

---

### **Avoid Generic AI Aesthetics**

- ❌ Inter, Roboto, or system fonts as defaults
- ❌ Purple-on-white gradients
- ❌ Rounded corners everywhere (be selective)
- ❌ Evenly spaced, symmetrical layouts with no visual hierarchy
- ❌ Placeholder animations that slow interactions
- ❌ Color gradients without purpose
- ❌ Too many UI elements competing for attention

---

### **Context-Specific Requirements**

**Customer Dashboard specifics:**
- Product recommendation strips should use subtle shadows and hover states to signal interactivity
- Search results should clearly indicate why a product matched ("Matched: 'running shoes', Price: ₹X")
- Stock indicators (green/orange/red) should be color-blind accessible

**Seller Dashboard specifics:**
- Inventory table should show Days of Stock prominently (large, monospace numbers)
- Decision queue should separate by risk level visually
- Approval buttons should have clear, high-contrast styling

**HITL Operations Dashboard specifics:**
- Decision cards should display confidence score as a numeric value (0.85) not a visual bar
- Audit trails should use monospace font for all timestamps and decision IDs
- Escalation reasons should be highlighted in a distinct background color

---

</vyapari_frontend_context>