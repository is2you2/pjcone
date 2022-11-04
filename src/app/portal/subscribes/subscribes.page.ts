import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { ModalController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ToolServerService, UnivToolForm } from 'src/app/tool-server.service';
import { WeblinkService } from 'src/app/weblink.service';
import { ChatRoomPage } from './chat-room/chat-room.page';
import { QRelsePage } from './qrelse/qrelse.page';

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
    private weblink: WeblinkService,
    public nakama: NakamaService,
  ) { }

  cant_scan = false;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_scan = true;
  }

  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  scanQRCode() {
    this.codescan.scan({
      disableSuccessBeep: true,
      disableAnimations: true,
      resultDisplayDuration: 0,
    }).then(v => {
      if (!v.cancelled) {
        try { // 양식에 맞게 끝까지 동작한다면 우리 데이터가 맞다
          let json: any[] = JSON.parse(v.text);
          for (let i = 0, j = json.length; i < j; i++)
            switch (json[i].type) {
              case 'link': // 계정 연결처리
                this.weblink.initialize({
                  pid: json[i].value,
                  uuid: this.nakama.uuid,
                });
                break;
              case 'tools': // 도구모음, 단일 대상 서버 생성 액션시
                this.create_tool_server(json[i].value);
                break;
              case 'server': // 그룹 서버 자동등록처리
                this.nakama.add_group_server(json[i].value);
                break;
              case 'group': // 서버 및 그룹 자동 등록처리
                this.nakama.try_add_group(json[i]);
                break;
              default: // 동작 미정 알림(debug)
                throw new Error("지정된 틀 아님");
            }
        } catch (_e) { // 양식에 맞춰 행동할 수 없다면 모르는 데이터다
          console.error('scanQRCode_failed: ', _e);
          this.modalCtrl.create({
            component: QRelsePage,
            componentProps: { result: v },
          }).then(v => v.present());
        }
      }
    }).catch(_e => {
      console.error(_e);
      this.p5toast.show({
        text: `카메라 권한을 얻지 못했습니다`,
        lateable: true,
      });
    });
  }

  /** 도구모음 서버 만들기 */
  create_tool_server(data: UnivToolForm) {
    let PORT: number;
    /** 메시지 받기 행동 구성 */
    let onMessage = (_json: any) => console.warn(`${data.name}_create_tool_server_onMessage: ${_json}`);
    switch (data.name) {
      case 'engineppt':
        PORT = 12021;
        onMessage = (json: any) => {
          console.log('engineppt init test: ', json);
        };
        break;
      default:
        throw new Error(`지정된 툴 정보가 아님: ${data}`);
    }
    this.tools.initialize(data.name, PORT, () => {
      this.tools.check_addresses(data.name, (v: any) => {
        let keys = Object.keys(v);
        let local_addresses = [];
        for (let i = 0, j = keys.length; i < j; i++)
          local_addresses = [...local_addresses, ...v[keys[i]]['ipv4Addresses']];
        this.weblink.initialize({
          from: 'mobile',
          pid: data.client,
          addresses: local_addresses,
        });
      });
    }, onMessage);
  }

  /** 채팅방으로 이동하기 */
  go_to_chatroom() {
    this.modalCtrl.create({
      component: ChatRoomPage,
      componentProps: {},
    }).then(v => v.present());
  }

  /** Nakama 서버 알림 읽기 */
  check_notifications(i: number) {
    console.log('해당 알림 내용: ', this.nakama.notifications[i]);
    switch (this.nakama.notifications[i].code) {
      case 0: // 예약된 알림
        break;
      case -1: // 오프라인일 때 받은 알림
        break;
      case -2: // 친구 요청 받음
        break;
      case -3: // 상대방이 친구 요청 수락
        break;
      case -4: // 상대방이 그룹 참가 수락
        break;
      case -5: // 그룹 참가 요청 받음
        break;
      case -6: // 친구가 다른 게임에 참여
        break;
      case -7: // 서버에서 단일 세션 연결 허용시 끊어진 것에 대해
        break;
      default:
        break;
    }
  }
}
