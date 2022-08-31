import { Component, OnInit } from '@angular/core';
import { LocalGroupServerService } from 'src/app/local-group-server.service';
import { StatusManageService } from 'src/app/status-manage.service';

@Component({
  selector: 'app-dedicated-settings',
  templateUrl: './dedicated-settings.page.html',
  styleUrls: ['./dedicated-settings.page.scss'],
})
export class DedicatedSettingsPage implements OnInit {

  constructor(
    private server: LocalGroupServerService,
    public statusBar: StatusManageService,
  ) { }

  ngOnInit() { }

  /** 서버 사용 가능 여부에 따라 버튼 조정 */
  /** 최소한의 기능을 가진 채팅 서버 만들기 */
  start_minimalserver() {
    this.statusBar.settings['dedicatedServer'] = 'pending';
    this.statusBar.dedicated['groupchat'] = 'pending';
    this.server.funcs.onStart = () => {
      this.statusBar.settings['dedicatedServer'] = 'online';
      this.statusBar.dedicated['groupchat'] = 'online';
      console.log(this.statusBar.colors[this.statusBar.dedicated['groupchat']]);
    }
    this.server.funcs.onFailed = () => {
      this.statusBar.settings['dedicatedServer'] = 'missing';
      this.statusBar.dedicated['groupchat'] = 'missing';
      console.log(this.statusBar.colors[this.statusBar.dedicated['groupchat']]);
      setTimeout(() => {
        this.statusBar.settings['dedicatedServer'] = 'offline';
        this.statusBar.dedicated['groupchat'] = 'offline';
        console.log(this.statusBar.colors[this.statusBar.dedicated['groupchat']]);
      }, 5000);
    }
    this.server.initialize();
  }

}
