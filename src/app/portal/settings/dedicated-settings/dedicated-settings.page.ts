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

  /** 중복 클릭 방지용 토글 */
  block = {
    chatserver: false,
  }

  /**
   * 중복 클릭 방지를 위해 버튼을 막음
   * @param _target block 내 key 값
   */
  block_button(_target: string) {
    this.block[_target] = true;
    setTimeout(() => {
      this.block[_target] = false;
    }, 2500);
  }

  /** 최소한의 기능을 가진 채팅 서버 만들기 */
  start_minimalserver() {
    this.block_button('chatserver')
    this.statusBar.settings['dedicatedServer'] = 'pending';
    this.statusBar.dedicated['groupchat'] = 'pending';
    this.server.funcs.onStart = () => {
      this.statusBar.settings['dedicatedServer'] = 'online';
      this.statusBar.dedicated['groupchat'] = 'online';
    }
    this.server.funcs.onFailed = () => {
      this.statusBar.settings['dedicatedServer'] = 'missing';
      this.statusBar.dedicated['groupchat'] = 'missing';
      setTimeout(() => {
        this.statusBar.settings['dedicatedServer'] = 'offline';
        this.statusBar.dedicated['groupchat'] = 'offline';
      }, 5000);
    }
    this.server.initialize();
  }
  /** 채팅서버 중지 */
  stop_minimalserver() {
    this.block_button('chatserver')
    this.server.stop();
  }
}
