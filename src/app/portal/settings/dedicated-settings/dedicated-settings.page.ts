import { Component, OnInit } from '@angular/core';
import { LocalGroupServerService } from 'src/app/local-group-server.service';
import { StatusManageService } from 'src/app/status-manage.service';
import * as p5 from "p5";

@Component({
  selector: 'app-dedicated-settings',
  templateUrl: './dedicated-settings.page.html',
  styleUrls: ['./dedicated-settings.page.scss'],
})
export class DedicatedSettingsPage implements OnInit {

  constructor(
    public server: LocalGroupServerService,
    public statusBar: StatusManageService,
  ) { }

  info: string;
  addresses = '이곳에 이 기기의 네트워크 주소가 보여집니다.';

  ngOnInit() {
    new p5((p: p5) => {
      p.setup = () => {
        p.loadStrings('assets/data/infos/dedicated.txt', v => {
          this.info = v.join('\n');
          p.remove();
        });
      }
    });
    this.server.funcs.onCheck = (v: any) => {
      let keys = Object.keys(v);
      let results: string[] = [];
      for (let i = 0, j = keys.length; i < j; i++)
        if (v[keys[i]]['ipv4Addresses'].length)
          for (let k = 0, l = v[keys[i]]['ipv4Addresses'].length; k < l; k++)
            results.push(`${v[keys[i]]['ipv4Addresses'][k]} (${keys[i]})`);
      if (results.length)
        this.addresses = results.join('\n');
      else this.addresses = '연결된 네트워크가 없습니다.';
    }
    this.server.check_addresses();
  }

  /** 중복 클릭 방지용 토글 */
  block = {
    groupchat: false,
    webremote: false,
  }

  /**
   * 중복 클릭 방지를 위해 버튼을 막음
   * @param _target block 내 key 값
   */
  block_button(_target: string) {
    this.block[_target] = true;
    setTimeout(() => {
      this.block[_target] = false;
    }, 2000);
  }

  /** 최소한의 기능을 가진 채팅 서버 만들기 */
  start_minimalserver() {
    if (this.statusBar.dedicated.official['groupchat'] == 'offline') {
      this.block_button('groupchat')
      this.statusBar.settings['dedicatedServer'] = 'pending';
      this.statusBar.dedicated.official['groupchat'] = 'pending';
      this.server.funcs.onStart = () => {
        this.statusBar.settings['dedicatedServer'] = 'online';
        this.statusBar.dedicated.official['groupchat'] = 'online';
      }
      this.server.funcs.onFailed = () => {
        this.statusBar.settings['dedicatedServer'] = 'missing';
        this.statusBar.dedicated.official['groupchat'] = 'missing';
        setTimeout(() => {
          this.statusBar.settings['dedicatedServer'] = 'offline';
          this.statusBar.dedicated.official['groupchat'] = 'offline';
        }, 1500);
      }
      this.server.initialize();
    } else {
      this.block_button('groupchat')
      this.server.stop();
    }
  }

  /** 웹 페이지와 연동 시작하기 */
  start_webremote() {
    console.log('웹 페이지와 연동 함수 냉무');
    this.block_button('webremote');
  }
}
