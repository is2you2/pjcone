import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { ModalController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ChatRoomPage } from './chat-room/chat-room.page';
import { ProjinfoPage } from './projinfo/projinfo.page';
import { TaskInfoPage } from './task-info/task-info.page';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    private modal: ModalController,
    private codescan: BarcodeScanner,
    private p5toast: P5ToastService,
  ) { }

  cant_scan = false;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_scan = true;
  }

  scanQRCode() {
    this.codescan.scan({
      disableSuccessBeep: true,
      disableAnimations: true,
      resultDisplayDuration: 0,
      showTorchButton: true,
      showFlipCameraButton: true,
    }).then(v => {
      this.p5toast.show({
        text: `스캔 성공 동작 없음: ${v}`,
      });
    }).catch(e => {
      this.p5toast.show({
        text: `스캔 실패: ${e}`,
        lateable: true,
      });
    });
  }

  /** 채팅방으로 이동하기 */
  go_to_chatroom() {
    this.modal.create({
      component: ChatRoomPage,
      componentProps: {},
    }).then(v => v.present());
  }

  go_to_projinfo() {
    this.modal.create({
      component: ProjinfoPage,
      componentProps: {},
    }).then(v => v.present());
  }

  go_to_taskinfo() {
    this.modal.create({
      component: TaskInfoPage,
      componentProps: {},
    }).then(v => v.present());
  }
}
