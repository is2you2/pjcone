import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InstantCallPage } from './instant-call.page';

describe('InstantCallPage', () => {
  let component: InstantCallPage;
  let fixture: ComponentFixture<InstantCallPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(InstantCallPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
