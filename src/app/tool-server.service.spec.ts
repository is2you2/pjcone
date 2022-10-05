import { TestBed } from '@angular/core/testing';

import { ToolServerService } from './tool-server.service';

describe('ToolServerService', () => {
  let service: ToolServerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToolServerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
