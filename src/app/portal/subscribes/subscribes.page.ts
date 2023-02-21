// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { ModalController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MinimalChatPage } from 'src/app/minimal-chat/minimal-chat.page';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { ToolServerService, UnivToolForm } from 'src/app/tool-server.service';
import { WeblinkService } from 'src/app/weblink.service';
import { WscService } from 'src/app/wsc.service';
import { ServerDetailPage } from '../settings/group-server/server-detail/server-detail.page';
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
    public statusBar: StatusManageService,
    private wsc: WscService,
    public lang: LanguageSettingService,
  ) { }

  cant_scan = false;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_scan = true;
  }

  ionViewDidEnter() {
    this.nakama.subscribe_lock = true;
    this.nakama.resumeBanner();
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
          let json: any[] = JSON.parse(v.text.trim());
          for (let i = 0, j = json.length; i < j; i++)
            switch (json[i].type) {
              case 'link': // 계정 연결처리
                if (!this.check_comm_server_is_online())
                  return
                this.weblink.initialize({
                  pid: json[i].value,
                  uuid: this.nakama.uuid,
                });
                break;
              case 'tools': // 도구모음, 단일 대상 서버 생성 액션시
                if (!this.check_comm_server_is_online())
                  return
                this.create_tool_server(json[i].value);
                break;
              case 'server': // 그룹 서버 자동등록처리
                this.modalCtrl.create({
                  component: ServerDetailPage,
                  componentProps: {
                    data: json[i].value,
                  },
                }).then(v => v.present());
                return;
              case 'comm_server':
                this.wsc.client.close();
                if (json[i].value.useSSL)
                  this.wsc.socket_header = 'wss';
                else this.wsc.socket_header = 'ws';
                localStorage.setItem('wsc_socket_header', this.wsc.socket_header);
                this.wsc.address_override = json[i].value.address_override.replace(/[^0-9.]/g, '');
                localStorage.setItem('wsc_address_override', this.wsc.address_override);
                this.wsc.initialize();
                break;
              case 'group_dedi': // 그룹사설 채팅 접근
                this.modalCtrl.create({
                  component: MinimalChatPage,
                  componentProps: {
                    address: json[i].value.address,
                    name: this.nakama.users.self['display_name'],
                  },
                }).then(v => {
                  v.present();
                });
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
        text: this.lang.text['Subscribes']['CameraPermissionDenied'],
        lateable: true,
      });
    });
  }

  /** 커뮤니티 서버 온라인 여부 확인 */
  check_comm_server_is_online(): boolean {
    let result = this.wsc.client.readyState == this.wsc.client.OPEN;
    if (!result) {
      this.p5toast.show({
        text: this.lang.text['Subscribes']['needLinkWithCommServ'],
      });
    }
    return result;
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

  lock_chatroom = false;
  /** 채팅방으로 이동하기 */
  go_to_chatroom(info: any) {
    if (!this.lock_chatroom) {
      this.lock_chatroom = true;
      this.modalCtrl.create({
        component: ChatRoomPage,
        componentProps: {
          info: info,
        },
      }).then(v => {
        this.nakama.go_to_chatroom_without_admob_act(v);
        this.lock_chatroom = false;
      });
    }
  }

  /** Nakama 서버 알림 읽기 */
  check_notifications(i: number) {
    let server_info = this.nakama.notifications_rearrange[i]['server'];
    let _is_official = server_info['isOfficial'];
    let _target = server_info['target'];
    this.nakama.check_notifications(this.nakama.notifications_rearrange[i], _is_official, _target);
  }

  ionViewWillLeave() {
    this.nakama.subscribe_lock = false;
  }
}
