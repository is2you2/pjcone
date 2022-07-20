import { TestBed } from '@angular/core/testing';

import { NamakaClientService } from './namaka-client.service';

describe('NamakaClientService', () => {
  let service: NamakaClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NamakaClientService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
