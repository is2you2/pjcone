import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { ModalController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ChatRoomPage } from './chat-room/chat-room.page';
import { ProjinfoPage } from './projinfo/projinfo.page';
import { QRelsePage } from './qrelse/qrelse.page';
import { TaskInfoPage } from './task-info/task-info.page';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
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
    }).then(v => {
      if (!v.cancelled) {
        try { // 양식에 맞게 끝까지 동작한다면 우리 데이터가 맞다
          let form = JSON.parse(v.text);
          console.log(form);
          this.p5toast.show({
            text: `스캔 성공 동작 없음: ${v.text}`,
          });
        } catch (_e) { // 양식에 맞춰 행동할 수 없다면 모르는 데이터다
          this.modalCtrl.create({
            component: QRelsePage,
            componentProps: { result: v },
          }).then(v => v.present());
        }
      }
    }).catch(e => {
      this.p5toast.show({
        text: `카메라 권한을 얻지 못했습니다`,
        lateable: true,
      });
    });
  }

  /** 채팅방으로 이동하기 */
  go_to_chatroom() {
    this.modalCtrl.create({
      component: ChatRoomPage,
      componentProps: {},
    }).then(v => v.present());
  }

  go_to_projinfo() {
    this.modalCtrl.create({
      component: ProjinfoPage,
      componentProps: {},
    }).then(v => v.present());
  }

  go_to_taskinfo() {
    this.modalCtrl.create({
      component: TaskInfoPage,
      componentProps: {},
    }).then(v => v.present());
  }
}
