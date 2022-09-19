import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';

export interface ServerInfo {
  /** 표시명, 앱 내 구성키는 target 사용 */
  name: string;
  address: string;
  /** 앱 내에서 구성하는 key 이름 */
  target: string;
  port?: number;
  useSSL?: boolean;
  isOfficial?: string;
}

@Component({
  selector: 'app-group-server',
  templateUrl: './group-server.page.html',
  styleUrls: ['./group-server.page.scss'],
})
export class GroupServerPage implements OnInit {

  constructor(
    private nakama: NakamaService,
    private p5toast: P5ToastService,
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
    if (this.statusBar.groupServer.official['default'] == 'offline') {
      this.statusBar.groupServer.official['default'] = 'pending';
      this.statusBar.settings['groupServer'] = 'pending';
      if (localStorage.getItem('is_online'))
        this.nakama.init_session();
    } else {
      this.statusBar.groupServer.official['default'] = 'offline';
      this.statusBar.settings['groupServer'] = 'offline';
    }
    this.nakama.saveUsingServers();
  }

  /** 사설서버 주소 사용자 input */
  dedicated_info: ServerInfo = {
    name: undefined,
    address: undefined,
    target: undefined,
    port: undefined,
    useSSL: undefined,
    isOfficial: undefined,
  }
  /** 사설서버 등록 중복 방지 토글 */
  add_custom_tog = false;
  /** 사설서버 등록하기 */
  add_custom_dedicated() {
    if (this.add_custom_tog) return;

    if (!this.dedicated_info.name) {
      this.p5toast.show({
        text: '이름을 지정해주세요.',
      });
      return;
    }

    if (!this.dedicated_info.address) {
      this.p5toast.show({
        text: '주소를 입력해주세요.',
      });
      return;
    }

    this.add_custom_tog = true;

    this.nakama.saveUsingServers();

    setTimeout(() => {
      this.p5toast.show({
        text: '사설 서버 등록 기능 준비중입니다.',
      });
      this.dedicated_info.name = undefined;
      this.dedicated_info.address = undefined;
      this.dedicated_info.target = undefined;
      this.dedicated_info.port = undefined;
      this.dedicated_info.useSSL = undefined;
      this.add_custom_tog = false;
    }, 1500);
  }
}
