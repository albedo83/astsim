import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Viewport } from './viewport';

describe('Viewport', () => {
  let component: Viewport;
  let fixture: ComponentFixture<Viewport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Viewport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Viewport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
