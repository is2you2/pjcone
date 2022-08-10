import { TestBed } from '@angular/core/testing';

import { LocalGroupServerService } from './local-group-server.service';

describe('LocalGroupServerService', () => {
  let service: LocalGroupServerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocalGroupServerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
