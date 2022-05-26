import { TestBed } from '@angular/core/testing';

import { P5ToastService } from './p5-toast.service';

describe('P5ToastService', () => {
  let service: P5ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(P5ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
