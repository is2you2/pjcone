import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { WebrtcManageIoDevPage } from './webrtc-manage-io-dev.page';

describe('WebrtcManageIoDevPage', () => {
  let component: WebrtcManageIoDevPage;
  let fixture: ComponentFixture<WebrtcManageIoDevPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WebrtcManageIoDevPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(WebrtcManageIoDevPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
