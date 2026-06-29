import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Feedbacks } from './feedbacks';
import { provideRouter } from '@angular/router';

describe('Feedbacks', () => {
  let component: Feedbacks;
  let fixture: ComponentFixture<Feedbacks>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Feedbacks],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Feedbacks);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
