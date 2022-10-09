import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';

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
    private indexed: IndexedDBService,
  ) { }

  info: string;
  servers: ServerInfo[];

  ngOnInit() {
    new p5((p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${'ko'}/group-server.txt`, v => {
          this.info = v.join('\n');
          p.remove();
        }, e => {
          console.error('그룹서버 설명 파일 불러오기 실패: ', e);
          p.remove();
        });
      }
    });
    this.servers = this.nakama.get_all_server_info();
  }

  /** 서버 연결하기 */
  link_group(_is_official: string, _target: string) {
    if (this.statusBar.groupServer[_is_official][_target] == 'offline') {
      this.statusBar.groupServer[_is_official][_target] = 'pending';
      this.statusBar.settings['groupServer'] = 'pending';
      if (localStorage.getItem('is_online'))
        this.nakama.init_session((_v) => { }, _is_official as any, _target);
    } else { // 활동중이면 로그아웃처리
      this.statusBar.groupServer[_is_official][_target] = 'offline';
      console.warn('** 기능: 다중 서버 상태에 따른 설정-그룹 표시자 조건 필요');
      this.statusBar.settings['groupServer'] = 'offline';
      if (this.nakama.servers[_is_official][_target].session) {
        this.nakama.servers[_is_official][_target].client.sessionLogout(
          this.nakama.servers[_is_official][_target].session,
          this.nakama.servers[_is_official][_target].session.token,
          this.nakama.servers[_is_official][_target].session.refresh_token,
        );
      }
    }
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
  }

  /** 사설서버 주소 사용자 input */
  dedicated_info: ServerInfo = {
    name: undefined,
    address: undefined,
    target: undefined,
    port: undefined,
    useSSL: undefined,
    isOfficial: undefined,
    key: undefined,
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

    // 같은 이름 거르기
    if (this.statusBar.groupServer['unofficial'][this.dedicated_info.target || this.dedicated_info.name]) {
      this.p5toast.show({
        text: '이미 같은 구분자를 쓰는 서버가 있습니다 있습니다.',
      });
      return;
    }

    this.dedicated_info.target = this.dedicated_info.target || this.dedicated_info.name;
    // 기능 추가전 임시처리
    this.dedicated_info.address = this.dedicated_info.address || '192.168.0.1';
    this.dedicated_info.port = this.dedicated_info.port || 7350;
    this.dedicated_info.useSSL = this.dedicated_info.useSSL || false;
    this.dedicated_info.isOfficial = this.dedicated_info.isOfficial || 'unofficial';
    this.dedicated_info.key = this.dedicated_info.key || 'defaultkey';

    this.add_custom_tog = true;

    let line = new Date().getTime().toString();
    line += `,${this.dedicated_info.isOfficial}`;
    line += `,${this.dedicated_info.name}`;
    line += `,${this.dedicated_info.target}`;
    line += `,${this.dedicated_info.address}`;
    line += `,${this.dedicated_info.port}`;
    line += `,${this.dedicated_info.useSSL}`;
    this.indexed.loadTextFromUserPath('servers/list_detail.csv', (e, v) => {
      let list: string[] = [];
      if (e) list = v.split('\n');
      list.push(line);
      this.indexed.saveTextFileToUserPath(list.join('\n'), 'servers/list_detail.csv', (_v) => {
        this.nakama.init_server(this.dedicated_info.isOfficial as any, this.dedicated_info.target, this.dedicated_info.address, this.dedicated_info.key);
        this.nakama.servers[this.dedicated_info.isOfficial][this.dedicated_info.target].info = { ...this.dedicated_info };
        this.servers = this.nakama.get_all_server_info();
        this.dedicated_info.name = undefined;
        this.dedicated_info.address = undefined;
        this.dedicated_info.target = undefined;
        this.dedicated_info.port = undefined;
        this.dedicated_info.useSSL = undefined;
        this.dedicated_info.isOfficial = undefined;
        this.add_custom_tog = false;
      });
      this.statusBar.groupServer[this.dedicated_info.isOfficial][this.dedicated_info.target] = 'offline';
      this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
    });
  }

  /** 사설 서버 삭제 */
  remove_server(_is_official: string, _target: string) {
    // 로그인 상태일 경우 로그오프처리
    // 정보 일괄 삭제
    // 파일로부터 일치하는 정보 삭제
    console.log('삭제처리: ', _is_official, _target);
    console.log(this.nakama.servers);
  }
}
