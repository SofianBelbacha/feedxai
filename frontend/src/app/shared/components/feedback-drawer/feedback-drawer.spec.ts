import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedbackDrawer } from './feedback-drawer';

describe('FeedbackDrawer', () => {
  let component: FeedbackDrawer;
  let fixture: ComponentFixture<FeedbackDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedbackDrawer],
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackDrawer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
