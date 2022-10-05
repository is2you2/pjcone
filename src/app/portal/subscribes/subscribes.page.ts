import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { ModalController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ToolServerService, UnivToolForm } from 'src/app/tool-server.service';
import { ChatRoomPage } from './chat-room/chat-room.page';
import { ProjinfoPage } from './projinfo/projinfo.page';
import { QRelsePage } from './qrelse/qrelse.page';
import { TaskInfoPage } from './task-info/task-info.page';

/** 만능 인터페이스 폼 */
interface UniversalCode {
  /** 행동의 종류, 대분류 */
  type?: string;
  /** 행동 데이터(json) */
  value?: any;
}

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
    private tools: ToolServerService,
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
          let json: UniversalCode = JSON.parse(v.text);
          switch (json.type) {
            case 'tools': // 도구모음, 단일 대상 서버 생성 액션시
              this.create_tool_server(json.value);
              break;
            default: // 동작 미정 알림(debug)
              throw new Error("지정된 틀 아님");
          }
        } catch (_e) { // 양식에 맞춰 행동할 수 없다면 모르는 데이터다
          this.modalCtrl.create({
            component: QRelsePage,
            componentProps: { result: v },
          }).then(v => v.present());
        }
      }
    }).catch(_e => {
      this.p5toast.show({
        text: `카메라 권한을 얻지 못했습니다`,
        lateable: true,
      });
    });
  }

  /** 도구모음 서버 만들기 */
  create_tool_server(data: UnivToolForm) {
    switch (data.name) {
      case 'engineppt':
        this.tools.initialize(data.name, 12020, (json: any) => {
          console.log('engineppt init test: ', json);
        });
        break;
      default:
        throw new Error(`지정된 툴 정보가 아님: ${data}`);
    }
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
