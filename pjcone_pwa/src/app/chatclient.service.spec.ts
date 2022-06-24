import { TestBed } from '@angular/core/testing';

import { ChatclientService } from './chatclient.service';

describe('ChatclientService', () => {
  let service: ChatclientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatclientService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
