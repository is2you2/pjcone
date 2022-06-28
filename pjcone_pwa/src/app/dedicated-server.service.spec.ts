import { TestBed } from '@angular/core/testing';

import { DedicatedServerService } from './dedicated-server.service';

describe('DedicatedServerService', () => {
  let service: DedicatedServerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DedicatedServerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
