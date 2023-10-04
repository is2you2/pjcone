import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TtsExportPage } from './tts-export.page';

describe('TtsExportPage', () => {
  let component: TtsExportPage;
  let fixture: ComponentFixture<TtsExportPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(TtsExportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
