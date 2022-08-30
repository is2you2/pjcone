import { TestBed } from '@angular/core/testing';

import { GlobalActService } from './global-act.service';

describe('GlobalActService', () => {
  let service: GlobalActService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GlobalActService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
