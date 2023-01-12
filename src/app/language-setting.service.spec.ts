import { TestBed } from '@angular/core/testing';

import { LanguageSettingService } from './language-setting.service';

describe('LanguageSettingService', () => {
  let service: LanguageSettingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageSettingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
