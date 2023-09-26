// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';

@Component({
  selector: 'app-qr-share',
  templateUrl: './qr-share.page.html',
  styleUrls: ['./qr-share.page.scss'],
})
export class QrSharePage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private nakama: NakamaService,
    public modalCtrl: ModalController,
    private navParams: NavParams,
    private indexed: IndexedDBService,
  ) { }

  QRCodeSRC: any;
  lines: string;
  /** 전송 예정인 키의 갯수 */
  ActKeyLength = false;

  userInput = {
    servers: [] as ServerInfo[],
    groups: [],
    rtcserver: [],
  }
  servers: ServerInfo[] = [];
  groups = [];
  rtcServer = [];
  /** 설정에서 들어온 경우 데이터 돌려줄 필요 없음을 구분하기 위해 */
  NoReturn = false;

  ngOnInit() {
    // 브라우저 여부에 따라 송신 설정 토글
    this.NoReturn = this.navParams.get('NoReturn');
    this.servers = this.nakama.get_all_server_info();
    this.groups = this.nakama.rearrange_group_list();
    this.indexed.loadTextFromUserPath('servers/webrtc_server.json', (e, v) => {
      if (e && v) this.rtcServer = JSON.parse(v);
    });
    for (let i = this.groups.length - 1; i >= 0; i--)
      if (this.groups[i]['status'] == 'missing')
        this.groups.splice(i, 1);
  }

  SelectGroupServer(ev: any) {
    this.userInput.servers = ev.detail.value;
    this.information_changed();
  }

  SelectGroupChannel(ev: any) {
    this.userInput.groups = ev.detail.value;
    this.information_changed();
  }

  SelectRTCServer(ev: any) {
    this.userInput.rtcserver = ev.detail.value;
    this.information_changed();
  }

  result_address: string;
  information_changed() {
    this.result_address = `${SERVER_PATH_ROOT}pjcone_pwa/`;
    let exactly_added = '';
    let count = 0;
    for (let i = 0, j = this.userInput.servers.length; i < j; i++) {
      exactly_added += count ? '&' : '?';
      exactly_added += 'server=';
      exactly_added += `${this.userInput.servers[i].name || ''},${this.userInput.servers[i].address || ''},${this.userInput.servers[i].useSSL || ''},${this.userInput.servers[i].port || 7350},${this.userInput.servers[i].key || ''}`;
      count++;
    }
    for (let i = 0, j = this.userInput.groups.length; i < j; i++) {
      exactly_added += count ? '&' : '?';
      exactly_added += 'group=';
      exactly_added += `${this.userInput.groups[i]['name']},${this.userInput.groups[i]['id']}`;
      count++;
    }
    if (this.userInput.rtcserver.length) {
      for (let i = 0, j = this.userInput.rtcserver.length; i < j; i++) {
        exactly_added += count ? '&' : '?';
        exactly_added += 'rtcserver=';
        exactly_added += `[${this.userInput.rtcserver[i].urls}],${this.userInput.rtcserver[i].username},${this.userInput.rtcserver[i].credential}`;
        count++;
      }
    }
    if (exactly_added) {
      this.result_address += exactly_added;
      this.QRCodeSRC = this.global.readasQRCodeFromString(this.result_address);
      this.ActKeyLength = true;
    } else {
      this.QRCodeSRC = '';
      this.ActKeyLength = false;
    }
  }

  scanQRCode() {
    this.modalCtrl.dismiss(this.result_address);
  }
}
