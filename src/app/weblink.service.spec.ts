import { TestBed } from '@angular/core/testing';

import { WeblinkService } from './weblink.service';

describe('WeblinkService', () => {
  let service: WeblinkService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WeblinkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
