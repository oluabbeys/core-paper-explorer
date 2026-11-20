import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { SearchStore } from './core/search.store';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('CORE Paper Explorer');
  });
});

describe('App home link', () => {
  it('returns to the start screen when the brand is clicked', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    const store = fixture.debugElement.injector.get(SearchStore);
    store.query.set('drone');
    store.filter.set('year>2020');
    store.hasSearched.set(true);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a.home')!.click();
    await fixture.whenStable();

    expect(store.hasSearched()).toBe(false);
    expect(store.query()).toBe('');
    expect(store.filter()).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector('.welcome')).toBeTruthy();
  });
});
