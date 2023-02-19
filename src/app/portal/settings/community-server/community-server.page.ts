// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { LanguageSettingService } from 'src/app/language-setting.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { WscService } from 'src/app/wsc.service';
import * as QRCode from "qrcode-svg";
import { DomSanitizer } from '@angular/platform-browser';
import { P5ToastService } from 'src/app/p5-toast.service';


@Component({
  selector: 'app-community-server',
  templateUrl: './community-server.page.html',
  styleUrls: ['./community-server.page.scss'],
})
export class CommunityServerPage implements OnInit {

  constructor(
    public statusBar: StatusManageService,
    public wsc: WscService,
    public lang: LanguageSettingService,
    private sanitizer: DomSanitizer,
    private p5toast: P5ToastService,
  ) { }

  info = '';
  address_override = '';
  useSSL = false;
  QRCodeSRC: any;

  ngOnInit() {
    this.address_override = this.wsc.address_override;
    this.useSSL = this.wsc.socket_header == 'wss';
    new p5((p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${this.lang.lang}/community-server.txt`, v => {
          this.info = v.join('\n');
          p.remove();
        });
      }
    });
    this.readasQRCodeFromId();
  }

  readasQRCodeFromId() {
    try {
      let except_some = {
        type: 'comm_server',
        value: {
          address_override: this.address_override.replace(/[^0-9.]/g, ''),
          useSSL: this.useSSL,
        }
      };
      let qr: string = new QRCode({
        content: `[${JSON.stringify(except_some)}]`,
        padding: 4,
        width: 8,
        height: 8,
        color: "#bbb",
        background: "#111",
        ecl: "M",
      }).svg();
      this.QRCodeSRC = this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;base64,${btoa(qr)}`);
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['LinkAccount']['failed_to_gen_qr']}: ${e}`,
      });
    }
  }

  /** 연결이 끊어졌을 경우 눌러서 재접속 */
  reconn_community_server() {
    if (this.statusBar.settings['communityServer'] == 'offline')
      this.wsc.initialize();
    else this.wsc.client.close();
  }

  on_address_changed(_ev: any) {
    if (_ev.detail.value != this.wsc.address_override) {
      this.wsc.address_override = this.address_override.replace(/[^0-9.]/g, '');
      if (!this.wsc.address_override) {
        this.useSSL = false;
        this.toggle_useSSL();
      }
      localStorage.setItem('wsc_address_override', this.wsc.address_override);
      this.wsc.client.close();
    }
    this.readasQRCodeFromId();
  }

  toggle_useSSL() {
    this.useSSL = !this.useSSL;
    if (this.useSSL)
      this.wsc.socket_header = 'wss';
    else this.wsc.socket_header = 'ws';
    localStorage.setItem('wsc_socket_header', this.wsc.socket_header);
    this.wsc.client.close();
    this.readasQRCodeFromId();
  }
}
