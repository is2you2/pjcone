import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';
import { IndexedDBService } from './indexed-db.service';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';

/** 서버 상세 정보 */
export interface ServerInfo {
  /** 표시명, 앱 내 구성키는 target 사용 */
  name: string;
  address: string;
  /** 앱 내에서 구성하는 key 이름 */
  target: string;
  port?: number;
  useSSL?: boolean;
  isOfficial?: string;
  key?: string;
}

/** 서버마다 구성 */
interface NakamaGroup {
  info?: ServerInfo;
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
    private indexed: IndexedDBService,
  ) { }

  /** 공용 프로필 정보 (Profile 페이지에서 주로 사용) */
  profile = {
    content: {
      type: undefined,
      path: undefined,
    },
  };

  /** 구성: this > Official > TargetKey > Client */
  servers: { [id: string]: { [id: string]: NakamaGroup } } = {
    'official': {},
    'unofficial': {},
  };


  initialize() {
    // 공식서버 연결처리
    this.init_server();
    // 저장된 사설서버들 정보 불러오기
    this.indexed.loadTextFromUserPath('servers/list_detail.csv', (e, v) => {
      if (e && v) { // 내용이 있을 때에만 동작
        let list: string[] = v.split('\n');
        for (let i = 0, j = list.length; i < j; i++) {
          let sep = list[i].split(',');
          let info: ServerInfo = {
            isOfficial: sep[1],
            name: sep[2],
            target: sep[3],
            address: sep[4],
            port: +sep[5],
            useSSL: Boolean(sep[6]),
          }
          this.servers['unofficial'][info.target] = {};
          this.servers['unofficial'][info.target].info = info;
          this.init_server(info.isOfficial as any, info.target, info.address, info.key);
        }
      }
    });
    // 마지막 상태바 정보 불러오기: 사용자의 연결 여부 의사가 반영되어있음
    this.indexed.loadTextFromUserPath('servers/list.json', (e, v) => {
      if (e && v)
        this.statusBar.groupServer = JSON.parse(v);
      if (localStorage.getItem('is_online'))
        this.init_all_sessions();
    });
    // 서버별 그룹 정보 불러오기
    this.indexed.loadTextFromUserPath('servers/groups.json', (e, v) => {
      if (e && v)
        this.groups = JSON.parse(v);
    })
  }
  /** 공식 테스트 서버를 대상으로 Nakama 클라이언트 구성을 진행합니다.
   * @param _is_official 공식 서버 여부
   * @param _target 대상 key
   * @param _key 서버 key
   */
  init_server(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _address = SOCKET_SERVER_ADDRESS, _key = 'defaultkey') {
    if (!this.servers[_is_official][_target]) this.servers[_is_official][_target] = {};
    this.servers[_is_official][_target].client = new Client(_key, _address);
  }

  /** 모든 pending 세션 켜기 */
  init_all_sessions(_CallBack = (v: boolean) => console.log('init_all_sessions: ', v)) {
    let Targets = Object.keys(this.servers['official']);
    Targets.forEach(_target => {
      if (this.statusBar.groupServer['official'][_target] != 'offline')
        this.init_session(_CallBack, 'official', _target);
    });
    let unTargets = Object.keys(this.servers['unofficial']);
    unTargets.forEach(_target => {
      if (this.statusBar.groupServer['unofficial'][_target] != 'offline')
        this.init_session(_CallBack, 'unofficial', _target);
    });
  }

  /** 모든 online 클라이언트 받아오기
   * @returns Nakama.Client[] == 'online'
   */
  get_all_server(): NakamaGroup[] {
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

  /** 모든 서버 정보 받아오기
   * @returns Nakama.ServerInfo[]
   */
  get_all_server_info(): ServerInfo[] {
    let result: ServerInfo[] = [];
    let unTargets = Object.keys(this.servers['unofficial']);
    unTargets.forEach(_target => {
      if (this.servers['unofficial'][_target])
        result.push(this.servers['unofficial'][_target].info);
    });
    return result;
  }

  /** 전체 서버 상태를 검토하여 설정-그룹서버의 상태를 조율함 */
  catch_group_server_header(_temporary: string) {
    let finally_status: string;
    this.statusBar.settings['groupServer'] = _temporary as any;
    setTimeout(() => {
      this.statusBar.settings['groupServer'] = finally_status as any;
    }, 1500);
    let Targets = Object.keys(this.statusBar.groupServer['official']);
    Targets.forEach(_target => {
      switch (this.statusBar.groupServer['official'][_target]) {
        case 'online':
          finally_status = this.statusBar.groupServer['official'][_target];
          break;
        case 'pending':
          if (finally_status != 'online')
            finally_status = this.statusBar.groupServer['official'][_target];
          break;
        case 'missing':
          if (finally_status != 'online' && finally_status != 'pending')
            finally_status = this.statusBar.groupServer['official'][_target];
          break;
        case 'offline':
          if (finally_status != 'online' && finally_status != 'pending' && finally_status != 'missing')
            finally_status = this.statusBar.groupServer['official'][_target];
          break;
      }
    });
    if (finally_status != 'online') {
      let unTargets = Object.keys(this.statusBar.groupServer['unofficial']);
      unTargets.forEach(_target => {
        switch (this.statusBar.groupServer['unofficial'][_target]) {
          case 'online':
            finally_status = this.statusBar.groupServer['unofficial'][_target];
            break;
          case 'pending':
            if (finally_status != 'online')
              finally_status = this.statusBar.groupServer['unofficial'][_target];
            break;
          case 'missing':
            if (finally_status != 'online' && finally_status != 'pending')
              finally_status = this.statusBar.groupServer['unofficial'][_target];
            break;
          case 'offline':
            if (finally_status != 'online' && finally_status != 'pending' && finally_status != 'missing')
              finally_status = this.statusBar.groupServer['unofficial'][_target];
            break;
        }
      });
    }
  }

  uuid: string;
  /** 세션처리
   * @param _CallBack 오류시 행동방침
   * @param _target 대상 key
   */
  async init_session(_CallBack = (_v: boolean) => console.warn('nakama.init_session.callback null: ', _v), _is_official: 'official' | 'unofficial' = 'official', _target = 'default') {
    this.uuid = this.uuid || this.device.uuid;
    try {
      if (!this.servers[_is_official][_target]) this.servers[_is_official][_target] = {};
      this.servers[_is_official][_target].session
        = await this.servers[_is_official][_target].client.authenticateEmail(localStorage.getItem('email'), this.uuid, false);
      this.get_group_list(_is_official, _target);
      this.set_statusBar('online', _is_official, _target);
      _CallBack(true);
    } catch (e) {
      switch (e.status) {
        case 400: // 비번이 없거나 하는 등, 요청이 잘못됨
          this.p5toast.show({
            text: '사용자를 연결한 후 사용하세요.',
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
          this.servers[_is_official][_target].session = await this.servers[_is_official][_target].client.authenticateEmail(localStorage.getItem('email'), this.uuid, true);
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
      this.indexed.saveTextFileToUserPath(JSON.stringify(this.groups), 'servers/groups.json');
    }).catch(e => {
      console.error('save_group_list: ', e);
    });
  }

  /** 자신이 참여한 그룹 리모트에서 가져오기 */
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
    this.catch_group_server_header(_status);
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
