import { TestBed } from '@angular/core/testing';

import { DedicatedChatserverService } from './dedicated-chatserver.service';

describe('DedicatedChatserverService', () => {
  let service: DedicatedChatserverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DedicatedChatserverService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
