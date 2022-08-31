import { TestBed } from '@angular/core/testing';

import { StatusManageService } from './status-manage.service';

describe('StatusManageService', () => {
  let service: StatusManageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StatusManageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
