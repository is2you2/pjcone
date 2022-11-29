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
    if (this.statusBar.groupServer[_is_official][_target] == 'offline' || this.statusBar.groupServer[_is_official][_target] == 'missing') {
      this.statusBar.groupServer[_is_official][_target] = 'pending';
      this.nakama.catch_group_server_header('pending');
      if (localStorage.getItem('is_online'))
        this.nakama.init_session((_v) => {
          if (_v || _v === undefined)
            this.indexed.loadTextFromUserPath('servers/self/profile.json', (e, v) => {
              if (e && v) {
                let json = JSON.parse(v);
                if (!json['img']) {
                  this.nakama.servers[_is_official][_target].client.readStorageObjects(
                    this.nakama.servers[_is_official][_target].session, {
                    object_ids: [{
                      collection: 'user_public',
                      key: 'profile_image',
                      user_id: this.nakama.servers[_is_official][_target].session.user_id,
                    }],
                  }).then(v => {
                    if (v.objects.length) {
                      json['img'] = v.objects[0].value['img'];
                      this.indexed.saveTextFileToUserPath(JSON.stringify(json), 'servers/self/profile.json');
                    }
                  })
                }
              }
            })
        }, _is_official as any, _target);
    } else { // 활동중이면 로그아웃처리
      this.statusBar.groupServer[_is_official][_target] = 'offline';
      this.nakama.catch_group_server_header('offline');
      if (this.nakama.servers[_is_official][_target].session) {
        this.nakama.servers[_is_official][_target].client.sessionLogout(
          this.nakama.servers[_is_official][_target].session,
          this.nakama.servers[_is_official][_target].session.token,
          this.nakama.servers[_is_official][_target].session.refresh_token,
        ).then(v => {
          if (!v) console.warn('로그아웃 오류 검토 필요');
          if (this.nakama.noti_origin[_is_official] && this.nakama.noti_origin[_is_official][_target])
            delete this.nakama.noti_origin[_is_official][_target];
          this.nakama.rearrange_notifications();
        });
      }
      if (this.nakama.servers[_is_official][_target].socket)
        this.nakama.servers[_is_official][_target].socket.disconnect(true);
      if (this.nakama.channels_orig[_is_official] && this.nakama.channels_orig[_is_official][_target]) {
        let channel_ids = Object.keys(this.nakama.channels_orig[_is_official][_target]);
        channel_ids.forEach(_cid => {
          if (this.nakama.channels_orig[_is_official][_target][_cid]['status'] != 'missing')
            delete this.nakama.channels_orig[_is_official][_target][_cid]['status'];
        });
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
    this.add_custom_tog = true;

    this.nakama.add_group_server(this.dedicated_info, () => {
      this.servers = this.nakama.get_all_server_info();
      this.dedicated_info.name = undefined;
      this.dedicated_info.address = undefined;
      this.dedicated_info.target = undefined;
      this.dedicated_info.port = undefined;
      this.dedicated_info.useSSL = undefined;
      this.dedicated_info.isOfficial = undefined;
      this.add_custom_tog = false;
    });
  }

  /** 사설 서버 삭제 */
  remove_server(_is_official: string, _target: string) {
    // 로그인 상태일 경우 로그오프처리
    if (this.nakama.servers[_is_official][_target].session)
      this.nakama.servers[_is_official][_target].client.sessionLogout(
        this.nakama.servers[_is_official][_target].session,
        this.nakama.servers[_is_official][_target].session.token,
        this.nakama.servers[_is_official][_target].session.refresh_token,
      )
    if (this.nakama.servers[_is_official][_target].socket)
      this.nakama.servers[_is_official][_target].socket.disconnect(true);
    // 알림정보 삭제
    delete this.nakama.servers[_is_official][_target];
    if (this.nakama.noti_origin[_is_official] && this.nakama.noti_origin[_is_official][_target])
      delete this.nakama.noti_origin[_is_official][_target];
    this.nakama.rearrange_notifications();
    // 예하 채널들 손상처리
    if (this.nakama.channels_orig[_is_official] && this.nakama.channels_orig[_is_official][_target]) {
      let channel_ids = Object.keys(this.nakama.channels_orig[_is_official][_target]);
      channel_ids.forEach(_cid => {
        this.nakama.channels_orig[_is_official][_target][_cid]['status'] = 'missing';
      });
    }
    this.nakama.rearrange_channels();
    // 예하 그룹들 손상처리
    let group_ids = Object.keys(this.nakama.groups[_is_official][_target]);
    group_ids.forEach(_gid => {
      this.nakama.groups[_is_official][_target][_gid]['status'] = 'missing';
    });
    // 그룹서버 리스트 정리
    this.servers = this.nakama.get_all_server_info();
    // 그룹서버 정리
    delete this.statusBar.groupServer[_is_official][_target];
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
    // 파일로부터 일치하는 정보 삭제
    this.indexed.loadTextFromUserPath('servers/list_detail.csv', (e, v) => {
      if (e) {
        let lines = v.split('\n');
        for (let i = 0, j = lines.length; i < j; i++) {
          let sep = lines[i].split(',');
          if (sep[3] == _target) {
            lines.splice(i, 1);
            break;
          }
        }
        this.indexed.saveTextFileToUserPath(lines.join('\n'), 'servers/list_detail.csv');
      }
    });
  }
}
