import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';

/** 서버마다 구성 */
interface NakamaGroup {
  userId?: string;
  client?: Client;
  session?: Session;
  socket?: Socket;
}

@Injectable({
  providedIn: 'root'
})
export class NakamaService {

  constructor(
    private device: Device,
    private p5toast: P5ToastService,
    private statusBar: StatusManageService,
  ) { }

  /** 구성: this > Official > TargetKey > Client */
  servers: { [id: string]: { [id: string]: NakamaGroup } } = {
    'official': {},
    'unofficial': {},
  };

  /** 공식 테스트 서버를 대상으로 Nakama 클라이언트 구성을 진행합니다.
   * @param _is_official 공식 서버 여부
   * @param _target 대상 key
   * @param _key 서버 key
   */
  initialize(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _key = 'defaultkey') {
    if (!this.servers[_is_official][_target]) this.servers[_is_official][_target] = {};
    this.servers[_is_official][_target].client = new Client(_key, SOCKET_SERVER_ADDRESS);
    if (localStorage.getItem('is_online')) {
      this.init_all_sessions();
    }
  }

  /** 모든 pending 세션 켜기 */
  init_all_sessions(_CallBack = (v: boolean) => console.log(v)) {
    let Targets = Object.keys(this.servers['official']);
    Targets.forEach(_target => {
      if (this.statusBar.groupServer['official'][_target] == 'pending')
        this.init_session(_CallBack, 'official', _target);
    });

    let unTargets = Object.keys(this.servers['unofficial']);
    unTargets.forEach(_target => {
      if (this.statusBar.groupServer['unofficial'][_target] == 'pending')
        this.init_session(_CallBack, 'unofficial', _target);
    });
  }

  /** 모든 online 클라이언트 받아오기
   * @returns Nakama.Client[] == 'online'
   */
  get_all_servers(_CallBack = (v: boolean) => console.log(v)): NakamaGroup[] {
    let result: NakamaGroup[] = [];
    let Targets = Object.keys(this.servers['official']);
    Targets.forEach(_target => {
      if (this.statusBar.groupServer['official'][_target] == 'online')
        result.push(this.servers['official'][_target]);
    });
    let unTargets = Object.keys(this.servers['unofficial']);
    unTargets.forEach(_target => {
      if (this.statusBar.groupServer['unofficial'][_target] == 'online')
        result.push(this.servers['unofficial'][_target]);
    });
    return result;
  }

  /** 세션처리
   * @param _CallBack 오류시 행동방침
   * @param _target 대상 key
   */
  async init_session(_CallBack = (_v: boolean) => { }, _is_official: 'official' | 'unofficial' = 'official', _target = 'default') {
    let uuid = this.device.uuid;
    uuid = 'test1234pass'
    try {
      if (!this.servers[_is_official][_target]) this.servers[_is_official][_target] = {};
      this.servers[_is_official][_target].session = await this.servers[_is_official][_target].client.authenticateEmail(localStorage.getItem('email'), uuid, false);
      _CallBack(true);
      this.get_group_list(_is_official, _target);
      this.set_statusBar('online', _is_official, _target);
    } catch (e) {
      switch (e.status) {
        case 400: // 비번이 없거나 하는 등, 요청이 잘못됨
          this.p5toast.show({
            text: '웹 브라우저에서는 지원하지 않습니다.',
          });
          _CallBack(false);
          this.set_statusBar('missing', _is_official, _target);
          break;
        case 401: // 비밀번호 잘못됨
          this.p5toast.show({
            text: '기기 재검증 이메일 발송 필요! (아직 개발되지 않음)',
          });
          _CallBack(false);
          this.set_statusBar('missing', _is_official, _target);
          break;
        case 404: // 아이디 없음
          this.servers[_is_official][_target].session = await this.servers[_is_official][_target].client.authenticateEmail(localStorage.getItem('email'),
            uuid, true);
          await this.servers[_is_official][_target].client.updateAccount(
            this.servers[_is_official][_target].session, {
            display_name: localStorage.getItem('name'),
          });
          this.p5toast.show({
            text: '회원가입이 완료되었습니다.',
          });
          this.set_statusBar('online', _is_official, _target);
          break;
        default:
          this.p5toast.show({
            text: `준비되지 않은 오류 유형: ${e}`,
          });
          _CallBack(false);
          this.set_statusBar('missing', _is_official, _target);
          break;
      }
    }
  }

  /** 등록된 그룹 아이디들, 서버에 저장되어있고 동기화시켜야합니다 */
  groups: { [id: string]: { [id: string]: { [id: string]: any } } } = {
    'official': {},
    'unofficial': {},
  }

  /** 그룹 리스트 로컬/리모트에 저장하기 */
  save_group_list(_group: any, _is_official: string, _target: string, _CallBack = () => { }) {
    delete _group['server'];
    if (!this.groups[_is_official][_target]) this.groups[_is_official][_target] = {};
    this.groups[_is_official][_target][_group.id] = _group;
    this.servers[_is_official][_target].client.writeStorageObjects(
      this.servers[_is_official][_target].session, [{
        collection: 'user_groups',
        key: 'linked_group',
        value: this.groups,
        permission_read: 1,
        permission_write: 1,
      }]
    ).then(_v => {
      _CallBack();
    }).catch(e => {
      console.error('save_group_list: ', e);
    });
  }

  /** 자신이 참여한 그룹 리모트에 가져오기 */
  get_group_list(_is_official: string, _target: string) {
    this.servers[_is_official][_target].client.listStorageObjects(
      this.servers[_is_official][_target].session,
      'user_groups',
      this.servers[_is_official][_target].session.user_id,
    ).then(v => {
      if (!v.objects.length) return;
      this.groups = { ...this.groups, ...v.objects[0].value as any };
    }).catch(e => {
      console.error('get_group_list: ', e);
    });
  }

  set_statusBar(_status: 'offline' | 'missing' | 'pending' | 'online' | 'certified', _is_official: string, _target: string) {
    this.statusBar.groupServer[_is_official][_target] = _status;
    this.statusBar.settings['groupServer'] = _status;
  }

  /** 소켓 서버에 연결 */
  connect_to(_is_official: 'official' | 'unofficial' = 'official', _target = 'default') {
    this.servers[_is_official][_target].socket.connect(
      this.servers[_is_official][_target].session, true
    );
  }

  /** 소켄 연결 끊기 */
  disconnect(_is_official: 'official' | 'unofficial' = 'official', _target = 'default') {
    this.servers[_is_official][_target].socket.disconnect(true);
  }
}
