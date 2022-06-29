import { TestBed } from '@angular/core/testing';

import { RelayServerService } from './relay-server.service';

describe('RelayServerService', () => {
  let service: RelayServerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RelayServerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
