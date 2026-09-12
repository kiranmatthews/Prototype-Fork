// Competition and Options use the same guide and gameplay trick catalogue.
import { DECK_TRICKS, GRAB_TRICKS, GRIND_TRICKS } from './skateTricks';
import { SPECIAL_TRICKS } from './specialTricks';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const TRICK_GUIDE_INTRO = 'Tap a face button with a direction. Short direction taps choose a trick; holding left or right also rotates the rider. Release grabs and catch flips before landing.';
export const TRICK_GUIDE_PAGE_COUNT = 4;
export function trickGuidePages(): string[] {
  const table=(rows:readonly {direction:string;label:string;points:number}[])=>`<table><thead><tr><th>DIRECTION</th><th>TRICK</th><th>BASE</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.direction)}</td><td>${esc(row.label)}</td><td>${row.points.toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
  return [
    `<article><h3 class="secondary-silver" data-guide-prompt="{spin} FLIPS"></h3>${table(DECK_TRICKS.map(trick=>({direction:trick.recipe.split(' + □')[0],label:trick.label,points:trick.points})))}</article>`,
    `<article><h3 class="secondary-silver" data-guide-prompt="{grab} GRABS"></h3>${table(GRAB_TRICKS)}<p>Hold for more points. The entry direction fixes the grab while you rotate.</p></article>`,
    `<article><h3 class="secondary-silver" data-guide-prompt="{grind} GRINDS"></h3>${table(Object.values(GRIND_TRICKS))}<p>Press again with a direction to change grind. Moving along the rail earns hold points.</p></article>`,
    `<article><h3>SPECIAL</h3><table><tbody>${SPECIAL_TRICKS.map(trick=>`<tr><td data-guide-prompt="${trick.directions.map(direction=>`{${direction}}`).join(' ')} {${trick.category==='flip'?'spin':trick.category}}"></td><td>${esc(trick.label)}</td><td>${trick.points.toLocaleString()}</td></tr>`).join('')}</tbody></table><p>Fill the avatar's SPECIAL ring with tricks. Enter the two directions in order, then the face button.</p><h3>KEEP IT FRESH</h3><p>Repeated tricks pay 100%, 75%, 50%, 25%, then 10%. Landed combos share this history until the next run; bailed attempts don't add to it. Hold points use the same penalty and grow more slowly after two seconds.</p><p>Link airs with grinds, manuals (up–down / down–up), and a revert on vert touchdown.</p></article>`,
  ];
}
