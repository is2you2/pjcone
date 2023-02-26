// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { isPlatform, SOCKET_SERVER_ADDRESS } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WscService } from 'src/app/wsc.service';
import * as p5 from "p5";
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { NakamaService } from 'src/app/nakama.service';
import { WeblinkService } from 'src/app/weblink.service';
import { QRelsePage } from '../../subscribes/qrelse/qrelse.page';

const HEADER = 'QRShare';

@Component({
  selector: 'app-qr-share',
  templateUrl: './qr-share.page.html',
  styleUrls: ['./qr-share.page.scss'],
})
export class QrSharePage implements OnInit {

  constructor(
    private wsc: WscService,
    private p5toast: P5ToastService,
    private navCtrl: NavController,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private codescan: BarcodeScanner,
    private nakama: NakamaService,
    private weblink: WeblinkService,
    private modalCtrl: ModalController,
  ) { }

  HideSender = false;
  ShowQRInfo = false;
  QRCodeSRC: any;
  websocket: WebSocket;
  lines: string;

  select_uuid = false;
  /** 등록된 그룹서버 리스트 받아오기 */
  group_servers = [];
  selected_group_server: any = [];
  /** 등록된 그룹 리스트 받아오기 */
  group_list = [];
  selected_group: any = [];
  /** 사용자가 선택한 발신 데이터 */
  selected_data = {};

  ngOnInit() {
    this.read_info();
    // 브라우저 여부에 따라 송신 설정 토글
    let isBrowser = isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA';
    this.HideSender = !isBrowser;
    if (this.HideSender) {
      // 그룹 서버 정보 가져오기
      let group_server_keys = Object.keys(this.nakama.servers['unofficial']);
      group_server_keys.forEach(gskey => this.group_servers.push(this.nakama.servers['unofficial'][gskey].info));
      // 상태가 missing 이 아닌 서버 내 그룹 정보 가져오기
      let isOfficial = Object.keys(this.nakama.groups);
      isOfficial.forEach(_is_official => {
        let Target = Object.keys(this.nakama.groups[_is_official]);
        Target.forEach(_target => {
          let GroupIds = Object.keys(this.nakama.groups[_is_official][_target]);
          GroupIds.forEach(_gid => {
            if (this.nakama.groups[_is_official][_target][_gid]['online'] != 'missing')
              this.group_list.push(this.nakama.groups[_is_official][_target][_gid]);
          });
        });
      });
    }
    // 커뮤니티 서버와 연결
    this.wsc.disconnected[HEADER] = () => {
      this.navCtrl.back();
    }
    this.websocket = new WebSocket(`${this.wsc.socket_header}://${this.wsc.address_override || SOCKET_SERVER_ADDRESS}:12020`);
    this.websocket.onmessage = (msg: any) => {
      msg.data.text().then(v => {
        try {
          if (!this.QRCodeSRC) throw new Error("QR코드 생성 우선처리");
          let json = JSON.parse(v);
          this.nakama.act_from_QRInfo(json['value']);
          setTimeout(() => {
            this.navCtrl.back();
          }, 500);
        } catch (_e) {
          this.QRCodeSRC = this.global.readasQRCodeFromId({
            type: 'QRShare',
            value: v,
          });
        }
      });
    }
  }

  read_info() {
    let show = (p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${this.lang.lang}/quick_datashare.txt`, v => {
          this.lines = v.join('\n');
          p.remove();
        }, e => {
          console.error('빠른 QR 정보 공유 설명서 파일 불러오기 실패: ', e);
          p.remove();
        });
      }
    }
    new p5(show);
  }

  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  scanQRCode() {
    this.codescan.scan({
      disableSuccessBeep: true,
      disableAnimations: true,
      resultDisplayDuration: 0,
    }).then(v => {
      if (!v.cancelled) {
        let json = JSON.parse(v.text.trim())[0];
        switch (json['type']) {
          case 'QRShare': // 빠른 QR공유
            /** 선택된 모든 정보를 json[]로 구성 */
            let sendData = [];
            if (this.selected_data['uuid'])
              sendData.push({
                type: 'link_reverse',
                value: this.selected_data['uuid'],
              });
            if (this.selected_data['group_server'])
              for (let i = 0, j = this.selected_data['group_server'].length; i < j; i++)
                sendData.push({
                  type: 'server',
                  value: {
                    address: this.selected_data['group_server'][i].address,
                    port: this.selected_data['group_server'][i].port,
                    key: this.selected_data['group_server'][i].key,
                    useSSL: this.selected_data['group_server'][i].useSSL,
                  }
                });
            if (this.selected_data['group'])
              for (let i = 0, j = this.selected_data['group'].length; i < j; i++)
                sendData.push({
                  type: 'group',
                  id: this.selected_data['group'][i].id,
                  name: this.selected_data['group'][i].name,
                });
            this.weblink.initialize({
              pid: json['value'],
              value: JSON.stringify(sendData),
            });
            break;
          default: // 빠른 QR공유용 구성이 아닐 때
            this.modalCtrl.create({
              component: QRelsePage,
              componentProps: { result: v },
            }).then(v => v.present());
            break;
        }
        setTimeout(() => {
          this.navCtrl.back();
        }, 500);
      }
    }).catch(_e => {
      console.error(_e);
      this.p5toast.show({
        text: this.lang.text['Subscribes']['CameraPermissionDenied'],
      });
    });
  }

  ToggleShareUUID() {
    this.select_uuid = !this.select_uuid;
    if (this.select_uuid)
      this.selected_data['uuid'] = this.nakama.uuid;
    else delete this.selected_data['uuid'];
  }

  /** 발신 예정인 그룹 서버 정보 */
  SelectGroupServer(_ev: any) {
    if (this.selected_group_server.length && typeof this.selected_group_server != 'string') {
      this.selected_data['group_server'] = this.selected_group_server;
      // 다른 정보들을 검토하여 동시 공유 방지
      let keys = Object.keys(this.selected_data);
      // 키값 삭제
      let isKeyRemoved = false;
      keys.forEach(key => {
        if (key != 'group_server' && key != 'uuid')
          isKeyRemoved = true;
      });
      if (isKeyRemoved) {
        // UI 상에서 전부 제거처리
        this.selected_group = this.lang.text['QuickQRShare']['EmptyData'];
        this.p5toast.show({
          text: this.lang.text['QuickQRShare']['groupserver_dataonly'],
        });
      }
    } else delete this.selected_data['group_server'];
  }

  /** 발신 예정인 그룹 정보 */
  SelectGroup(_ev: any) {
    if (this.selected_group.length && typeof this.selected_group != 'string') {
      this.selected_data['group'] = this.selected_group;
      this.remove_groupserver_info();
    } else delete this.selected_data['group'];
  }

  /** 다른 정보를 수정할 때 그룹 서버 정보를 삭제 */
  remove_groupserver_info() {
    this.selected_group_server = this.lang.text['QuickQRShare']['EmptyData'];
    if (this.selected_data['group_server']) {
      this.p5toast.show({
        text: this.lang.text['QuickQRShare']['groupserver_dataonly'],
      });
      delete this.selected_data['group_server'];
    }
  }

  ionViewWillLeave() {
    delete this.wsc.disconnected[HEADER];
    this.websocket.close();
  }
}
