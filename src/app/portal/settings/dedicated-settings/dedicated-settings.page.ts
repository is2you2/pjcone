// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { LocalGroupServerService } from 'src/app/local-group-server.service';
import { StatusManageService } from 'src/app/status-manage.service';
import * as p5 from "p5";
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-dedicated-settings',
  templateUrl: './dedicated-settings.page.html',
  styleUrls: ['./dedicated-settings.page.scss'],
})
export class DedicatedSettingsPage implements OnInit {

  constructor(
    public server: LocalGroupServerService,
    public statusBar: StatusManageService,
    public lang: LanguageSettingService,
  ) { }

  info: string;
  addresses = this.lang.text['UseAsServer']['LoadingAddresses'];

  ngOnInit() {
    new p5((p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${this.lang.lang}/dedicated.txt`, v => {
          this.info = v.join('\n');
          p.remove();
        }, e => {
          console.error('사설서버 설정 파일 불러오기 실패: ', e);
          p.remove();
        });
      }
    });
    this.server.funcs.onCheck = (v: any) => {
      let keys = Object.keys(v);
      let results: string[] = [];
      keys.forEach(key => {
        if (v[key]['ipv4Addresses'].length)
          v[key]['ipv4Addresses'].forEach((address: any) => {
            results.push(`${address} (${key})`);
          });
      });
      if (results.length)
        this.addresses = results.join('\n');
      else this.addresses = this.lang.text['UseAsServer']['NoAddress'];
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
}
