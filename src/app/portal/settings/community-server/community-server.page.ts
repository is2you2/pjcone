import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { ADDRESS_OVERRIDE } from 'src/app/app.component';
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
    private wsc: WscService,
  ) { }

  info = '';
  address_target: string;
  address_override: string;

  ngOnInit() {
    this.address_target = ADDRESS_OVERRIDE;
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

  on_address_changed(_ev) {
    localStorage.setItem('wsc_address_override', this.address_override);
  }
}
