import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinkQrPage } from './link-qr.page';

describe('LinkQrPage', () => {
  let component: LinkQrPage;
  let fixture: ComponentFixture<LinkQrPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(LinkQrPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
