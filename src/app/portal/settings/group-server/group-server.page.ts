import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';

@Component({
  selector: 'app-group-server',
  templateUrl: './group-server.page.html',
  styleUrls: ['./group-server.page.scss'],
})
export class GroupServerPage implements OnInit {

  constructor(
    private nakama: NakamaService,
    public statusBar: StatusManageService,
  ) { }

  info: string;

  ngOnInit() {
    new p5((p: p5) => {
      p.setup = () => {
        p.loadStrings('assets/data/infos/group-server.txt', v => {
          this.info = v.join('\n');
          p.remove();
        });
      }
    });
  }

  /** 공식 제공 서버 연결하기 */
  link_official_group() {
    console.log('공식 제공 서버 연결');
    this.statusBar.groupServer.official['nakama'] = 'pending';
    this.statusBar.settings['groupServer'] = 'pending';
    localStorage.setItem('group-server', 'auto-on');
  }

  /** 공식 제공 서버로부터 연결 끊기 */
  unlink_official_group() {
    console.log('공식 제공 서버 연결 끊기');
    this.statusBar.groupServer.official['nakama'] = 'offline';
    this.statusBar.settings['groupServer'] = 'offline';
    localStorage.removeItem('group-server');
  }

  /** 사설서버 주소 사용자 input */
  dedicated_info = {
    name: '',
    address: '',
  }
  /** 사설서버 등록 중복 방지 토글 */
  add_custom_tog = false;
  /** 사설서버 등록하기 */
  add_custom_dedicated() {
    if (this.add_custom_tog) return;
    this.add_custom_tog = true;
    this.dedicated_info.name = '';
    this.dedicated_info.address = '';
    console.log('사설서버 등록처리');
  }
}
