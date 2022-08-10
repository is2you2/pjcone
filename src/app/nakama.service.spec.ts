import { TestBed } from '@angular/core/testing';

import { NakamaService } from './nakama.service';

describe('NakamaService', () => {
  let service: NakamaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NakamaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
