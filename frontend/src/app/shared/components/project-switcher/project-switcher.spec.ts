import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectSwitcher } from './project-switcher';

describe('ProjectSwitcher', () => {
  let component: ProjectSwitcher;
  let fixture: ComponentFixture<ProjectSwitcher>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSwitcher],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectSwitcher);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
