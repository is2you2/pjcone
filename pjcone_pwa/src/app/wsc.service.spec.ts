import { TestBed } from '@angular/core/testing';

import { WscService } from './wsc.service';

describe('WscService', () => {
  let service: WscService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WscService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
