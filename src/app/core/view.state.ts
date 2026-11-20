import { Injectable, signal } from '@angular/core';

export type AppView = 'search' | 'compare';

/** Which main view is showing (search results or topic comparison). */
@Injectable({ providedIn: 'root' })
export class ViewState {
  readonly view = signal<AppView>('search');
}
