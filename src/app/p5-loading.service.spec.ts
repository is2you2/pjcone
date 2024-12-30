import { TestBed } from '@angular/core/testing';

import { P5LoadingService } from './p5-loading.service';

describe('P5LoadingService', () => {
  let service: P5LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(P5LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
