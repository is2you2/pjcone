import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { StatusManageService } from 'src/app/status-manage.service';
import { WscService } from 'src/app/wsc.service';


@Component({
  selector: 'app-community-server',
  templateUrl: './community-server.page.html',
  styleUrls: ['./community-server.page.scss'],
})
export class CommunityServerPage implements OnInit {

  constructor(
    public statusBar: StatusManageService,
    public wsc: WscService,
  ) { }

  info = '';
  address_override = '';
  useSSL = false;

  ngOnInit() {
    this.address_override = this.wsc.address_override;
    this.useSSL = this.wsc.socket_header == 'wss';
    new p5((p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${'ko'}/community-server.txt`, v => {
          this.info = v.join('\n');
          p.remove();
        });
      }
    });
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
  }

  toggle_useSSL() {
    this.useSSL = !this.useSSL;
    if (this.useSSL)
      this.wsc.socket_header = 'wss';
    else this.wsc.socket_header = 'ws';
    localStorage.setItem('wsc_socket_header', this.wsc.socket_header);
    this.wsc.client.close();
  }
}
