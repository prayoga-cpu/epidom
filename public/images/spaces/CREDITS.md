# Photos behind the home page's "One link, 3 devices connected" cards, the "POS Mode, up close" stage and the footer

Sourced 2026-11-11 from Wikimedia Commons, where each is the CC0 copy of an Unsplash
photo: no credit is required and commercial use is allowed. Credits are kept here anyway.
Each was cropped, converted to grayscale and compressed. They are shown as a faint texture
under a solid brand colour (see three-spaces-section.tsx and footer-scene.tsx), never as-is.
No identifiable face and no brand mark is visible in any of them.

| File | Source | Author | Licence |
|---|---|---|---|
| phone-orders.jpg (960x720) | [Cafe menu (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Cafe_menu_(Unsplash).jpg) | Peter Miranda petermiranda | CC0 |
| pos.jpg (960x720) | [Chefs at Work (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Chefs_at_Work_(Unsplash).jpg) | Michael Browning michaelwb | CC0 |
| dashboard.jpg (960x720) | [Laptop and a mug (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Laptop_and_a_mug_(Unsplash).jpg) | Ryan Riggins ryan_riggins | CC0 |
| closing-time.jpg (2000x833) | [Empty cozy café (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Empty_cozy_caf%C3%A9_(Unsplash).jpg) | Michael Dam michaeldam | CC0 |
| tour-phone-orders.jpg (1400x1000) | [Cafe bar counter (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Cafe_bar_counter_(Unsplash).jpg) | Serge Esteve sce767 | CC0 |
| tour-finance.jpg (1400x1000) | [Crunching the numbers (Unsplash).png](https://commons.wikimedia.org/wiki/File:Crunching_the_numbers_(Unsplash).png) | William Iven firmbee | CC0 |
| tour-stock.jpg (1400x1000) | [Loaves of Bread (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Loaves_of_Bread_(Unsplash).jpg) | Clark Young clark1 | CC0 |
| tour-link.jpg (1400x1000) | [IPad screen display stand (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:IPad_screen_display_stand_(Unsplash).jpg) | Parker Byrd parkerabyrd | CC0 |
| morning-time.jpg (2000x833) | [Arched café windows (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Arched_caf%C3%A9_windows_(Unsplash).jpg) | The Anchor anchorcoffee | CC0 |

The tour-* files sit under the aurora gradient of the POS tour stage (pos-tour-section.tsx), blended
with `luminosity` so the gradient keeps its colours.

- tour-staff-selfie.jpg (renamed from tour-staff.jpg because images are cached for a year by URL): a group selfie in a café, supplied by the owner on 2026-11-11 (replaces the Nîmes quai photo). Source and licence NOT recorded: confirm the licence before this ships to production. It shows identifiable faces, unlike the other photos here. The phone screenshot `public/images/screens/pos-clock-in.png` also carries a supplied selfie (same caveat).

The footer cross-fades closing-time.jpg (evening) and morning-time.jpg (morning), a café that never stops (footer-scene.tsx).
