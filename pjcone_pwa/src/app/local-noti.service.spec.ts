import { TestBed } from '@angular/core/testing';

import { LocalNotiService } from './local-noti.service';

describe('LocalNotiService', () => {
  let service: LocalNotiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocalNotiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
