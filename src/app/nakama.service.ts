import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Channel, ChannelMessage, ChannelPresenceEvent, Client, Group, Notification, Session, Socket, User } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';
import { IndexedDBService } from './indexed-db.service';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';
import * as p5 from 'p5';
import { LocalNotiService } from './local-noti.service';
import { AlertController, ModalController } from '@ionic/angular';
import { GroupDetailPage } from './portal/settings/group-detail/group-detail.page';
import { WscService } from './wsc.service';

/** 서버 상세 정보 */
export interface ServerInfo {
  /** 표시명, 앱 내 구성키는 target 사용 */
  name: string;
  address?: string;
  /** 앱 내에서 구성하는 key 이름 */
  target?: string;
  port?: number;
  useSSL?: boolean;
  isOfficial?: string;
  key?: string;
}

/** 서버마다 구성 */
interface NakamaGroup {
  /** 서버 정보 */
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
    private noti: LocalNotiService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private communityServer: WscService,
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
    'official': {
      'default': {
        info: {
          name: '개발 테스트 서버',
          address: SOCKET_SERVER_ADDRESS,
          isOfficial: 'official',
          target: 'default',
          key: 'defaultkey',
          port: 7350,
          useSSL: true,
        }
      }
    },
    'unofficial': {},
  };

  initialize() {
    // 개인 정보 설정
    this.uuid = this.device.uuid;
    this.indexed.loadTextFromUserPath('servers/self/profile.json', (e, v) => {
      if (e && v) this.users.self = JSON.parse(v);
    });
    // 서버별 그룹 정보 불러오기
    this.indexed.loadTextFromUserPath('servers/groups.json', (e, v) => {
      if (e && v)
        this.groups = JSON.parse(v);
      let all_groups = this.rearrange_group_list();
      all_groups.forEach(group => {
        if (group['status'] != 'missing') {
          this.indexed.loadTextFromUserPath(`servers/${group['server']['isOfficial']}/${group['server']['target']}/groups/${group.id}.img`, (e, v) => {
            if (e && v) group['img'] = v.replace(/"|=|\\/g, '');
          });
          delete group['status'];
          let _is_official = group['server']['isOfficial'];
          let _target = group['server']['target'];
          if (group['users'])
            for (let i = 0, j = group['users'].length; i < j; i++)
              if (!group['users'][i]['is_me'])
                group['users'][i]['user'] = this.load_other_user(group['users'][i]['user']['id'], _is_official, _target);
        }
      });
      // 채널 불러오기
      this.load_channel_list();
    });
    // 공식서버 연결처리
    this.init_server(this.servers['official']['default'].info);
    // 저장된 사설서버들 정보 불러오기
    this.indexed.loadTextFromUserPath('servers/list_detail.csv', (e, v) => {
      if (e && v) { // 내용이 있을 때에만 동작
        let list: string[] = v.split('\n');
        list.forEach(ele => {
          let sep = ele.split(',');
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
          this.init_server(info);
        });
      }
    });
    // 마지막 상태바 정보 불러오기: 사용자의 연결 여부 의사가 반영되어있음
    this.indexed.loadTextFromUserPath('servers/list.json', (e, v) => {
      if (e && v)
        this.statusBar.groupServer = JSON.parse(v);
      if (this.users.self['is_online'])
        this.init_all_sessions();
    });
  }
  /** 공식 테스트 서버를 대상으로 Nakama 클라이언트 구성을 진행합니다.
   * @param _is_official 공식 서버 여부
   * @param _target 대상 key
   * @param _key 서버 key
   */
  init_server(_info: ServerInfo) {
    if (!this.servers[_info.isOfficial][_info.target]) this.servers[_info.isOfficial][_info.target] = {};
    this.servers[_info.isOfficial][_info.target].client = new Client(
      (_info.key || 'defaultkey'), _info.address,
      (_info.port || 7350).toString(),
      (_info.useSSL || false),
    );
  }

  /** 모든 pending 세션 켜기 */
  init_all_sessions() {
    let Targets = Object.keys(this.servers['official']);
    Targets.forEach(_target => {
      if (this.statusBar.groupServer['official'][_target] != 'offline')
        this.init_session(this.servers['official'][_target].info);
    });
    let unTargets = Object.keys(this.servers['unofficial']);
    unTargets.forEach(_target => {
      if (this.statusBar.groupServer['unofficial'][_target] != 'offline')
        this.init_session(this.servers['unofficial'][_target].info);
    });
  }

  /** 모든 online 클라이언트 받아오기
   * @returns Nakama.Client[] == 'online'
   */
  get_all_online_server(): NakamaGroup[] {
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
   * @param with_official 공식 서버 포함하여 카운트 여부
   * @param online_only 온라인 여부를 사용할지
   * @returns Nakama.ServerInfo[]
   */
  get_all_server_info(with_official = false, online_only = false): ServerInfo[] {
    let result: ServerInfo[] = [];
    let Target = Object.keys(this.servers['official']);
    if (with_official)
      Target.forEach(_target => {
        if (online_only) {
          if (this.statusBar.groupServer['official'][_target] == 'online')
            result.push(this.servers['official'][_target].info);
        } else if (this.servers['official'][_target])
          result.push(this.servers['official'][_target].info);
      });
    let unTargets = Object.keys(this.servers['unofficial']);
    unTargets.forEach(_target => {
      if (online_only) {
        if (this.statusBar.groupServer['unofficial'][_target] == 'online')
          result.push(this.servers['unofficial'][_target].info);
      } else if (this.servers['unofficial'][_target])
        result.push(this.servers['unofficial'][_target].info);
    });
    return result;
  }

  /** 그룹 서버 추가하기 */
  add_group_server(info: ServerInfo, _CallBack = () => { }) {
    // 같은 이름 거르기
    if (this.statusBar.groupServer['unofficial'][info.target || info.name]) {
      this.p5toast.show({
        text: `이미 같은 구분자를 쓰는 서버가 있습니다 있습니다: ${info.target || info.name}`,
      });
      return;
    }

    info.target = info.target || info.name;
    // 기능 추가전 임시처리
    info.address = info.address || '192.168.0.1';
    info.port = info.port || 7350;
    info.useSSL = info.useSSL || false;
    info.isOfficial = info.isOfficial || 'unofficial';
    info.key = info.key || 'defaultkey';

    let line = new Date().getTime().toString();
    line += `,${info.isOfficial}`;
    line += `,${info.name}`;
    line += `,${info.target}`;
    line += `,${info.address}`;
    line += `,${info.port}`;
    line += `,${info.useSSL}`;
    this.indexed.loadTextFromUserPath('servers/list_detail.csv', (e, v) => {
      let list: string[] = [];
      if (e && v) list = v.split('\n');
      list.push(line);
      this.indexed.saveTextFileToUserPath(list.join('\n'), 'servers/list_detail.csv', (_v) => {
        this.init_server(info);
        this.servers[info.isOfficial][info.target].info = { ...info };
        _CallBack();
      });
      this.statusBar.groupServer[info.isOfficial][info.target] = 'offline';
      this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
    });
  }

  /** 전체 서버 상태를 검토하여 설정-그룹서버의 상태를 조율함 */
  catch_group_server_header(_temporary: string) {
    let finally_status: string;
    this.statusBar.settings['groupServer'] = _temporary as any;
    setTimeout(() => {
      let Targets = Object.keys(this.statusBar.groupServer['official']);
      Targets.forEach(_target => {
        switch (this.statusBar.groupServer['official'][_target]) {
          case 'online':
            finally_status = 'online';
            break;
          case 'pending':
            if (finally_status != 'online')
              finally_status = 'pending';
            break;
          case 'missing':
          case 'offline':
            if (finally_status != 'online' && finally_status != 'pending')
              finally_status = 'offline';
            break;
        }
      });
      if (finally_status != 'online') {
        let unTargets = Object.keys(this.statusBar.groupServer['unofficial']);
        unTargets.forEach(_target => {
          switch (this.statusBar.groupServer['unofficial'][_target]) {
            case 'online':
              finally_status = 'online';
              break;
            case 'pending':
              if (finally_status != 'online')
                finally_status = 'pending';
              break;
            case 'missing':
            case 'offline':
              if (finally_status != 'online' && finally_status != 'pending')
                finally_status = 'offline';
              break;
          }
        });
      }
      this.statusBar.settings['groupServer'] = finally_status as any;
    }, 1500);
  }

  /** Nakama에서 수신한 그룹별 알림  
   * { isOfficial: {
   *     target: {
   *       notification.id: value...
   *     }
   *   }
   * }
   */
  noti_origin = {};
  uuid: string;
  /** 세션처리
   * @param _CallBack 오류시 행동방침
   * @param info.target 대상 key
   */
  async init_session(info: ServerInfo) {
    try {
      this.servers[info.isOfficial][info.target].session
        = await this.servers[info.isOfficial][info.target].client.authenticateEmail(this.users.self['email'], this.uuid, false);
      this.after_login(info.isOfficial, info.target, info.useSSL);
    } catch (e) {
      console.log(e);
      switch (e.status) {
        case 400: // 비번이 없거나 하는 등, 요청이 잘못됨
          this.p5toast.show({
            text: '사용자를 연결한 후 사용하세요.',
          });
          this.users.self['is_online'] = false;
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
        case 401: // 비밀번호 잘못됨
          this.p5toast.show({
            text: '기기 재검증 과정 필요 (아직 개발되지 않음)',
          });
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
        case 404: // 아이디 없음
          this.servers[info.isOfficial][info.target].session = await this.servers[info.isOfficial][info.target].client.authenticateEmail(this.users.self['email'], this.uuid, true);
          if (this.users.self['display_name'])
            this.servers[info.isOfficial][info.target].client.updateAccount(
              this.servers[info.isOfficial][info.target].session, {
              display_name: this.users.self['display_name'],
              lang_tag: navigator.language.split('-')[0],
            });
          this.p5toast.show({
            text: `회원가입이 완료되었습니다: ${info.target}`,
            lateable: true,
          });
          if (this.users.self['img'])
            this.servers[info.isOfficial][info.target].client.writeStorageObjects(
              this.servers[info.isOfficial][info.target].session, [{
                collection: 'user_public',
                key: 'profile_image',
                permission_read: 2,
                permission_write: 1,
                value: { img: this.users.self['img'] },
              }]
            ).then(v => {
              this.servers[info.isOfficial][info.target].client.updateAccount(
                this.servers[info.isOfficial][info.target].session, {
                avatar_url: v.acks[0].version,
              });
            });
          this.after_login(info.isOfficial, info.target, info.useSSL);
          break;
        default:
          this.p5toast.show({
            text: `준비되지 않은 오류 유형: ${e}`,
          });
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
      }
    }
  }

  /** 로그인 및 회원가입 직후 행동들 */
  after_login(_is_official: any, _target: string, _useSSL: boolean) {
    // 통신 소켓 생성
    this.servers[_is_official][_target].socket = this.servers[_is_official][_target].client.createSocket(_useSSL);
    // 그룹 서버 연결 상태 업데이트
    this.set_group_statusBar('online', _is_official, _target);
    // 공식 서버인 경우 관리자 알림모드 검토
    if (_is_official == 'official' && _target == 'default')
      this.communityServer.send(JSON.stringify({
        act: 'is_admin',
        uuid: this.servers[_is_official][_target].session.user_id
      }));
    // 개인 정보를 서버에 맞춤
    if (!this.users.self['display_name'])
      this.servers[_is_official][_target].client.getAccount(
        this.servers[_is_official][_target].session).then(v => {
          let keys = Object.keys(v.user);
          keys.forEach(key => this.users.self[key] = v.user[key]);
          this.save_self_profile();
        });
    // 개인 프로필 이미지를 서버에 맞춤
    if (!this.users.self['img'])
      this.servers[_is_official][_target].client.readStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: 'user_public',
          key: 'profile_image',
          user_id: this.servers[_is_official][_target].session.user_id,
        }],
      }).then(v => {
        if (v.objects.length) {
          if (this.socket_reactive['profile']) {
            this.socket_reactive['profile'](v.objects[0].value['img']);
          } else {
            this.users.self['img'] = v.objects[0].value['img'];
            this.indexed.saveTextFileToUserPath(JSON.stringify(this.users.self['img']), 'servers/self/profile.img');
          }
        }
      })
    // 단발적으로 다른 사용자 정보 업데이트
    if (this.groups[_is_official][_target])
      this.instant_group_user_update(_is_official, _target);
    // 통신 소켓 연결하기
    this.connect_to(_is_official, _target, () => {
      this.get_group_list(_is_official, _target);
      this.redirect_channel(_is_official, _target);
      this.update_notifications(_is_official, _target);
    });
  }

  /** 그룹 내 모든 다른 사용자 정보 업데이트 */
  instant_group_user_update(_is_official: string, _target: string) {
    let group_ids = Object.keys(this.groups[_is_official][_target]);
    group_ids.forEach(_gid => {
      if (this.groups[_is_official][_target][_gid]['users'])
        this.groups[_is_official][_target][_gid]['users'].forEach((_user: any) => {
          if (!_user['is_me'])
            this.servers[_is_official][_target].client.getUsers(
              this.servers[_is_official][_target].session, [_user['user']['id']]
            ).then(_userinfo => {
              if (_userinfo.users.length) {
                let keys = Object.keys(_userinfo.users[0]);
                keys.forEach(key => this.users[_is_official][_target][_userinfo.users[0].id][key] = _userinfo.users[0][key]);
              } else this.users[_is_official][_target][_user['user']['id']]['deleted'] = true;
            });
        });
    });
  }

  /** 서버별 사용자 정보 가져오기
   * users[isOfficial][target][uid] = UserInfo;
   */
  users = {
    self: {},
    official: {},
    unofficial: {},
  };

  /** 내 정보를 저장하기 */
  save_self_profile() {
    let without_img = { ...this.users.self };
    delete without_img['img'];
    this.indexed.saveTextFileToUserPath(JSON.stringify(without_img), 'servers/self/profile.json')
  }

  /** 불러와진 모든 사용자를 배열로 돌려주기 */
  rearrange_all_user() {
    let result: User[] = [];
    let isOfficial = Object.keys(this.users);
    isOfficial.forEach(_is_official => {
      let Target = Object.keys(this.users[_is_official]);
      Target.forEach(_target => {
        let UserIds = Object.keys(this.users[_is_official][_target]);
        UserIds.forEach(_uid => {
          result.push(this.users[_is_official][_target][_uid]);
        });
      });
    });
    return result;
  }

  /** 다른 사람의 정보 반환해주기 (로컬 정보 기반)
   * @returns 다른 사람 정보: User
   */
  load_other_user(userId: string, _is_official: string, _target: string) {
    if (!this.users[_is_official][_target]) this.users[_is_official][_target] = {};
    let need_to_load_from_file = !this.users[_is_official][_target][userId];
    if (need_to_load_from_file) {
      this.users[_is_official][_target][userId] = {};
      this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/users/${userId}/profile.json`, (e, v) => {
        if (e && v) {
          let data = JSON.parse(v);
          let keys = Object.keys(data);
          keys.forEach(key => this.users[_is_official][_target][userId][key] = data[key]);
        }
        this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/users/${userId}/profile.img`, (e, v) => {
          if (e && v) {
            this.users[_is_official][_target][userId]['img'] = v.replace(/"|=|\\/g, '');
          } else if (userId[_is_official][_target][userId]['avatar_url']) {
            this.servers[_is_official][_target].client.readStorageObjects(
              this.servers[_is_official][_target].session, {
              object_ids: [{
                collection: 'user_public',
                key: 'profile_image',
                user_id: userId,
              }]
            }).then(v => {
              if (v.objects.length)
                this.users[_is_official][_target][userId]['img'] = v.objects[0].value['img'];
              else delete this.users[_is_official][_target][userId]['avatar_url'];
              this.save_other_user(userId, _is_official, _target);
            });
          }
        });
      });
    }
    return this.users[_is_official][_target][userId];
  }

  /** 다른 사람의 정보 간소화하여 저장하기 */
  save_other_user(userInfo: any, _is_official: string, _target: string) {
    let copied = { ...userInfo };
    delete copied['img'];
    delete copied['online'];
    if (!this.users[_is_official][_target]) this.users[_is_official][_target] = {};
    if (!this.users[_is_official][_target][userInfo['id']]) this.users[_is_official][_target][userInfo['id']] = {};
    let keys = Object.keys(userInfo);
    keys.forEach(key => this.users[_is_official][_target][userInfo['id']][key] = userInfo[key]);
    this.indexed.saveTextFileToUserPath(JSON.stringify(copied), `servers/${_is_official}/${_target}/users/${copied['id']}/profile.json`);
    if (userInfo['img'])
      this.indexed.saveTextFileToUserPath(userInfo['img'], `servers/${_is_official}/${_target}/users/${userInfo['id']}/profile.img`);
  }

  /** 서버로부터 알림 업데이트하기 (알림 리스트 재정렬 포함됨) */
  update_notifications(_is_official: string, _target: string) {
    this.servers[_is_official][_target].client.listNotifications(this.servers[_is_official][_target].session, 3)
      .then(v => {
        this.noti_origin = {};
        for (let i = 0, j = v.notifications.length; i < j; i++)
          this.act_on_notification(v.notifications[i], _is_official, _target);
        this.rearrange_notifications();
      });
  }

  /** 알림이 재정렬된 후에..  
   * @return nakama.Notification[]
   */
  after_notifications_rearrange = {};
  /** 그룹별 알림을 시간순으로 정렬함 */
  rearrange_notifications() {
    let result: Notification[] = [];
    let isOfficial = Object.keys(this.noti_origin);
    isOfficial.forEach(_is_official => {
      let Target = Object.keys(this.noti_origin[_is_official]);
      Target.forEach(_target => {
        let NotificationId = Object.keys(this.noti_origin[_is_official][_target]);
        NotificationId.forEach(_noti_id => {
          result.push(this.noti_origin[_is_official][_target][_noti_id]);
        });
      });
    });
    result.sort((a, b) => {
      if (a.create_time < b.create_time) return 1;
      if (a.create_time > b.create_time) return -1;
      return 0;
    });
    let keys = Object.keys(this.after_notifications_rearrange);
    keys.forEach(key => this.after_notifications_rearrange[key](result));
    return result;
  }

  /** 등록된 그룹 아이디들, 서버에 저장되어있고 동기화시켜야합니다
   * groups[isOfficial][target][group_id] = { ...info }
   */
  groups: any = {
    'official': {},
    'unofficial': {},
  }

  /** 등록된 채널들 관리  
   * channels_orig[isOfficial][target][channel_id] = [ ...info ]
   */
  channels_orig = {
    'official': {},
    'unofficial': {},
  };

  /** 채널 추가, 채널 재배열 포함됨 */
  add_channels(channel_info: Channel, _is_official: string, _target: string) {
    if (!this.channels_orig[_is_official][_target])
      this.channels_orig[_is_official][_target] = {};
    if (this.channels_orig[_is_official][_target][channel_info.id] !== undefined && this.channels_orig[_is_official][_target][channel_info.id]['status'] != 'missing') return;
    this.channels_orig[_is_official][_target][channel_info.id] = channel_info;
    this.rearrange_channels();
  }

  /** 채팅 기록 가져오기 */
  load_channel_list() {
    this.indexed.loadTextFromUserPath('servers/channels.json', (e, v) => {
      if (e && v) {
        this.channels_orig = JSON.parse(v);
        let isOfficial = Object.keys(this.channels_orig);
        isOfficial.forEach(_is_official => {
          let Target = Object.keys(this.channels_orig[_is_official]);
          Target.forEach(_target => {
            let channel_ids = Object.keys(this.channels_orig[_is_official][_target]);
            channel_ids.forEach(_cid => {
              if (this.channels_orig[_is_official][_target][_cid]['redirect']['type'] == 2)
                this.channels_orig[_is_official][_target][_cid]['info'] = this.load_other_user(this.channels_orig[_is_official][_target][_cid]['redirect']['id'], _is_official, _target);
              if (this.channels_orig[_is_official][_target][_cid]['status'] != 'missing')
                delete this.channels_orig[_is_official][_target][_cid]['status'];
            });
          });
        });
      }
      this.rearrange_channels();
    });
  }

  /** 세션 재접속 시 기존 정보를 이용하여 채팅방에 다시 로그인함 */
  redirect_channel(_is_official: string, _target: string) {
    if (this.channels_orig[_is_official][_target]) {
      let channel_ids = Object.keys(this.channels_orig[_is_official][_target]);
      channel_ids.forEach(_cid => {
        if (this.channels_orig[_is_official][_target][_cid]['status'] != 'missing') {
          this.servers[_is_official][_target].socket.joinChat(
            this.channels_orig[_is_official][_target][_cid]['redirect']['id'],
            this.channels_orig[_is_official][_target][_cid]['redirect']['type'],
            this.channels_orig[_is_official][_target][_cid]['redirect']['persistence'],
            false
          ).then(_c => {
            this.servers[_is_official][_target].client.listChannelMessages(
              this.servers[_is_official][_target].session, _cid, 1, false)
              .then(v => {
                if (v.messages.length)
                  this.channels_orig[_is_official][_target][_cid]['last_comment'] = v.messages[0].content['msg'];
              });
          }).catch(_e => {
            this.channels_orig[_is_official][_target][_cid]['status'] = 'missing';
            delete this.channels_orig[_is_official][_target][_cid]['info'];
            this.save_channels_with_less_info();
          });
        }
      });
      this.rearrange_channels();
    }
  }

  /** 채널 재정렬 후 업데이트처리  
   * after_channel_rearrange > page_key > (nakama.Channel[]) => {}
   */
  after_channel_rearrange = {};
  /** 채널 리스트 정리  
   * @return Channel[] from channel_orig
   */
  rearrange_channels() {
    let result: Channel[] = [];
    let isOfficial = Object.keys(this.channels_orig);
    isOfficial.forEach(_is_official => {
      let Targets = Object.keys(this.channels_orig[_is_official]);
      Targets.forEach(_target => {
        let ChannelIds = Object.keys(this.channels_orig[_is_official][_target]);
        ChannelIds.forEach(_cid => {
          this.channels_orig[_is_official][_target][_cid]['server'] = {
            isOfficial: _is_official,
            target: _target,
          }
          switch (this.channels_orig[_is_official][_target][_cid]['redirect']['type']) {
            case 1: // 방 대화
              console.warn('방 대화 기능 준비중...');
              break;
            case 2: // 1:1 대화
              this.channels_orig[_is_official][_target][_cid]['info'] = this.load_other_user(this.channels_orig[_is_official][_target][_cid]['redirect']['id'], _is_official, _target);
              this.channels_orig[_is_official][_target][_cid]['title'] = this.channels_orig[_is_official][_target][_cid]['info']['display_name'];
              break;
            case 3: // 그룹 대화
              if (this.channels_orig[_is_official][_target][_cid]['status'] != 'missing') {
                if (this.groups[_is_official][_target] && this.groups[_is_official][_target][this.channels_orig[_is_official][_target][_cid]['redirect']['id']]) { // 유효한 그룹인 경우
                  this.channels_orig[_is_official][_target][_cid]['info'] = this.groups[_is_official][_target][this.channels_orig[_is_official][_target][_cid]['redirect']['id']];
                  this.channels_orig[_is_official][_target][_cid]['title'] = this.groups[_is_official][_target][this.channels_orig[_is_official][_target][_cid]['redirect']['id']]['name'];
                } else this.channels_orig[_is_official][_target][_cid]['status'] = 'missing';
              }
              break;
            default:
              console.error('예상하지 않은 대화형식: ', this.channels_orig[_is_official][_target][_cid]);
              break;
          }
          result.push(this.channels_orig[_is_official][_target][_cid]);
        });
      });
    });
    let _cids = Object.keys(this.after_channel_rearrange);
    _cids.forEach(key => {
      this.after_channel_rearrange[key](result);
    });
    this.save_channels_with_less_info();
    return result;
  }

  save_channels_with_less_info() {
    let channels_copy = JSON.parse(JSON.stringify(this.channels_orig));
    let isOfficial = Object.keys(channels_copy);
    isOfficial.forEach(_is_official => {
      let Targets = Object.keys(channels_copy[_is_official]);
      Targets.forEach(_target => {
        let ChannelIds = Object.keys(channels_copy[_is_official][_target]);
        ChannelIds.forEach(_cid => {
          delete channels_copy[_is_official][_target][_cid]['img'];
          delete channels_copy[_is_official][_target][_cid]['group'];
          delete channels_copy[_is_official][_target][_cid]['info'];
          delete channels_copy[_is_official][_target][_cid]['update'];
          delete channels_copy[_is_official][_target][_cid]['presences'];
        });
      });
    });
    this.indexed.saveTextFileToUserPath(JSON.stringify(channels_copy), 'servers/channels.json');
  }

  /** base64 정보에 대해 Nakama에서 허용하는 수준으로 이미지 크기 줄이기
   * @param ev 클릭 event 또는 {}.target.result = value 로 구성된 이미지 경로
   * @param _CallBack 조율된 이미지 DataURL
   */
  limit_image_size(ev: any, _CallBack: Function = (_rv: string) => { }) {
    const SIZE_LIMIT = 245000;
    new p5((p: p5) => {
      p.setup = () => {
        p.loadImage(ev.target.result, v => {
          v.resize(window.innerWidth, window.innerWidth * v.height / v.width);
          if (v['canvas'].toDataURL().length > SIZE_LIMIT)
            check_size(v);
          _CallBack(v);
          p.remove();
        }, _e => {
          this.p5toast.show({
            text: '유효한 이미지가 아닙니다.',
          });
          p.remove();
        });
      }
      let check_size = (v: p5.Image) => {
        const RATIO = .95;
        v.resize(v.width * RATIO, v.height * RATIO);
        if (v['canvas'].toDataURL().length > SIZE_LIMIT)
          check_size(v);
      }
    });
  }

  /** 연결된 서버들에 그룹 진입 요청 시도 */
  try_add_group(_info: any) {
    let servers = this.get_all_online_server();
    servers.forEach(server => {
      server.client.joinGroup(server.session, _info.id)
        .then(_v => {
          if (!_v) console.warn('그룹 join 실패... 벤 당했을 때인듯? 향후에 검토 필');
          server.client.listGroups(
            server.session, _info['name']
          ).then(v => {
            for (let i = 0, j = v.groups.length; i < j; i++)
              if (v.groups[i].id == _info['id']) {
                let pending_group = v.groups[i];
                pending_group['status'] = 'pending';
                this.servers[server.info.isOfficial][server.info.target].client.listGroupUsers(
                  this.servers[server.info.isOfficial][server.info.target].session, v.groups[i].id
                ).then(_list => {
                  _list.group_users.forEach(_guser => {
                    let keys = Object.keys(_guser.user);
                    keys.forEach(key => this.users[server.info.isOfficial][server.info.target][_guser.user.id][key] = _guser.user[key]);
                    this.save_other_user(_guser.user.id, server.info.isOfficial, server.info.target);
                  });
                });
                this.save_group_info(pending_group, server.info.isOfficial, server.info.target);
                break;
              }
          });
        });
    });
  }

  /** 그룹 정보를 로컬에 저장하기, 원격에 이미지 업로드 */
  save_group_info(_group: any, _is_official: string, _target: string) {
    if (!this.groups[_is_official][_target]) this.groups[_is_official][_target] = {};
    this.groups[_is_official][_target][_group.id] = _group;
    this.rearrange_group_list();
    this.save_groups_with_less_info();
    this.indexed.saveTextFileToUserPath(_group['img'], `servers/${_is_official}/${_target}/groups/${_group.id}.img`);
    // 내가 그룹의 주인이라면 이미지 변경사항 업로드
    if (_group.owner == this.servers[_is_official][_target].session.user_id && _group.img)
      this.servers[_is_official][_target].client.writeStorageObjects(
        this.servers[_is_official][_target].session, [{
          collection: 'group_public',
          key: `group_${_group.id}`,
          value: { img: _group.img },
          permission_read: 2,
          permission_write: 1,
        }]
      );
  }

  /** 간소화된 그룹 정보 저장하기 */
  save_groups_with_less_info(_CallBack = () => { }) {
    let copied_group = JSON.parse(JSON.stringify(this.groups));
    let isOfficial = Object.keys(copied_group);
    isOfficial.forEach(_is_official => {
      let Target = Object.keys(copied_group[_is_official])
      Target.forEach(_target => {
        let GroupId = Object.keys(copied_group[_is_official][_target]);
        GroupId.forEach(_gid => {
          delete copied_group[_is_official][_target][_gid]['server'];
          delete copied_group[_is_official][_target][_gid]['img'];
          if (copied_group[_is_official][_target][_gid]['users'])
            copied_group[_is_official][_target][_gid]['users'].forEach(User => {
              delete User['state'];
              User['user'] = { id: User['user']['id'] };
            });
        });
      });
    });
    this.indexed.saveTextFileToUserPath(JSON.stringify(copied_group), 'servers/groups.json');
    _CallBack();
  }

  /** 그룹 리스트 로컬/리모트에서 삭제하기 (방장일 경우) */
  remove_group_list(info: any, _is_official: string, _target: string) {
    // 내가 방장이면 해산처리
    if (this.servers[_is_official][_target] && info['creator_id'] == this.servers[_is_official][_target].session.user_id)
      this.servers[_is_official][_target].client.deleteGroup(
        this.servers[_is_official][_target].session, info['id'],
      ).then(v => {
        if (v && info['img']) { // 서버에서 정상삭제하였을 때
          this.servers[_is_official][_target].client.deleteStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: 'group_public',
              key: `group_${info['id']}`,
            }]
          });
        }
      }).catch(e => {
        console.error('remove_group_list: ', e);
      });
    // 로컬에서 기록을 삭제한다
    delete this.groups[_is_official][_target][info['id']];
    this.rearrange_group_list();
    this.save_groups_with_less_info();
    this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/groups/${info.id}.img`);
  }

  /** 자신이 참여한 그룹을 리모트에서 가져오기 */
  get_group_list(_is_official: string, _target: string) {
    if (!this.groups[_is_official]) this.groups[_is_official] = {};
    if (!this.groups[_is_official][_target]) this.groups[_is_official][_target] = {};
    this.servers[_is_official][_target].client.listUserGroups(
      this.servers[_is_official][_target].session,
      this.servers[_is_official][_target].session.user_id)
      .then(v => {
        v.user_groups.forEach(user_group => {
          if (!this.groups[_is_official][_target][user_group.group.id]) { // 로컬에 없던 그룹은 이미지 확인
            this.groups[_is_official][_target][user_group.group.id] = {};
            this.servers[_is_official][_target].client.readStorageObjects(
              this.servers[_is_official][_target].session, {
              object_ids: [{
                collection: 'group_public',
                key: `group_${user_group.group.id}`,
                user_id: user_group.group.creator_id,
              }],
            }).then(gimg => {
              if (gimg.objects.length) {
                this.groups[_is_official][_target][user_group.group.id]['img'] = gimg.objects[0].value['img'];
                this.indexed.saveTextFileToUserPath(gimg.objects[0].value['img'], `servers/${_is_official}/${_target}/groups/${user_group.group.id}.img`);
              }
            });
          }
          this.groups[_is_official][_target][user_group.group.id]
            = { ...this.groups[_is_official][_target][user_group.group.id], ...user_group.group };
          this.servers[_is_official][_target].socket.joinChat(user_group.group.id, 3, true, false)
            .then(c => {
              c['redirect'] = {
                id: user_group.group.id,
                type: 3,
                persistence: true,
              };
              this.groups[_is_official][_target][user_group.group.id]['channel_id'] = c.id;
              this.add_channels(c, _is_official, _target);
              this.save_groups_with_less_info();
            });
        });
      });
  }

  /** 그룹을 재배열화한 후에 */
  after_rearrange_group = {};
  /** 모든 그룹 리스트를 배열로 돌려주기 */
  rearrange_group_list() {
    let result: Group[] = [];
    let isOfficial = Object.keys(this.groups);
    isOfficial.forEach(_is_official => {
      let Target = Object.keys(this.groups[_is_official]);
      Target.forEach(_target => {
        let groupId = Object.keys(this.groups[_is_official][_target])
        groupId.forEach(_gid => {
          if (this.servers[_is_official][_target])
            this.groups[_is_official][_target][_gid]['server'] = this.servers[_is_official][_target].info;
          else this.groups[_is_official][_target][_gid]['server'] = {
            name: '삭제된 서버',
            isOfficial: _is_official,
            target: _target,
          }
          result.push(this.groups[_is_official][_target][_gid]);
        });
      });
    });
    let keys = Object.keys(this.after_rearrange_group);
    keys.forEach(key => this.after_rearrange_group[key](result));
    return result;
  }

  /** 그룹 서버 및 설정-그룹서버의 상태 조정 */
  set_group_statusBar(_status: 'offline' | 'missing' | 'pending' | 'online' | 'certified', _is_official: string, _target: string) {
    this.statusBar.groupServer[_is_official][_target] = _status;
    this.catch_group_server_header(_status);
  }

  /** 채널 상태 검토 */
  count_channel_online_member(p: any, _is_official: string, _target: string) {
    let result_status = 'pending';
    if (p['group_id']) { // 그룹 채널인 경우
      let user_length = this.groups[_is_official][_target][p['group_id']]['users'].length;
      if (user_length == 1) result_status = 'online'; // 그룹에 혼자만 있음
      else for (let i = 0; i < user_length; i++) { // 2명 이상의 그룹원
        let userId = this.groups[_is_official][_target][p['group_id']]['users'][i]['user']['id'];
        if (!this.groups[_is_official][_target][p['group_id']]['users'][i]['is_me'])
          if (this.users[_is_official][_target][userId]['online']) {
            result_status = 'online';
            break;
          }
      }
    } else if (p['user_id_one']) { // 1:1 채팅인 경우
      let targetId = this.channels_orig[_is_official][_target][p.channel_id]['redirect']['id'];
      result_status = this.users[_is_official][_target][targetId]['online'] ? 'online' : 'pending';
    }
    this.channels_orig[_is_official][_target][p.channel_id]['status'] = result_status;
  }

  /** 소켓이 행동할 때 행동중인 무언가가 있을 경우 검토하여 처리 */
  socket_reactive = {};
  /** 소켓 서버에 연결 */
  connect_to(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _CallBack = () => { }) {
    this.servers[_is_official][_target].socket.connect(
      this.servers[_is_official][_target].session, true).then(_v => {
        let socket = this.servers[_is_official][_target].socket;
        _CallBack();
        // 실시간으로 알림을 받은 경우
        socket.onnotification = (v) => {
          console.log('소켓에서 실시간으로 무언가 받음: ', v);
          this.act_on_notification(v, _is_official, _target);
          this.rearrange_notifications();
        }
        socket.onchannelpresence = (p) => {
          if (p.joins !== undefined) { // 참여 검토
            p.joins.forEach(info => {
              if (this.servers[_is_official][_target].session.user_id != info.user_id)
                this.users[_is_official][_target][info.user_id]['online'] = true;
            });
            this.count_channel_online_member(p, _is_official, _target);
          } else if (p.leaves !== undefined) { // 떠남 검토
            let others = [];
            p.leaves.forEach(info => {
              if (this.servers[_is_official][_target].session.user_id != info.user_id) {
                delete this.users[_is_official][_target][info.user_id]['online'];
                others.push(info.user_id);
              }
            });
            this.servers[_is_official][_target].client.getUsers(
              this.servers[_is_official][_target].session, others).then(v => {
                if (v.users.length)
                  v.users.forEach(_user => {
                    let keys = Object.keys(_user);
                    keys.forEach(key => this.users[_is_official][_target][_user.id][key] = _user[key]);
                    this.save_other_user(_user, _is_official, _target);
                  });
                this.count_channel_online_member(p, _is_official, _target);
              });
          }
        }
        socket.onchannelmessage = (c) => {
          console.log('onchamsg: ', c);
          this.update_from_channel_msg(c, _is_official, _target);
          this.save_channels_with_less_info();
        }
        socket.ondisconnect = (_e) => {
          this.p5toast.show({
            text: `그룹서버 연결 끊어짐: ${this.servers[_is_official][_target].info.name}`,
          });
          this.set_group_statusBar('offline', _is_official, _target);
          if (this.channels_orig[_is_official] && this.channels_orig[_is_official][_target]) {
            let channel_ids = Object.keys(this.channels_orig[_is_official][_target]);
            channel_ids.forEach(_cid => {
              if (this.channels_orig[_is_official][_target][_cid]['status'] != 'missing')
                delete this.channels_orig[_is_official][_target][_cid]['status'];
            });
          }
          if (this.groups[_is_official] && this.groups[_is_official][_target]) {
            let groups_id = Object.keys(this.groups[_is_official][_target]);
            groups_id.forEach(_gid => {
              this.groups[_is_official][_target][_gid]['status'] = 'offline';
            });
          }
        }
      });
  }

  /** 채널 메시지를 변조 후 전파하기 */
  update_from_channel_msg(msg: ChannelMessage, _is_official: string, _target: string) {
    let c = this.modulation_channel_message(msg, _is_official, _target);
    if (this.channels_orig[_is_official][_target][c.channel_id]['update'])
      this.channels_orig[_is_official][_target][c.channel_id]['update'](c);
    this.channels_orig[_is_official][_target][c.channel_id]['last_comment'] = c.content['msg'];
  }

  modulation_channel_message(c: ChannelMessage, _is_official: string, _target: string) {
    let is_me = c.sender_id == this.servers[_is_official][_target].session.user_id;
    let target = is_me ? this.users.self : this.load_other_user(c.sender_id, _is_official, _target);
    switch (c.code) {
      case 0: // 사용자가 작성한 일반적인 메시지
        if (c.content['update']) // 그룹 정보 업데이트
          this.update_group_info(c, _is_official, _target);
        if (c.content['user']) // 그룹 사용자 정보 변경
          this.update_group_user_info(c, _is_official, _target);
        break;
      case 4: // 채널에 새로 들어온 사람 알림
      case 5: // 그룹에 있던 사용자 나감(들어오려다가 포기한 사람 포함)
      case 6: // 누군가 그룹에서 내보내짐 (kick)
        if (this.socket_reactive['settings'])
          this.socket_reactive['settings'].load_groups();
        if (this.socket_reactive['group_detail']) // 그룹 상세를 보는 중이라면 업데이트하기
          this.socket_reactive['group_detail'].update_GroupUsersList(_is_official, _target);
        // 행동에서 자동으로 메시지 생성
        switch (c.code) {
          case 4: // join
            c.content['user'] = target;
            c.content['msg'] = `사용자 그룹참여-${target['display_name']}`;
            break;
          case 5: // out
            console.warn('그룹원 탈퇴와 참여 예정자의 포기를 구분할 수 있는지: ', c);
            c.content['user'] = target;
            c.content['msg'] = `사용자 그룹탈퇴-${target['display_name']}`;
          case 6: // kick
            c.content['msg'] = `사용자 강제퇴장-${target['display_name']}`;

            break;
          default:
            console.warn('예상하지 못한 메시지 코드: ', c);
            break;
        }
        if (c.code == 4) break;
        // 사용자 유입과 관련된 알림 제거
        if (this.noti_origin[_is_official] && this.noti_origin[_is_official][_target]) {
          let keys = Object.keys(this.noti_origin[_is_official][_target]);
          let empty_ids = [];
          keys.forEach(key => {
            if (this.noti_origin[_is_official][_target][key]['code'] == -5
              && this.noti_origin[_is_official][_target][key]['sender_id'] == c.sender_id)
              empty_ids.push(key);
          });
          this.servers[_is_official][_target].client.deleteNotifications(
            this.servers[_is_official][_target].session, empty_ids).then(v => {
              if (!v) console.warn('사용하지 않는 알림 삭제 후 오류');
              this.update_notifications(_is_official, _target);
            });
        }
        if (is_me) { // 그 유입 주체가 나야
          this.channels_orig[_is_official][_target][c.channel_id]['status'] = 'missing';
          delete this.channels_orig[_is_official][_target][c.channel_id]['info'];
          this.groups[_is_official][_target][c['group_id']]['status'] = 'missing';
        }
        break;
      default:
        console.warn('예상하지 못한 채널 메시지 코드: ', c.code);
        break;
    }
    return c;
  }

  /** 그룹 정보 변경 처리 */
  update_group_info(c: ChannelMessage, _is_official: string, _target: string) {
    switch (c.content['update']) {
      case 'image': // 그룹 이미지가 변경됨
        this.servers[_is_official][_target].client.readStorageObjects(
          this.servers[_is_official][_target].session, {
          object_ids: [{
            collection: 'group_public',
            key: `group_${c.group_id}`,
            user_id: c.sender_id,
          }]
        }).then(v => {
          if (v.objects.length) {
            this.groups[_is_official][_target][c.group_id]['img'] = v.objects[0].value['img'].replace(/"|=|\\/g, '');
            this.indexed.saveTextFileToUserPath(v.objects[0].value['img'], `servers/${_is_official}/${_target}/groups/${c.group_id}.img`);
          } else {
            delete this.groups[_is_official][_target][c.group_id]['img'];
            this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/groups/${c.group_id}.img`);
          }
        });
        break;
      case 'info': // 그룹 정보가 변경됨
        this.servers[_is_official][_target].client.listGroups(
          this.servers[_is_official][_target].session, c.content['name']).then(v => {
            let keys = Object.keys(v.groups[0]);
            keys.forEach(key => this.groups[_is_official][_target][v.groups[0].id][key] = v.groups[0][key]);
          });
        break;
      case 'remove': // 그룹이 삭제됨
        this.groups[_is_official][_target][c.group_id]['status'] = 'missing';
        delete this.groups[_is_official][_target][c.group_id]['img'];
        this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/groups/${c.group_id}.img`);
        let users = Object.keys(this.groups[_is_official][_target][c.group_id]['users']);
        users.forEach(userId => {
          delete this.groups[_is_official][_target][c.group_id]['users'][userId]['user']['state'];
          this.groups[_is_official][_target][c.group_id]['users'][userId]['user']['status'] = 'missing';
        });
        this.channels_orig[_is_official][_target][c.channel_id]['status'] = 'missing';
        break;
      default:
        console.warn('예상하지 못한 그룹 행동: ', c);
        break;
    }
  }

  /** 그룹 사용자 상태 변경 처리 */
  update_group_user_info(c: ChannelMessage, _is_official: string, _target: string) {
    switch (c.content['user']) {
      case 'modify': // 프로필 또는 이미지가 변경됨
        this.servers[_is_official][_target].client.readStorageObjects(
          this.servers[_is_official][_target].session, {
          object_ids: [{
            collection: 'user_public',
            key: 'profile_image',
            user_id: c.sender_id,
          }]
        }).then(v => {
          if (v.objects.length) {
            if (this.socket_reactive['others-profile']) {
              this.socket_reactive['others-profile'](v.objects[0].value['img']);
            } else {
              this.users[_is_official][_target][c.sender_id]['img'] = v.objects[0].value['img'];
              this.users[_is_official][_target][c.sender_id]['avatar_url'] = v.objects[0].version;
              this.save_other_user(this.users[_is_official][_target][c.sender_id], _is_official, _target);
            }
          } else {
            if (this.socket_reactive['others-profile'])
              this.socket_reactive['others-profile']('');
            delete this.users[_is_official][_target][c.sender_id]['img'];
            this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/users/${c.sender_id}/profile.img`)
          }
        });
        break;
      default:
        console.warn('예상하지 못한 그룹 사용자 행동: ', c);
        break;
    }
  }

  /** 알림 내용 클릭시 행동 */
  check_notifications(this_noti: Notification, _is_official: string, _target: string) {
    console.log('해당 알림 내용: ', this_noti);
    let this_server = this.servers[_is_official][_target];
    switch (this_noti.code) {
      case 0: // 예약된 알림
        break;
      case -2: // 친구 요청 받음
        break;
      case -1: // 오프라인이거나 채널에 없을 때 알림받음
      case -3: // 상대방이 친구 요청 수락
      case -4: // 상대방이 그룹 참가 수락
      case -6: // 친구가 다른 게임에 참여
        this.noti.ClearNoti(this_noti['id']);
        this.noti.RemoveListener(`check${this_noti.code}`);
        this.noti.CancelNotificationById(this_noti.code);
        this_server.client.deleteNotifications(this_server.session, [this_noti['id']])
          .then(v => {
            if (!v) console.warn('알림 거부처리 검토 필요');
            this.update_notifications(_is_official, _target);
          });
        break;
      case -5: // 그룹 참가 요청 받음
        this_server.client.getUsers(this_server.session, [this_noti['sender_id']])
          .then(v => {
            if (v.users.length) {
              let msg = '';
              msg += `서버: ${this_noti['server']['name']}<br>`;
              msg += `사용자명: ${v.users[0].display_name}`;
              this.alertCtrl.create({
                header: '그룹 참가 요청',
                message: msg,
                buttons: [{
                  text: '수락',
                  handler: () => {
                    this_server.client.addGroupUsers(this_server.session, this_noti['content']['group_id'], [v.users[0].id])
                      .then(v => {
                        if (!v) console.warn('밴인 경우인 것 같음, 확인 필요');
                        this_server.client.deleteNotifications(this_server.session, [this_noti['id']])
                          .then(b => {
                            if (b) this.update_notifications(_is_official, _target);
                            else console.warn('알림 지우기 실패: ', b);
                          });
                      });
                  }
                }, {
                  text: '거절',
                  handler: () => {
                    this_server.client.kickGroupUsers(this_server.session, this_noti['content']['group_id'], [v.users[0].id])
                      .then(b => {
                        if (!b) console.warn('그룹 참여 거절을 kick한 경우 오류');
                        this_server.client.deleteNotifications(this_server.session, [this_noti['id']]);
                        this.update_notifications(_is_official, _target);
                      })
                  }
                }],
              }).then(v => v.present());
            } else {
              this_server.client.deleteNotifications(this_server.session, [this_noti['id']])
                .then(b => {
                  if (!b) console.warn('알림 거부처리 검토 필요');
                  this.p5toast.show({
                    text: '만료된 알림: 사용자 없음',
                  })
                  this.update_notifications(_is_official, _target);
                });
            }
          });
        break;
      case -7: // 서버에서 단일 세션 연결 허용시 끊어진 것에 대해
        break;
      default:
        console.warn('예상하지 못한 알림 구분: ', this_noti.code);
        break;
    }
  }

  /** 들어오는 알림에 반응하기 */
  act_on_notification(v: Notification, _is_official: string, _target: string) {
    let is_removed = false;
    v['server'] = this.servers[_is_official][_target].info;
    switch (v.code) {
      case 0: // 예약된 알림
        v['request'] = `${v.code}-${v.subject}`;
        break;
      case -1: // 오프라인이거나 채널에 없을 때 알림 받음
        // 모든 채팅에 대한건지, 1:1에 한정인지 검토 필요
        console.log('채널에 없을 때 받은 메시지란..: ', v);
        let targetType: number;
        if (v['content'] && v['content']['username'])
          targetType = 2;
        // 요청 타입을 구분하여 자동반응처리
        switch (targetType) {
          case 2: // 1:1 채팅
            this.servers[_is_official][_target].socket.joinChat(
              v['sender_id'], targetType, true, false,
            ).then(c => {
              c['redirect'] = {
                id: v['sender_id'],
                type: targetType,
                persistence: true,
              };
              this.servers[_is_official][_target].client.listChannelMessages(
                this.servers[_is_official][_target].session, c.id, 1, false).then(m => {
                  if (m.messages.length) {
                    c['last_comment'] = m.messages[0].content['msg'];
                    this.update_from_channel_msg(m.messages[0], _is_official, _target);
                  }
                });
              // 방 이미지를 상대방 이미지로 설정
              c['img'] = this.load_other_user(v.sender_id, _is_official, _target)['img'];
              // 방 이름을 상대방 이름으로 설정
              this.servers[_is_official][_target].client.getUsers(
                this.servers[_is_official][_target].session, [v['sender_id']]
              ).then(info => {
                c['title'] = info.users[0].display_name;
                c['info'] = info.users[0];
                this.save_other_user(info.users[0], _is_official, _target);
              });
              this.add_channels(c, _is_official, _target);
              this.servers[_is_official][_target].client.deleteNotifications(
                this.servers[_is_official][_target].session, [v['id']]).then(b => {
                  if (b) this.update_notifications(_is_official, _target);
                  else console.warn('알림 지우기 실패: ', b);
                });
            });
            break;
          default:
            console.warn('예상하지 못한 알림 행동처리: ', v, targetType);
            v['request'] = `${v.code}-${v.subject}`;
            break;
        }
        break;
      case -2: // 친구 요청 받음
        v['request'] = `${v.code}-${v.subject}`;
        break;
      case -3: // 상대방이 친구 요청 수락
        v['request'] = `${v.code}-${v.subject}`;
        break;
      case -4: // 상대방이 그룹 참가 수락
        if (this.socket_reactive['group_detail'] && this.socket_reactive['group_detail'].info.id == v.content['group_id'])
          this.socket_reactive['group_detail'].update_from_notification(v);
        if (this.socket_reactive['settings'])
          this.socket_reactive['settings'].load_groups();
        this.groups[_is_official][_target][v.content['group_id']]['status'] = 'online';
        v['request'] = `${v.code}-${v.subject}`;
        this.rearrange_notifications();
        this.noti.SetListener(`check${v.code}`, (_v: any) => {
          this.noti.ClearNoti(_v['id']);
          this.noti.RemoveListener(`check${v.code}`);
          this.check_notifications(v, _is_official, _target);
        });
        this.servers[_is_official][_target].client.readStorageObjects(
          this.servers[_is_official][_target].session, {
          object_ids: [{
            collection: 'group_public',
            key: `group_${v.content['group_id']}`,
            user_id: this.groups[_is_official][_target][v.content['group_id']].creator_id,
          }]
        }).then(img => {
          if (img.objects.length) {
            this.groups[_is_official][_target][v.content['group_id']]['img'] = img.objects[0].value['img'];
            this.indexed.saveTextFileToUserPath(img.objects[0].value['img'], `servers/${_is_official}/${_target}/groups/${v.content['group_id']}.img`);
          }
        });
        this.servers[_is_official][_target].socket.joinChat(
          v.content['group_id'], 3, true, false).then(c => {
            c['redirect'] = {
              id: v.content['group_id'],
              type: 3,
              persistence: true,
            };
            c['status'] = 'online';
            this.groups[_is_official][_target][v.content['group_id']]['channel_id'] = c.id;
            this.add_channels(c, _is_official, _target);
            this.servers[_is_official][_target].client.listChannelMessages(
              this.servers[_is_official][_target].session, c.id, 1, false)
              .then(v => {
                if (v.messages.length) {
                  this.channels_orig[_is_official][_target][c.id]['last_comment'] = v.messages[0].content['msg'];
                  this.update_from_channel_msg(v.messages[0], _is_official, _target);
                }
              });
          });
        this.noti.PushLocal({
          id: v.code,
          title: '검토해야할 연결이 있습니다.',
          body: v.subject,
          actions_ln: [{
            id: `check${v.code}`,
            title: '확인',
          }],
          icon: this.groups[_is_official][_target][v.content['group_id']['img']],
          smallIcon_ln: 'diychat',
          iconColor_ln: '271e38',
        }, undefined, (_ev: any) => {
          this.check_notifications(v, _is_official, _target);
        });
        break;
      case -5: // 그룹 참가 요청 받음
        let group_info = this.groups[_is_official][_target][v.content['group_id']];
        if (group_info) {
          v['request'] = `그룹참가 요청: ${group_info['name']}`;
        } else {
          is_removed = true;
          this.servers[_is_official][_target].client.deleteNotifications(
            this.servers[_is_official][_target].session, [v.id]
          ).then(b => {
            if (b) this.update_notifications(_is_official, _target);
            else console.warn('알림 지우기 실패: ', b);
          });
        }
        this.rearrange_notifications();
        // 이미 보는 화면이라면 업데이트하기
        if (this.socket_reactive['settings'])
          this.socket_reactive['settings'].load_groups();
        if (this.socket_reactive['group_detail'] && this.socket_reactive['group_detail'].info.id == v.content['group_id'])
          this.socket_reactive['group_detail'].update_from_notification(v);
        this.noti.SetListener(`check${v.code}`, (_v: any) => {
          this.noti.ClearNoti(_v['id']);
          this.noti.RemoveListener(`check${v.code}`);
          if (this.socket_reactive['group_detail']) return;
          this.modalCtrl.create({
            component: GroupDetailPage,
            componentProps: { info: this.groups[_is_official][_target][v.content['group_id']] },
          }).then(v => v.present());
        });
        this.noti.PushLocal({
          id: v.code,
          title: `${this.groups[_is_official][_target][v.content['group_id']]['name']} 그룹에 참가 요청`,
          actions_ln: [{
            id: `check${v.code}`,
            title: '검토',
          }],
          icon: this.groups[_is_official][_target][v.content['group_id']]['img'],
          smallIcon_ln: 'diychat',
          iconColor_ln: '271e38',
        }, undefined, (_ev: any) => {
          if (this.socket_reactive['group_detail'].info.id == v.content['group_id']) return;
          this.modalCtrl.create({
            component: GroupDetailPage,
            componentProps: { info: this.groups[_is_official][_target][v.content['group_id']] },
          }).then(v => v.present());
        });
        break;
      case -6: // 친구가 다른 게임에 참여
        v['request'] = `${v.code}-${v.subject}`;
        break;
      case -7: // 서버에서 단일 세션 연결 허용시 끊어진 것에 대해
        v['request'] = `${v.code}-${v.subject}`;
        break;
      default:
        console.warn('확인되지 않은 실시간 알림_nakama_noti: ', v);
        v['request'] = `${v.code}-${v.subject}`;
        break;
    }
    if (is_removed) return;
    if (!this.noti_origin[_is_official]) this.noti_origin[_is_official] = {};
    if (!this.noti_origin[_is_official][_target]) this.noti_origin[_is_official][_target] = {};
    this.noti_origin[_is_official][_target][v.id] = v;
    this.rearrange_notifications();
  }
}
