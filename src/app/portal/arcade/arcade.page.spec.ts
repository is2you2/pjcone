import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArcadePage } from './arcade.page';

describe('ArcadePage', () => {
  let component: ArcadePage;
  let fixture: ComponentFixture<ArcadePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ArcadePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
