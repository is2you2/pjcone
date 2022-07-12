import { TestBed } from '@angular/core/testing';

import { MiniranchatClientService } from './miniranchat-client.service';

describe('MiniranchatClientService', () => {
  let service: MiniranchatClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MiniranchatClientService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
