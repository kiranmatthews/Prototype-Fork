import { setPromptText } from './inputPromptUI';
import { trickGuidePages } from './skateTrickGuide';

interface GuidePage {
  article: HTMLElement;
  entries: number[];
}

/** Fit whole rows/paragraphs to the actual TV-safe region, at the authored type size. */
export class TrickGuidePagination {
  private pages: GuidePage[] = [];
  private page = 0;
  private observer: ResizeObserver;
  private pending = 0;

  constructor(
    private content: HTMLElement,
    private counter: HTMLElement,
    private changed: (page: number) => void,
    initialPage = 0,
  ) {
    this.page = initialPage;
    this.counter.setAttribute('aria-live', 'polite');
    this.counter.setAttribute('aria-atomic', 'true');
    this.observer = new ResizeObserver(this.schedule);
    this.observer.observe(content);
    window.addEventListener('input-prompts-changed', this.schedule);
    document.fonts.addEventListener('loadingdone', this.schedule);
    this.layout();
  }

  destroy(): void {
    this.observer.disconnect();
    window.removeEventListener('input-prompts-changed', this.schedule);
    document.fonts.removeEventListener('loadingdone', this.schedule);
    cancelAnimationFrame(this.pending);
  }

  change(delta: number): void {
    if (!this.pages.length) return;
    this.page = (this.page + delta + this.pages.length) % this.pages.length;
    this.show();
  }

  private schedule = (): void => {
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => this.layout());
  };

  private layout(): void {
    if (!this.content.isConnected || !this.content.clientHeight) return;
    const anchor = this.pages[this.page]?.entries[0];
    const source = document.createElement('div');
    source.innerHTML = trickGuidePages().join('');
    for (const prompt of source.querySelectorAll<HTMLElement>('[data-guide-prompt]')) {
      setPromptText(prompt, prompt.dataset.guidePrompt!);
    }
    const pages: GuidePage[] = [];
    const style = getComputedStyle(this.content);
    const bottom = this.content.getBoundingClientRect().bottom - parseFloat(style.paddingBottom);
    let entry = 0;
    for (const chapter of source.children) {
      const heading = chapter.querySelector('h3')!;
      const start = (): GuidePage => {
        const article = document.createElement('article');
        article.append(heading.cloneNode(true));
        this.content.replaceChildren(article);
        const page = { article, entries: [] as number[] };
        pages.push(page);
        return page;
      };
      let page = start();
      for (const block of chapter.children) {
        if (block === heading) continue;
        const table = block.tagName === 'TABLE' ? block as HTMLTableElement : null;
        const units = table ? [...table.tBodies[0].rows] : [block];
        for (const unit of units) {
          const append = (): HTMLElement => {
            const copy = unit.cloneNode(true) as HTMLElement;
            copy.dataset.guideEntry = String(entry);
            if (table) {
              let target = page.article.querySelector('table');
              if (!target) {
                target = table.cloneNode(true) as HTMLTableElement;
                target.tBodies[0].replaceChildren();
                page.article.append(target);
              }
              target.tBodies[0].append(copy);
            } else page.article.append(copy);
            return copy;
          };
          let copy = append();
          if (page.entries.length && page.article.getBoundingClientRect().bottom > bottom - 1) {
            copy.remove();
            const emptyTable = page.article.querySelector('table');
            if (emptyTable && !emptyTable.tBodies[0].rows.length) emptyTable.remove();
            page = start();
            copy = append();
          }
          page.entries.push(entry++);
        }
      }
    }
    this.pages = pages;
    const anchoredPage = anchor === undefined ? -1 : pages.findIndex(page => page.entries.includes(anchor));
    this.page = anchoredPage >= 0 ? anchoredPage : Math.min(this.page, pages.length - 1);
    this.show();
  }

  private show(): void {
    this.content.replaceChildren(this.pages[this.page].article);
    this.content.scrollTop = 0;
    this.counter.textContent = `${this.page + 1} / ${this.pages.length}`;
    this.changed(this.page);
  }
}
