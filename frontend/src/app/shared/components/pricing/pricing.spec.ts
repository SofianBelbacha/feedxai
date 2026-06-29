import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pricing } from './pricing';
import { provideRouter } from '@angular/router';

describe('Pricing', () => {
  let component: Pricing;
  let fixture: ComponentFixture<Pricing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pricing],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Pricing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
