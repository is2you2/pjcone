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
    private wsc: WscService,
  ) { }

  info = '';

  ngOnInit() {
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
}
