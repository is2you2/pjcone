import { TestBed } from '@angular/core/testing';

import { NakamaclientService } from './nakamaclient.service';

describe('NakamaclientService', () => {
  let service: NakamaclientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NakamaclientService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
