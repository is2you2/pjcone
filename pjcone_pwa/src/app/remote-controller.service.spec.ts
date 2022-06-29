import { TestBed } from '@angular/core/testing';

import { RemoteControllerService } from './remote-controller.service';

describe('RemoteControllerService', () => {
  let service: RemoteControllerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RemoteControllerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
