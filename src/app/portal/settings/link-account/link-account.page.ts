// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { NavController } from '@ionic/angular';
import { SOCKET_SERVER_ADDRESS } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WscService } from 'src/app/wsc.service';

const HEADER = 'LinkAccount';

@Component({
  selector: 'app-link-account',
  templateUrl: './link-account.page.html',
  styleUrls: ['./link-account.page.scss'],
})
export class LinkAccountPage implements OnInit {

  constructor(
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private navCtrl: NavController,
    private wsc: WscService,
    private indexed: IndexedDBService,
    private device: Device,
    public lang: LanguageSettingService,
    private global: GlobalActService
  ) { }

  /** 기기 아이디가 이미 덮어씌워진 상태인지 */
  isOverrided: boolean;

  ngOnInit() {
    this.wsc.disconnected[HEADER] = () => {
      this.navCtrl.back();
    }
    this.indexed.checkIfFileExist('link-account', b => {
      this.isOverrided = b;
    });
    this.websocket = new WebSocket(`${this.wsc.socket_header}://${this.wsc.address_override || SOCKET_SERVER_ADDRESS}:12020`);
    this.websocket.onmessage = (msg: any) => {
      msg.data.text().then(v => {
        try {
          let json = JSON.parse(v);
          if (!json.uuid) throw new Error("uuid 받기 실패");
          this.nakama.uuid = json.uuid;
          this.indexed.saveTextFileToUserPath(this.nakama.uuid, 'link-account');
          this.p5toast.show({
            text: this.lang.text['LinkAccount']['link_account_succ'],
            lateable: true,
          });
          this.nakama.logout_all_server();
          this.nakama.users.self['online'] = true;
          this.nakama.init_all_sessions();
          setTimeout(() => {
            this.navCtrl.back();
          }, 500);
        } catch (_e) {
          this.QRCodeSRC = this.global.readasQRCodeFromId({
            type: 'link',
            value: v,
          });
        }
      });
    }
  }

  QRCodeSRC: any;
  websocket: any;

  /** 기기 아이디 원복처리 */
  removeOverrideDeviceId() {
    this.isOverrided = false;
    this.nakama.uuid = this.device.uuid;
    this.indexed.removeFileFromUserPath('link-account');
    this.nakama.logout_all_server();
  }

  ionViewWillLeave() {
    delete this.wsc.disconnected[HEADER];
    this.websocket.close();
  }
}
