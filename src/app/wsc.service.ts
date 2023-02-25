// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { SOCKET_SERVER_ADDRESS } from './app.component';
import { LanguageSettingService } from './language-setting.service';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';

/** 앱 시작과 동시에 서버에 연결을 시도하여 실시간 상호작용하는 메인 클라이언트 */
@Injectable({
  providedIn: 'root'
})
export class WscService {

  constructor(
    private statusBar: StatusManageService,
    private p5toast: P5ToastService,
    private bgmode: BackgroundMode,
    private lang: LanguageSettingService,
  ) { }
  /** 관리자 여부를 확인하여 관리자 메뉴 토글에 사용 */
  is_admin = false;
  client: WebSocket;
  /** 받았을 때 취할 행동
   * 1개 변수에서 메시지를 받아야 함
   * ```javascript
   * received(msg: string);
   * ```
   */
  received: { [id: string]: Function } = {};
  /** 서버로부터 연결이 끊어졌을 때 취하게 될 행동들 */
  disconnected: { [id: string]: Function } = {};

  socket_header = 'wss';
  address_override = '';

  /**
   * 서버와 반드시 연결시도하는 메인 소켓 클라이언트  
   * 다른 서버, 클라이언트를 생성하는 등의 다양한 역할을 수행할 수 있다.
   */
  initialize() {
    this.address_override = (localStorage.getItem('wsc_address_override') || '').replace(/[^0-9.]/g, '');
    this.socket_header = localStorage.getItem('wsc_socket_header') || 'wss';
    this.statusBar.settings['communityServer'] = 'pending';
    this.lang.Callback_WscClient = () => this.set_bgmode_text();
    const PORT: number = 12000;
    this.client = new WebSocket(`${this.socket_header}://${this.address_override || SOCKET_SERVER_ADDRESS}:${PORT}`);
    this.client.onopen = (_ev) => {
      this.statusBar.settings['communityServer'] = 'online';
      this.set_bgmode_text();
    }
    this.client.onclose = (_ev) => {
      let keys = Object.keys(this.disconnected);
      keys.forEach(key => this.disconnected[key]());
      this.statusBar.settings['communityServer'] = 'missing';
      setTimeout(() => {
        if (this.statusBar.settings['communityServer'] == 'missing')
          this.statusBar.settings['communityServer'] = 'offline';
      }, 1500);
      this.p5toast.show({
        text: this.lang.text['WscClient']['Disconnected'],
        lateable: true,
      });
      this.set_bgmode_text();
      this.is_admin = false;
    }
    this.client.onerror = (e) => {
      console.error('메인소켓 오류 발생: ', e);
    }
    this.client.onmessage = (ev) => {
      ev.data.text().then(v => {
        let json = JSON.parse(v);
        this.received[json['act']](json);
      });
    }
  }

  /** 백그라운드 알림 문구 번역처리 */
  set_bgmode_text() {
    let is_online = this.client && this.client.readyState == this.client.OPEN;
    let info: any;
    if (is_online)
      info = {
        title: this.lang.text['WscClient']['OnlineMode'],
        text: this.lang.text['WscClient']['OnlineMode_text'],
        icon: 'icon_mono',
        color: 'ffd94e', // 모자 밑단 노란색
      };
    else info = {
      title: this.lang.text['WscClient']['OfflineMode'],
      text: this.lang.text['WscClient']['OfflineMode_text'],
      icon: 'icon_mono',
      color: 'ffd94e', // 모자 밑단 노란색
    };
    this.bgmode.setDefaults(info);
    this.bgmode.configure(info);
  }

  send(msg: string) {
    if (this.client && this.client.readyState == this.client.OPEN)
      this.client.send(msg);
    else console.warn('메시지 발송 실패: ', msg);
  }
}
