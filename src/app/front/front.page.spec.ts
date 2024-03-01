import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FrontPage } from './front.page';

describe('FrontPage', () => {
  let component: FrontPage;
  let fixture: ComponentFixture<FrontPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(FrontPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
