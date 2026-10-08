/** Bookmarkable, explicit authoring destinations. Unknown requests keep normal startup. */
export const TOOL_ROUTES = [
  'characterlab', 'animationstudio', 'waterstudio', 'puffstudio', 'swirlstudio', 'fieldstudio',
  'tuning', 'menu', 'editor', 'crt', 'render', 'board', 'spin', 'look', 'text',
  'options', 'save-load', 'level-select',
] as const;
export type ToolRoute = typeof TOOL_ROUTES[number];
export function requestedTool(search: string, hash: string): ToolRoute | null {
  const query = new URLSearchParams(search).get('tool')?.toLowerCase();
  if (TOOL_ROUTES.some(route => route === query)) return query as ToolRoute;
  // Retain the established studio bookmarks and give them the same startup handling.
  return TOOL_ROUTES.slice(0, 6).find(route => hash.toLowerCase() === `#${route}`) ?? null;
}
export function toolSectionId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
