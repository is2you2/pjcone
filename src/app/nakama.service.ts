// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Channel, ChannelMessage, Client, Group, GroupUser, Notification, Session, Socket, User, WriteStorageObject } from "@heroiclabs/nakama-js";
import { isPlatform } from './app.component';
import { IndexedDBService } from './indexed-db.service';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';
import * as p5 from 'p5';
import { LocalNotiService } from './local-noti.service';
import { AlertController, ModalController } from '@ionic/angular';
import { GroupDetailPage } from './portal/settings/group-detail/group-detail.page';
import { WscService } from './wsc.service';
import { ChatRoomPage } from './portal/subscribes/chat-room/chat-room.page';
import { ApiReadStorageObjectId } from '@heroiclabs/nakama-js/dist/api.gen';
import { LanguageSettingService } from './language-setting.service';
import { AdMob } from '@capacitor-community/admob';
import { AddTodoMenuPage } from './portal/main/add-todo-menu/add-todo-menu.page';
import { GlobalActService } from './global-act.service';
import { MinimalChatPage } from './minimal-chat/minimal-chat.page';
import { ServerDetailPage } from './portal/settings/group-server/server-detail/server-detail.page';
import { WeblinkService } from './weblink.service';
import { ToolServerService, UnivToolForm } from './tool-server.service';
import { QrSharePage } from './portal/settings/qr-share/qr-share.page';

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
    private lang: LanguageSettingService,
    private global: GlobalActService,
    private tools: ToolServerService,
    private weblink: WeblinkService,
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
      // 'default': {
      //   info: {
      //     name: '개발 테스트 서버', // lang.CallbackOnce 에서 처리됨
      //     address: SOCKET_SERVER_ADDRESS,
      //     isOfficial: 'official',
      //     target: 'default',
      //     key: 'defaultkey',
      //     port: 7350,
      //     useSSL: true,
      //   }
      // }
    },
    'unofficial': {},
  };

  initialize() {
    // 기등록 알림 id 검토
    this.noti.GetNotificationIds((list) => {
      this.registered_id = list;
      this.set_todo_notification();
    });
    // 개인 정보 설정
    this.indexed.loadTextFromUserPath('link-account', (e, v) => {
      if (e && v) this.uuid = v;
      else this.uuid = this.device.uuid;
    });
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
    // this.lang.Callback_nakama = (DevTestServer: string) => {
    //   this.servers['official']['default'].info.name = DevTestServer;
    // }
    // 공식서버 연결처리
    // this.init_server(this.servers['official']['default'].info);
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
            useSSL: Boolean(sep[6] == 'true'),
          }
          this.servers['unofficial'][info.target] = {};
          this.servers['unofficial'][info.target].info = info;
          this.init_server(info);
        });
      }
      this.catch_group_server_header('offline');
    });
    // 마지막 상태바 정보 불러오기: 사용자의 연결 여부 의사가 반영되어있음
    this.indexed.loadTextFromUserPath('servers/list.json', (e, v) => {
      if (e && v)
        this.statusBar.groupServer = JSON.parse(v);
      let isOfficial = Object.keys(this.statusBar.groupServer);
      isOfficial.forEach(_is_official => {
        if (!this.servers[_is_official])
          delete this.statusBar.groupServer[_is_official];
        else {
          let Target = Object.keys(this.statusBar.groupServer[_is_official]);
          Target.forEach(_target => {
            if (!this.servers[_is_official][_target])
              delete this.statusBar.groupServer[_is_official][_target];
          });
        }
      });
      if (this.users.self['online'])
        this.init_all_sessions();
    });
    // 전송중이던 파일 기록을 가져오기
    this.indexed.GetFileListFromDB('/transfer.history', list => {
      list.forEach(path => {
        this.indexed.loadTextFromUserPath(path, (e, v) => {
          if (e && v) {
            let sep = path.split('/');
            let _is_official: string = sep[1];
            let _target: string = sep[2];
            let _channel_id: string = sep[4];
            if (!this.channel_transfer[_is_official][_target]) this.channel_transfer[_is_official][_target] = {};
            if (!this.channel_transfer[_is_official][_target][_channel_id]) this.channel_transfer[_is_official][_target][_channel_id] = {};
            this.channel_transfer[_is_official][_target][_channel_id] = JSON.parse(v);
          }
        });
      });
    });
  }
  /** 시작시 해야할 일 알림을 설정 (웹 전용) */
  set_todo_notification() {
    if (isPlatform == 'DesktopPWA') { // 웹 알림을 페이지에 추가
      this.indexed.GetFileListFromDB('info.todo', _list => {
        _list.forEach(info => {
          this.indexed.loadTextFromUserPath(info, (e, v) => {
            if (e && v) {
              let noti_info = JSON.parse(v);
              let schedule_at = new Date(noti_info.limit).getTime() - new Date().getTime();
              if (!noti_info['done'] && schedule_at > 0) {
                let schedule = setTimeout(() => {
                  this.noti.PushLocal({
                    id: noti_info.noti_id,
                    title: noti_info.title,
                    body: noti_info.description,
                  }, undefined, (_ev) => {
                    this.modalCtrl.create({
                      component: AddTodoMenuPage,
                      componentProps: {
                        godot: this.global.godot.contentWindow || this.global.godot.contentDocument,
                        data: v,
                      },
                    }).then(v => v.present());
                  });
                }, schedule_at);
                this.web_noti_id[noti_info.noti_id] = schedule;
              }
            }
          });
        });
      });
    } else if (isPlatform != 'MobilePWA') { // 앱 업데이트시 삭제되는 알림들을 재등록
      this.indexed.GetFileListFromDB('info.todo', _list => {
        _list.forEach(info => {
          this.indexed.loadTextFromUserPath(info, (e, v) => {
            if (e && v) {
              let noti_info = JSON.parse(v);
              let schedule_at = new Date(noti_info.limit).getTime();
              let not_registered = true;
              for (let i = 0, j = this.registered_id.length; i < j; i++)
                if (this.registered_id[i] == noti_info.id) {
                  this.registered_id.splice(i, 1);
                  not_registered = false;
                  break;
                }
              if (!noti_info['done'] && not_registered && schedule_at > new Date().getTime()) {
                let color = '00bbbb'; // 메모
                switch (noti_info.importance) {
                  case '1': // 기억해야 함
                    color = 'dddd0c';
                    break;
                  case '2': // 중요함
                    color = '880000';
                    break;
                }
                this.noti.PushLocal({
                  id: noti_info.noti_id,
                  title: noti_info.title,
                  body: noti_info.description,
                  smallIcon_ln: 'todo',
                  iconColor_ln: color,
                  group_ln: 'todo',
                  triggerWhen_ln: {
                    at: new Date(noti_info.limit),
                  },
                  extra_ln: {
                    page: {
                      component: 'AddTodoMenuPage',
                      componentProps: {
                        data: JSON.stringify(noti_info),
                      },
                    },
                  },
                });
              }
            }
          });
        });
      });
    }
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

  isBannerShowing = false;
  appMargin: number;
  async resumeBanner() {
    if (!this.isBannerShowing) return;
    const result = await AdMob.resumeBanner()
      .catch(e => console.log(e));
    if (result === undefined) {
      return;
    }

    const app: HTMLElement = document.querySelector('ion-router-outlet');
    app.style.marginBottom = this.appMargin + 'px';
  }

  async removeBanner() {
    if (!this.isBannerShowing) return;
    const result = await AdMob.hideBanner()
      .catch(e => console.log(e));
    if (result === undefined) {
      return;
    }

    const app: HTMLElement = document.querySelector('ion-router-outlet');
    app.style.marginBottom = '0px';
  }

  /** subscribe과 localPush의 채팅방 입장 행동을 통일함 */
  go_to_chatroom_without_admob_act(v: HTMLIonModalElement) {
    this.removeBanner();
    this.has_new_channel_msg = false;
    v.onWillDismiss().then(() => this.resumeBanner());
    v.present();
    this.rearrange_channels();
    this.save_channels_with_less_info();
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

  /** 모든 서버 로그아웃처리 */
  logout_all_server() {
    let IsOfficials = Object.keys(this.statusBar.groupServer);
    IsOfficials.forEach(_is_official => {
      let Targets = Object.keys(this.statusBar.groupServer[_is_official]);
      Targets.forEach(_target => {
        if (this.statusBar.groupServer[_is_official][_target] == 'online') {
          this.statusBar.groupServer[_is_official][_target] = 'pending';
          this.catch_group_server_header('pending');
          if (this.servers[_is_official][_target].session)
            this.servers[_is_official][_target].client.sessionLogout(
              this.servers[_is_official][_target].session,
              this.servers[_is_official][_target].session.token,
              this.servers[_is_official][_target].session.refresh_token,
            );
          if (this.servers[_is_official][_target].socket)
            this.servers[_is_official][_target].socket.disconnect(true);
        }
      });
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
        text: `${this.lang.text['Nakama']['AlreadyHaveTargetName']}: ${info.target || info.name}`,
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
    let finally_status = _temporary;
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
      switch (e.status) {
        case 400: // 이메일/비번이 없거나 하는 등, 요청 정보가 잘못됨
          if (this.uuid)
            this.p5toast.show({
              text: this.lang.text['Nakama']['NeedLoginInfo'],
            });
          else this.p5toast.show({
            text: this.lang.text['Nakama']['NeedLinkUser'],
          });
          this.users.self['online'] = false;
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
        case 401: // 비밀번호 잘못됨
          this.p5toast.show({
            text: this.lang.text['Nakama']['NeedAccountReset'],
          });
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
        case 404: // 아이디 없음
          this.servers[info.isOfficial][info.target].session = await this.servers[info.isOfficial][info.target].client.authenticateEmail(this.users.self['email'], this.uuid, true);
          if (this.users.self['display_name'])
            this.servers[info.isOfficial][info.target].client.updateAccount(
              this.servers[info.isOfficial][info.target].session, {
              display_name: this.users.self['display_name'],
              lang_tag: this.lang.lang,
            });
          this.p5toast.show({
            text: `${this.lang.text['Nakama']['RegisterUserSucc']}: ${info.target}`,
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
            text: `${this.lang.text['Nakama']['UnexpectedLoginErr']}: ${e}`,
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
    // 커뮤니티 서버를 쓰는 관리자모드 검토
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
      });
    // 단발적으로 다른 사용자 정보 업데이트
    if (this.groups[_is_official][_target])
      this.instant_group_user_update(_is_official, _target);
    // 통신 소켓 연결하기
    this.connect_to(_is_official, _target, () => {
      this.get_group_list(_is_official, _target);
      if (!this.noti_origin[_is_official]) this.noti_origin[_is_official] = {};
      if (!this.noti_origin[_is_official][_target]) this.noti_origin[_is_official][_target] = {};
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
                keys.forEach(key => this.load_other_user(_userinfo.users[0].id, _is_official, _target)[key] = _userinfo.users[0][key]);
              }
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

  /** 불러와진 모든 사용자를 배열로 돌려주기  
   * 설정 화면에서 벗어날 때 사용자 정보를 최소로 줄이기 위해 불러와짐
   */
  rearrange_all_user() {
    let result: User[] = [];
    let isOfficial = Object.keys(this.users);
    isOfficial.forEach(_is_official => {
      if (_is_official != 'self') {
        let Target = Object.keys(this.users[_is_official]);
        Target.forEach(_target => {
          let UserIds = Object.keys(this.users[_is_official][_target]);
          UserIds.forEach(_uid => {
            result.push(this.users[_is_official][_target][_uid]);
          });
        });
      }
    });
    return result;
  }

  /** 다른 사람의 정보 반환해주기 (로컬 정보 기반)
   * @returns 다른 사람 정보: User
   */
  load_other_user(userId: string, _is_official: string, _target: string) {
    if (!this.users[_is_official][_target]) this.users[_is_official][_target] = {};
    if (!this.users[_is_official][_target][userId]) {
      this.users[_is_official][_target][userId] = {};
      this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/users/${userId}/profile.json`, (e, v) => {
        if (e && v) {
          let data = JSON.parse(v);
          let keys = Object.keys(data);
          keys.forEach(key => this.users[_is_official][_target][userId][key] = data[key]);
        }
      });
    }
    if (!this.users[_is_official][_target][userId]['img'])
      this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/users/${userId}/profile.img`, (e, v) => {
        if (e && v) {
          this.users[_is_official][_target][userId]['img'] = v.replace(/"|=|\\/g, '');
        } else if (this.users[_is_official][_target][userId]['avatar_url'])
          if (this.statusBar.groupServer[_is_official][_target] == 'online')
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
              this.save_other_user(this.users[_is_official][_target][userId], _is_official, _target);
            }).catch(_e => {
              if (this.users[_is_official][_target][userId]['img']) {
                delete this.users[_is_official][_target][userId]['img'];
                this.save_other_user(this.users[_is_official][_target][userId], _is_official, _target);
              }
            });
      });
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
    else this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/users/${userInfo['id']}/profile.img`);
  }

  /** 서버로부터 알림 업데이트하기 (알림 리스트 재정렬 포함됨) */
  update_notifications(_is_official: string, _target: string) {
    this.servers[_is_official][_target].client.listNotifications(this.servers[_is_official][_target].session, 1)
      .then(v => {
        this.noti_origin[_is_official][_target] = {};
        for (let i = 0, j = v.notifications.length; i < j; i++)
          this.act_on_notification(v.notifications[i], _is_official, _target);
        this.rearrange_notifications();
      });
  }

  notifications_rearrange = [];
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
    this.notifications_rearrange = result;
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
   * channels_orig[isOfficial][target][channel_id] = { ...info }
   */
  channels_orig = {
    'official': {},
    'unofficial': {},
  };

  /** 채널 추가, 채널 재배열 포함됨  
   * 채널 추가에 사용하려는 경우 join_chat_with_modulation() 를 대신 사용하세요
   */
  async add_channels(channel_info: Channel, _is_official: string, _target: string) {
    if (this.channels_orig[_is_official][_target][channel_info.id] !== undefined && this.channels_orig[_is_official][_target][channel_info.id]['status'] != 'missing') return;
    if (!this.channels_orig[_is_official][_target][channel_info.id])
      this.channels_orig[_is_official][_target][channel_info.id] = {};
    let keys = Object.keys(channel_info);
    keys.forEach(key => this.channels_orig[_is_official][_target][channel_info.id][key] = channel_info[key]);
    if (!this.channels_orig[_is_official][_target][channel_info.id]['cnoti_id'])
      this.channels_orig[_is_official][_target][channel_info.id]['cnoti_id'] = this.get_noti_id();
    switch (this.channels_orig[_is_official][_target][channel_info.id]['redirect']['type']) {
      case 2: // 1:1 대화
        let targetId = this.channels_orig[_is_official][_target][channel_info.id]['redirect']['id'];
        let result_status = this.load_other_user(targetId, _is_official, _target)['online'] ? 'online' : 'pending';
        this.channels_orig[_is_official][_target][channel_info.id]['status'] = result_status;
        break;
      case 3: // 새로 개설된 그룹 채널인 경우
        let group_id = this.channels_orig[_is_official][_target][channel_info.id]['redirect']['id'];
        await this.servers[_is_official][_target].client.listGroupUsers(
          this.servers[_is_official][_target].session, group_id).then(v => {
            if (!this.groups[_is_official][_target][group_id]['users'])
              this.groups[_is_official][_target][group_id]['users'] = [];
            v.group_users.forEach(_user => {
              let keys = Object.keys(_user.user);
              keys.forEach(key => {
                if (_user.user.id != this.servers[_is_official][_target].session.user_id)
                  this.load_other_user(_user.user.id, _is_official, _target)[key] = _user.user[key]
              });
              if (_user.user.id == this.servers[_is_official][_target].session.user_id)
                _user.user['is_me'] = true;
              else this.save_other_user(_user.user, _is_official, _target);
              _user.user = this.load_other_user(_user.user.id, _is_official, _target);
              this.add_group_user_without_duplicate(_user, group_id, _is_official, _target);
            });
            this.count_channel_online_member(this.channels_orig[_is_official][_target][channel_info.id], _is_official, _target);
          });
        break;
      default:
        console.error('예상하지 못한 채널 종류: ', this.channels_orig[_is_official][_target][channel_info.id]);
        break;
    }
    this.rearrange_channels();
  }

  add_group_user_without_duplicate(user: GroupUser, gid: string, _is_official: string, _target: string) {
    let isAlreadyJoined = false;
    for (let i = 0, j = this.groups[_is_official][_target][gid]['users'].length; i < j; i++)
      if (this.groups[_is_official][_target][gid]['users'][i]['user']['id'] == user.user['id']) {
        isAlreadyJoined = true;
        break;
      }
    if (!isAlreadyJoined)
      this.groups[_is_official][_target][gid]['users'].push(user);
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
              if (this.channels_orig[_is_official][_target][_cid]['is_new'] && !this.subscribe_lock)
                this.has_new_channel_msg = true;
            });
          });
        });
      }
      this.rearrange_channels();
    });
  }

  /** 알림 아이디  
   * 새 채널이 생길 때마다 추가됨  
   * 새 할 일이 생성될 때마다 추가됨  
   * 2000부터 시작 */
  noti_id = 2000;
  /** 웹용 지연 알림 구성 보조용  
   * { noti_id: settimeout }
   */
  web_noti_id = {};
  /** 로컬알림에 사용될 채널별 id 구성용 */
  get_noti_id(): number {
    this.noti_id = this.check_If_RegisteredId(this.noti_id + 1);
    return this.noti_id;
  }
  check_If_RegisteredId(expectation_number: number): number {
    if (this.registered_id) {
      let already_registered = false;
      for (let i = 0, j = this.registered_id.length; i < j; i++)
        if (this.registered_id[i] == expectation_number) {
          already_registered = true;
          this.registered_id.splice(i, 1);
          break;
        }
      if (already_registered)
        return this.check_If_RegisteredId(expectation_number + 1);
      else return expectation_number;
    } else return expectation_number;
  }
  /** 기등록된 아이디 수집 */
  registered_id: number[];
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
          ).then(async _c => {
            if (!this.channels_orig[_is_official][_target][_cid]['cnoti_id'])
              this.channels_orig[_is_official][_target][_cid]['cnoti_id'] = this.get_noti_id();
            switch (this.channels_orig[_is_official][_target][_cid]['redirect']['type']) {
              case 2:
                this.servers[_is_official][_target].client.listChannelMessages(
                  this.servers[_is_official][_target].session, _cid, 1, false)
                  .then(v => {
                    if (v.messages.length) {
                      this.update_from_channel_msg(v.messages[0], _is_official, _target);
                    }
                    this.count_channel_online_member(this.channels_orig[_is_official][_target][_cid], _is_official, _target);
                    this.save_channels_with_less_info();
                  });
                break;
              case 3: // 그룹 채팅인 경우 그룹 유저도 검토
                await this.servers[_is_official][_target].client.listGroupUsers(
                  this.servers[_is_official][_target].session, this.channels_orig[_is_official][_target][_cid]['redirect']['id']
                ).then(_guser => {
                  _guser.group_users.forEach(_user => {
                    let keys = Object.keys(_user.user);
                    keys.forEach(key => this.load_other_user(_user.user.id, _is_official, _target)[key] = _user.user[key]);
                    if (_user.user.id == this.servers[_is_official][_target].session.user_id)
                      _user.user['is_me'] = true;
                    else this.save_other_user(_user.user, _is_official, _target);
                    _user.user = this.load_other_user(_user.user.id, _is_official, _target);
                    this.add_group_user_without_duplicate(_user, this.channels_orig[_is_official][_target][_cid]['redirect']['id'], _is_official, _target);
                  });
                  this.servers[_is_official][_target].client.listChannelMessages(
                    this.servers[_is_official][_target].session, _cid, 1, false)
                    .then(v => {
                      if (v.messages.length) {
                        this.update_from_channel_msg(v.messages[0], _is_official, _target);
                        this.count_channel_online_member(this.channels_orig[_is_official][_target][_cid], _is_official, _target);
                        this.save_channels_with_less_info();
                      }
                    });
                });
                break;
              default:
                console.warn('예상하지 못한 리다이렉션 타입: ', this.channels_orig[_is_official][_target][_cid]['redirect']['type']);
                break;
            }
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

  /** subscribe 페이지에서 사용할 채널 리스트 */
  channels: Channel[] = [];
  /** 채널 리스트 정리, 채널 정보 저장  
   * @return Channel[] from channels_orig
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
    result.sort((a, b) => {
      return (new Date(b['last_comment_time']) as any) - (new Date(a['last_comment_time']) as any);
    });
    result.sort((a, b) => {
      if (a['is_new'])
        if (b['is_new'])
          return 0;
        else return -1;
      else return 1;
    });
    this.channels = result;
    this.save_channels_with_less_info();
    return result;
  }

  /** 채널별로 정보를 분리 저장한 후 초기 로드시 병합시키는 구성 필요함 */
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
          delete channels_copy[_is_official][_target][_cid]['cnoti_id'];
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
        p.loadImage(ev.target.result.replace(/"|\\|=/g, ''), v => {
          v.resize(window.innerWidth, window.innerWidth * v.height / v.width);
          if (v['canvas'].toDataURL().length > SIZE_LIMIT)
            check_size(v);
          _CallBack(v);
          p.remove();
        }, _e => {
          this.p5toast.show({
            text: this.lang.text['Nakama']['CannotOpenImg'],
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
          server.client.listGroups(server.session, _info['name']).then(async v => {
            for (let i = 0, j = v.groups.length; i < j; i++)
              if (v.groups[i].id == _info['id']) {
                let pending_group = v.groups[i];
                pending_group['status'] = 'pending';
                await this.servers[server.info.isOfficial][server.info.target].client.listGroupUsers(
                  this.servers[server.info.isOfficial][server.info.target].session, v.groups[i].id
                ).then(_list => {
                  _list.group_users.forEach(_guser => {
                    let keys = Object.keys(_guser.user);
                    keys.forEach(key => this.load_other_user(_guser.user.id, server.info.isOfficial, server.info.target)[key] = _guser.user[key]);
                    this.save_other_user(_guser.user, server.info.isOfficial, server.info.target);
                  });
                });
                await this.servers[server.info.isOfficial][server.info.target].client.readStorageObjects(
                  this.servers[server.info.isOfficial][server.info.target].session, {
                  object_ids: [{
                    collection: 'group_public',
                    key: `group_${v.groups[i].id}`,
                    user_id: v.groups[i].creator_id,
                  }],
                }).then(gimg => {
                  if (gimg.objects.length)
                    pending_group['img'] = gimg.objects[0].value['img'];
                }).catch(_e => {
                  console.warn('이미지가 없는 그룹');
                });
                this.save_group_info(pending_group, server.info.isOfficial, server.info.target);
                if (pending_group.open) { // 열린 그룹이라면 즉시 채널에 참가
                  this.join_chat_with_modulation(pending_group.id, 3, server.info.isOfficial, server.info.target, (c) => {
                    this.servers[server.info.isOfficial][server.info.target].client.listChannelMessages(
                      this.servers[server.info.isOfficial][server.info.target].session, c.id, 1, false)
                      .then(v => {
                        if (v.messages.length) {
                          this.update_from_channel_msg(v.messages[0], server.info.isOfficial, server.info.target);
                        }
                      });
                  });
                }
                break;
              }
          });
        }).catch(e => {
          switch (e.status) {
            case 400: // 그룹에 이미 있는데 그룹추가 시도함
              server.client.listGroups(server.session, _info['name']).then(async v => {
                for (let i = 0, j = v.groups.length; i < j; i++)
                  if (v.groups[i].id == _info['id']) {
                    let pending_group = v.groups[i];
                    pending_group['status'] = 'pending';
                    await this.servers[server.info.isOfficial][server.info.target].client.listGroupUsers(
                      this.servers[server.info.isOfficial][server.info.target].session, v.groups[i].id
                    ).then(_list => {
                      _list.group_users.forEach(_guser => {
                        let keys = Object.keys(_guser.user);
                        keys.forEach(key => this.load_other_user(_guser.user.id, server.info.isOfficial, server.info.target)[key] = _guser.user[key]);
                        this.save_other_user(_guser.user, server.info.isOfficial, server.info.target);
                      });
                    });
                    this.save_group_info(pending_group, server.info.isOfficial, server.info.target);
                    break;
                  }
              });
              break;
            default:
              console.error('그룹 추가 오류: ', e);
              break;
          }
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
  async remove_group_list(info: any, _is_official: string, _target: string) {
    try { // 내가 방장이면 해산처리 우선, 이 외의 경우 기록 삭제
      if (this.servers[_is_official][_target] && info['creator_id'] == this.servers[_is_official][_target].session.user_id)
        await this.servers[_is_official][_target].client.deleteGroup(
          this.servers[_is_official][_target].session, info['id'],
        ).then(v => {
          if (!v) console.warn('그룹 삭제 오류 검토 필요');
          this.servers[_is_official][_target].client.deleteStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: 'group_public',
              key: `group_${info['id']}`,
            }]
          }).then(_v => {
            throw new Error("Remove group image well");
          }).catch(_e => {
            throw new Error("No group image found");
          });
          this.servers[_is_official][_target].client.deleteStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: `file_${info['channel_id']}`,
            }]
          }).then(v => {
            console.log('컬렉션 삭제 성공 로그?: ', v);
          }).catch(e => {
            console.log('컬렉션 삭제 실패: ', e);
          });
        });
      else throw new Error("not creator");
    } catch (e) {
      delete this.groups[_is_official][_target][info['id']];
      this.rearrange_group_list();
      this.save_groups_with_less_info();
      this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/groups/${info.id}.img`);
      if (this.socket_reactive['settings'])
        this.socket_reactive['settings'].load_groups();
    }
  }

  /** 연결된 서버에서 자신이 참여한 그룹을 리모트에서 가져오기 */
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
          this.join_chat_with_modulation(user_group.group.id, 3, _is_official, _target, (_c) => {
            this.redirect_channel(_is_official, _target);
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
            name: this.lang.text['Nakama']['DeletedServer'],
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
      if (this.groups[_is_official][_target][p['group_id']]['users']) {
        let user_length = this.groups[_is_official][_target][p['group_id']]['users'].length;
        if (user_length == 1) result_status = 'online'; // 그룹에 혼자만 있음
        else for (let i = 0; i < user_length; i++) { // 2명 이상의 그룹원
          let userId = this.groups[_is_official][_target][p['group_id']]['users'][i]['user']['id'] || this.servers[_is_official][_target].session.user_id;
          if (userId != this.servers[_is_official][_target].session.user_id) // 다른 사람인 경우
            if (this.load_other_user(userId, _is_official, _target)['online']) {
              result_status = 'online';
              break;
            }
        }
      }
    } else if (p['user_id_one']) { // 1:1 채팅인 경우
      // 보통 내가 접근하면서 사용자 온라인 여부 검토를 할 때 채널이 없는 경우 오류가 남, 검토 후 채널 생성 처리
      if (!this.channels_orig[_is_official][_target][p.channel_id || p.id])
        this.join_chat_with_modulation(
          p['user_id_one'] != this.servers[_is_official][_target].session.user_id ? p['user_id_one'] : p['user_id_two'],
          2, _is_official, _target, (c) => {
            let targetId = this.channels_orig[_is_official][_target][c.id]['redirect']['id'];
            result_status = this.load_other_user(targetId, _is_official, _target)['online'] ? 'online' : 'pending';
          });
      else {
        let targetId = this.channels_orig[_is_official][_target][p.channel_id || p.id]['redirect']['id'];
        result_status = this.load_other_user(targetId, _is_official, _target)['online'] ? 'online' : 'pending';
      }
    }
    if (this.channels_orig[_is_official][_target][p.channel_id || p.id] && this.channels_orig[_is_official][_target][p.channel_id || p.id]['status'] != 'missing')
      this.channels_orig[_is_official][_target][p.channel_id || p.id]['status'] = result_status;
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
          if (this.socket_reactive['others-online'])
            this.socket_reactive['others-online']();
          if (p.joins !== undefined) { // 참여 검토
            p.joins.forEach(info => {
              if (this.servers[_is_official][_target].session.user_id != info.user_id)
                this.load_other_user(info.user_id, _is_official, _target)['online'] = true;
            });
            this.count_channel_online_member(p, _is_official, _target);
          } else if (p.leaves !== undefined) { // 떠남 검토
            let others = [];
            p.leaves.forEach(info => {
              if (this.servers[_is_official][_target].session.user_id != info.user_id) {
                delete this.load_other_user(info.user_id, _is_official, _target)['online'];
                others.push(info.user_id);
              }
            });
            this.servers[_is_official][_target].client.getUsers(
              this.servers[_is_official][_target].session, others).then(v => {
                if (v.users.length)
                  v.users.forEach(_user => {
                    let keys = Object.keys(_user);
                    keys.forEach(key => this.load_other_user(_user.id, _is_official, _target)[key] = _user[key]);
                    this.save_other_user(_user, _is_official, _target);
                  });
                this.count_channel_online_member(p, _is_official, _target);
              });
          }
        }
        socket.onchannelmessage = (c) => {
          console.log('onchamsg: ', c);
          if (!this.channels_orig[_is_official][_target][c.channel_id]) { // 재참가 + 놓친 메시지인 경우 검토
            if (c.user_id_one) // 1:1 채팅
              this.join_chat_with_modulation(c.sender_id, 2, _is_official, _target, () => {
                this.update_from_channel_msg(c, _is_official, _target);
              });
            else if (c.group_id)  // 그룹 채팅
              this.join_chat_with_modulation(c.group_id, 3, _is_official, _target, (_c) => {
                this.update_from_channel_msg(c, _is_official, _target);
              });
          } else { // 평상시에
            this.update_from_channel_msg(c, _is_official, _target);
          }
        }
        socket.ondisconnect = (_e) => {
          this.p5toast.show({
            text: `${this.lang.text['Nakama']['DisconnectedFromServer']}: ${this.servers[_is_official][_target].info.name}`,
            lateable: true,
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

  /** 현재 보여지는 메시지들을 저장함  
   * @param messages 메시지[]
   */
  saveListedMessage(messages: any[], channel_info: any, _is_official: string, _target: string) {
    if (channel_info['redirect']['type'] == 3 && !this.groups[_is_official][_target][channel_info['group_id']]['open']) return;
    let SepByDate = {};
    let tmp_msg: any[] = JSON.parse(JSON.stringify(messages));
    while (tmp_msg.length) {
      if (SepByDate['target'] != tmp_msg[0]['msgDate']) {
        if (SepByDate['msg'])
          this.saveMessageByDate(SepByDate, channel_info, _is_official, _target);
        SepByDate['target'] = tmp_msg[0]['msgDate'];
        SepByDate['msg'] = [];
      }
      let msg = tmp_msg.shift();
      delete msg.content['text'];
      delete msg.content['img'];
      delete msg['msgDate'];
      delete msg['msgTime'];
      delete msg['isLastRead'];
      delete msg['showInfo'];
      SepByDate['msg'].push(msg);
    }
    this.saveMessageByDate(SepByDate, channel_info, _is_official, _target);
  }

  /** 날짜별로 대화 기록 저장하기 */
  saveMessageByDate(info: any, channel_info: any, _is_official: string, _target: string) {
    if (!info.msg || !info.msg.length) return;
    let SepByDate = JSON.parse(JSON.stringify(info));
    this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/channels/${channel_info.id}/chats/${SepByDate['target']}`, (e, v) => {
      let base: any[] = [];
      let added: any[] = [];
      if (e && v)
        base = JSON.parse(v);
      SepByDate['msg'].forEach(_msg => {
        let isDuplicate = false;
        for (let i = 0, j = base.length; i < j; i++)
          if (base[i]['message_id'] == _msg['message_id']) {
            isDuplicate = true;
            break;
          }
        if (!isDuplicate) added.push(_msg);
      });
      let result = [...base, ...added];
      result.sort((a, b) => {
        if (a['create_time'] < b['create_time'])
          return -1;
        if (a['create_time'] > b['create_time'])
          return 1;
        return 0;
      });
      this.indexed.saveTextFileToUserPath(JSON.stringify(result), `servers/${_is_official}/${_target}/channels/${channel_info.id}/chats/${SepByDate['target']}`);
    });
  }

  /** 메시지 수신 시각을 수신자에게 맞춤 */
  ModulateTimeDate(msg: any) {
    let currentTime = new Date(msg.create_time);
    msg['msgDate'] = `${currentTime.getFullYear()}-${("00" + (currentTime.getMonth() + 1)).slice(-2)}-${("00" + currentTime.getDate()).slice(-2)}`;
    msg['msgTime'] = `${("00" + currentTime.getHours()).slice(-2)}:${("00" + currentTime.getMinutes()).slice(-2)}`;
  }

  /** 채널 정보를 변형한 후 추가하기 */
  async join_chat_with_modulation(targetId: string, type: number, _is_official: string, _target: string, _CallBack = (_c: Channel) => { }, isNewChannel = false) {
    if (!this.channels_orig[_is_official][_target]) this.channels_orig[_is_official][_target] = {};
    await this.servers[_is_official][_target].socket.joinChat(targetId, type, true, false).then(c => {
      c['redirect'] = {
        id: targetId,
        type: type,
        persistence: true,
      };
      c['server'] = {
        isOfficial: _is_official,
        target: _target,
      };
      switch (type) {
        case 2: // 1:1 채팅
          c['title'] = this.load_other_user(targetId, _is_official, _target)['display_name'];
          c['info'] = this.load_other_user(targetId, _is_official, _target);
          break;
        case 3: // 그룹 채팅
          c['title'] = this.groups[_is_official][_target][targetId]['name'];
          c['info'] = this.groups[_is_official][_target][targetId];
          this.groups[_is_official][_target][targetId]['channel_id'] = c.id;
          this.save_groups_with_less_info();
          break;
        default:
          console.error('예상하지 못한 채널 정보: ', type);
          break;
      }
      this.add_channels(c, _is_official, _target);
      this.servers[_is_official][_target].client.listChannelMessages(
        this.servers[_is_official][_target].session, c.id, 1, false).then(m => {
          if (m.messages.length)
            this.update_from_channel_msg(m.messages[0], _is_official, _target, isNewChannel);
        });
      this.count_channel_online_member(c, _is_official, _target);
      this.save_groups_with_less_info();
      _CallBack(c);
    });
  }

  /** 연결 페이지를 보고있는지 여부 */
  subscribe_lock = false;
  has_new_channel_msg = false;
  /** 채널 메시지를 변조 후 전파하기 */
  update_from_channel_msg(msg: ChannelMessage, _is_official: string, _target: string, isNewChannel = false) {
    let is_me = msg.sender_id == this.servers[_is_official][_target].session.user_id;
    let is_new = msg.message_id != this.channels_orig[_is_official][_target][msg.channel_id]['last_comment_id'];
    let c = this.modulation_channel_message(msg, _is_official, _target);
    if (!is_me && (c.code != 0 || is_new)) {
      this.noti.PushLocal({
        id: this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id'],
        title: this.channels_orig[_is_official][_target][msg.channel_id]['info']['name']
          || this.channels_orig[_is_official][_target][msg.channel_id]['info']['display_name']
          || this.channels_orig[_is_official][_target][msg.channel_id]['title']
          || this.lang.text['Subscribes']['noTitiedChat'],
        body: c.content['msg'] || c.content['noti'] || `(${this.lang.text['ChatRoom']['attachments']})`,
        extra_ln: {
          page: {
            component: 'ChatRoomPage',
            componentProps: {
              info: {
                id: msg.channel_id,
                isOfficial: _is_official,
                target: _target,
                noti_id: this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id'],
              }
            },
          },
        },
        group_ln: 'diychat',
        smallIcon_ln: 'diychat',
        autoCancel_ln: true,
        iconColor_ln: '271e38',
      }, this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id'], (ev: any) => {
        // 알림 아이디가 같으면 진입 허용
        if (ev['id'] == this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id']) {
          this.modalCtrl.create({
            component: ChatRoomPage,
            componentProps: {
              info: this.channels_orig[_is_official][_target][msg.channel_id],
            },
          }).then(v => this.go_to_chatroom_without_admob_act(v));
        }
      });
    }
    switch (c.code) {
      case 0: // 사용자가 작성한 일반적인 메시지
        if (c.content['gupdate']) // 그룹 정보 업데이트
          this.update_group_info(c, _is_official, _target);
        if (c.content['user_update']) // 그룹 사용자 정보 변경
          this.update_group_user_info(c, _is_official, _target);
        if (is_new) {
          this.channels_orig[_is_official][_target][msg.channel_id]['is_new'] = !is_me;
          if (!this.subscribe_lock)
            this.has_new_channel_msg = !is_me;
        }
        break;
      case 3: // 열린 그룹 상태에서 사용자 들어오기 요청
      case 4: // 채널에 새로 들어온 사람 알림
      case 5: // 그룹에 있던 사용자 나감(들어오려다가 포기한 사람 포함)
      case 6: // 누군가 그룹에서 내보내짐 (kick)
        if (this.socket_reactive['settings'])
          this.socket_reactive['settings'].load_groups();
        if (this.socket_reactive['group_detail']) // 그룹 상세를 보는 중이라면 업데이트하기
          this.socket_reactive['group_detail'].update_GroupUsersList(_is_official, _target);
        if (c.code == 3 || c.code == 4) break;
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
        }
        break;
      default:
        console.warn('예상하지 못한 채널 메시지 코드: ', c.code);
        break;
    }
    this.ModulateTimeDate(c);
    this.check_sender_and_show_name(c, _is_official, _target);
    let original_msg = msg.content['msg'];
    this.content_to_hyperlink(c);
    this.channels_orig[_is_official][_target][msg.channel_id]['last_comment_time'] = msg.create_time;
    this.channels_orig[_is_official][_target][c.channel_id]['last_comment_id'] = c.message_id;
    this.rearrange_channels();
    if (!isNewChannel && this.channels_orig[_is_official][_target][c.channel_id]['update'])
      this.channels_orig[_is_official][_target][c.channel_id]['update'](c);
    this.saveListedMessage([c], this.channels_orig[_is_official][_target][c.channel_id], _is_official, _target);
    let hasFile = c.content['filename'] ? `(${this.lang.text['ChatRoom']['attachments']}) ` : '';
    this.channels_orig[_is_official][_target][c.channel_id]['last_comment'] = hasFile + (original_msg || c.content['noti'] || '');
    this.save_channels_with_less_info();
  }

  /** 메시지 내 하이퍼링크가 있는 경우 검토 */
  content_to_hyperlink(msg: any) {
    let content: string = msg.content['msg'];
    msg.content['msg'] = [{ text: msg.content['msg'] }]; // 모든 메시지를 배열처리
    if (content) { // 메시지가 포함되어있는 경우에 한함
      let index = content.indexOf('http://');
      if (index < 0)
        index = content.indexOf('https://');
      if (index >= 0) { // 주소가 있는 경우 추출
        let result_msg = [];
        let front_msg: string;
        if (index != 0) {
          front_msg = content.substring(0, index);
          result_msg.push({ text: front_msg });
        }
        let AddrHead = content.substring(index);
        let EndOfAddress = AddrHead.indexOf(' ');
        let result: string;
        let end_msg: string;
        if (EndOfAddress < 0) {
          result = AddrHead;
          result_msg.push({ text: result, href: true });
        } else {
          result = AddrHead.substring(0, EndOfAddress);
          result_msg.push({ text: result, href: true });
          end_msg = AddrHead.substring(EndOfAddress);
          result_msg.push({ text: end_msg });
        }
        msg.content['msg'] = result_msg;
      }
    }
  }

  /** 발신인 표시를 위한 메시지 추가 가공 */
  check_sender_and_show_name(c: ChannelMessage, _is_official: string, _target: string) {
    c['color'] = (c.sender_id.replace(/[^4-79a-b]/g, '') + 'abcdef').substring(0, 6);
    if (c.sender_id == this.servers[_is_official][_target].session.user_id) {
      c['user_display_name'] = this.users.self['display_name'];
      c['is_me'] = true;
    } else c['user_display_name'] = this.load_other_user(c.sender_id, _is_official, _target)['display_name'];
    c['user_display_name'] = c['user_display_name'] || this.lang.text['Profile']['noname_user'];
  }

  /** 채널 정보를 분석하여 메시지 변형 (행동은 하지 않음)
   * @return c.modulated
   */
  modulation_channel_message(c: ChannelMessage, _is_official: string, _target: string) {
    let is_me = false;
    if (this.statusBar.groupServer[_is_official][_target]
      && this.statusBar.groupServer[_is_official][_target] != 'offline'
      && this.statusBar.groupServer[_is_official][_target] != 'missing')
      is_me = c.sender_id == this.servers[_is_official][_target].session.user_id;
    else is_me = c.content['user_update'];
    let target = is_me ? this.users.self : this.load_other_user(c.sender_id, _is_official, _target);
    switch (c.code) {
      case 0: // 사용자가 작성한 일반적인 메시지
        break;
      case 3: // 열린 그룹에 들어온 사용자 알림
      case 4: // 채널에 새로 들어온 사람 알림
        c.content['user_update'] = target;
        c.content['noti'] = `${this.lang.text['Nakama']['GroupUserJoin']}: ${target['display_name']}`;
        break;
      case 5: // 그룹에 있던 사용자 나감(들어오려다가 포기한 사람 포함)
        console.warn('그룹원 탈퇴와 참여 예정자의 포기를 구분할 수 있는지: ', c);
        c.content['user_update'] = target;
        c.content['noti'] = `${this.lang.text['Nakama']['GroupUserOut']}: ${target['display_name']}`;
        break;
      case 6: // 누군가 그룹에서 내보내짐 (kick)
        c.content['user_update'] = target;
        c.content['noti'] = `${this.lang.text['Nakama']['GroupUserKick']}: ${target['display_name']}`;
        break;
      default:
        console.warn('예상하지 못한 메시지 코드: ', c);
        break;
    }
    return c;
  }

  /** 그룹 정보 변경 처리 */
  update_group_info(c: ChannelMessage, _is_official: string, _target: string) {
    this.translate_updates(c);
    switch (c.content['gupdate']) {
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
        this.save_groups_with_less_info();
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

  /** 사용자 및 그룹 업데이트 안내 문구 번역 구성 */
  translate_updates(msg: any) {
    if (msg.content['user_update'])
      switch (msg.content['user_update']) {
        case 'modify_data': // 프로필 또는 이미지가 변경됨
          msg.content['noti'] = `${this.lang.text['Profile']['user_profile_changed']}${msg.content['noti_form']}`;
          break;
        case 'modify_img': // 프로필 또는 이미지가 변경됨
          msg.content['noti'] = `${this.lang.text['Profile']['user_img_changed']}${msg.content['noti_form']}`;
          break;
      }
    if (msg.content['gupdate'])
      switch (msg.content['gupdate']) {
        case 'info': // 그룹 정보가 변경됨
          msg.content['noti'] = this.lang.text['GroupDetail']['GroupInfoUpdated'];
          break;
        case 'image': // 그룹 이미지가 변경됨
          msg.content['noti'] = this.lang.text['GroupDetail']['GroupImageUpdated'];
          break;
        case 'remove': // 그룹이 삭제됨
          msg.content['noti'] = this.lang.text['GroupDetail']['GroupRemoved'];
          break;
      }
  }

  /** 그룹 사용자 상태 변경 처리 */
  async update_group_user_info(c: ChannelMessage, _is_official: string, _target: string) {
    this.translate_updates(c);
    switch (c.content['user_update']) {
      case 'modify_data': // 프로필 또는 이미지가 변경됨
        await this.servers[_is_official][_target].client.getUsers(
          this.servers[_is_official][_target].session, [c.sender_id]
        ).then(v => {
          if (v.users.length) {
            this.save_other_user(v.users[0], _is_official, _target);
          } else {
            delete this.users[_is_official][_target][c.sender_id];
            this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/users/${c.sender_id}/profile.json`)
          }
        });
        break;
      case 'modify_img': // 프로필 또는 이미지가 변경됨
        await this.servers[_is_official][_target].client.readStorageObjects(
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
              this.load_other_user(c.sender_id, _is_official, _target)['img'] = v.objects[0].value['img'];
              this.load_other_user(c.sender_id, _is_official, _target)['avatar_url'] = v.objects[0].version;
              this.save_other_user(this.load_other_user(c.sender_id, _is_official, _target), _is_official, _target);
            }
          } else {
            if (this.socket_reactive['others-profile'])
              this.socket_reactive['others-profile']('');
            delete this.load_other_user(c.sender_id, _is_official, _target)['img'];
            this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/users/${c.sender_id}/profile.img`)
          }
        }).catch(_e => {
          if (this.users[_is_official][_target][c.sender_id]['img']) {
            delete this.users[_is_official][_target][c.sender_id]['img'];
            this.save_other_user(this.users[_is_official][_target][c.sender_id], _is_official, _target);
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
      // 채널에 없을 때 받은 알림은 메시지가 적혀있지 않아 그 내용을 저장할 수 없음
      case -3: // 상대방이 친구 요청 수락
      case -4: // 상대방이 그룹 참가 수락
      case -6: // 친구가 다른 게임에 참여
        this.noti.RemoveListener(`check${this_noti.code}`);
        this.noti.ClearNoti(this_noti.code);
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
              msg += `${this.lang.text['Nakama']['ReqContServer']}: ${this_noti['server']['name']}<br>`;
              msg += `${this.lang.text['Nakama']['ReqContUserName']}: ${v.users[0].display_name}`;
              this.alertCtrl.create({
                header: this.lang.text['Nakama']['ReqContTitle'],
                message: msg,
                buttons: [{
                  text: this.lang.text['Nakama']['ReqContAccept'],
                  handler: () => {
                    this_server.client.addGroupUsers(this_server.session, this_noti['content']['group_id'], [v.users[0].id])
                      .then(v => {
                        if (!v) console.warn('밴인 경우인 것 같음, 확인 필요');
                        this.noti.RemoveListener(`check${this_noti.code}`);
                        this.noti.ClearNoti(this_noti.code);
                        this_server.client.deleteNotifications(this_server.session, [this_noti['id']])
                          .then(b => {
                            if (b) this.update_notifications(_is_official, _target);
                            else console.warn('알림 지우기 실패: ', b);
                          });
                      });
                  }
                }, {
                  text: this.lang.text['Nakama']['ReqContReject'],
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
                    text: this.lang.text['Nakama']['UserNotFound'],
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
    /** 처리과정에서 알림이 지워졌는지 여부 */
    let is_removed = false;
    v['server'] = this.servers[_is_official][_target].info;
    switch (v.code) {
      case 0: // 예약된 알림
        v['request'] = `${v.code}-${v.subject}`;
        break;
      case -1: // 오프라인이거나 채널에 없을 때 알림 받음
        // 모든 채팅에 대한건지, 1:1에 한정인지 검토 필요
        console.warn('채널에 없을 때 받은 메시지란..: ', v);
        v['request'] = `${v.code}-${v.subject}`;
        let targetType: number;
        if (v['content'] && v['content']['username'])
          targetType = 2;
        // 요청 타입을 구분하여 자동반응처리
        switch (targetType) {
          case 2: // 1:1 채팅
            this.join_chat_with_modulation(v['sender_id'], targetType, _is_official, _target, async (c) => {
              await this.servers[_is_official][_target].client.listChannelMessages(
                this.servers[_is_official][_target].session, c.id, 1, false).then(m => {
                  if (m.messages.length) {
                    this.update_from_channel_msg(m.messages[0], _is_official, _target);
                  }
                });
            });
            break;
          default:
            console.warn('예상하지 못한 알림 행동처리: ', v, targetType);
            v['request'] = `${v.code}-${v.subject}`;
            break;
        }
        is_removed = true;
        this.servers[_is_official][_target].client.deleteNotifications(
          this.servers[_is_official][_target].session, [v['id']]).then(b => {
            if (!b) console.warn('알림 거부처리 검토 필요');
            this.update_notifications(_is_official, _target);
          });
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
        this.noti.RemoveListener(`check${v.code}`);
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
        this.join_chat_with_modulation(v.content['group_id'], 3, _is_official, _target, (c) => {
          this.servers[_is_official][_target].client.listChannelMessages(
            this.servers[_is_official][_target].session, c.id, 1, false)
            .then(v => {
              if (v.messages.length) {
                this.update_from_channel_msg(v.messages[0], _is_official, _target);
              }
            });
        });
        this.noti.PushLocal({
          id: v.code,
          title: `${this.groups[_is_official][_target][v.content['group_id']]['name']}: ${this.lang.text['Nakama']['LocalNotiTitle']}`,
          body: v.subject,
          group_ln: 'diychat',
          // actions_ln: [{
          //   id: `check${v.code}`,
          //   title: this.lang.text['Nakama']['LocalNotiOK'],
          // }],
          icon: this.groups[_is_official][_target][v.content['group_id']['img']],
          smallIcon_ln: 'diychat',
          autoCancel_ln: true,
          iconColor_ln: '271e38',
        }, undefined, (_ev: any) => {
          this.check_notifications(v, _is_official, _target);
        });
        break;
      case -5: // 그룹 참가 요청 받음
        let group_info = this.groups[_is_official][_target][v.content['group_id']];
        if (group_info) {
          v['request'] = `${this.lang.text['Nakama']['ReqContTitle']}: ${group_info['name']}`;
        } else {
          is_removed = true;
          this.servers[_is_official][_target].client.deleteNotifications(
            this.servers[_is_official][_target].session, [v.id]
          ).then(b => {
            if (b) this.update_notifications(_is_official, _target);
            else console.warn('알림 지우기 실패: ', b);
          });
        }
        // 이미 보는 화면이라면 업데이트하기
        if (this.socket_reactive['settings'])
          this.socket_reactive['settings'].load_groups();
        if (this.socket_reactive['group_detail'] && this.socket_reactive['group_detail'].info.id == v.content['group_id'])
          this.socket_reactive['group_detail'].update_from_notification(v);
        this.noti.RemoveListener(`check${v.code}`);
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
          title: `${this.groups[_is_official][_target][v.content['group_id']]['name']}: ${this.lang.text['Nakama']['ReqContTitle']}`,
          group_ln: 'diychat',
          // actions_ln: [{
          //   id: `check${v.code}`,
          //   title: this.lang.text['Nakama']['LocalNotiCheck'],
          // }],
          icon: this.groups[_is_official][_target][v.content['group_id']]['img'],
          extra_ln: {
            page: {
              component: 'NakamaReqContTitle',
              componentProps: {
                data: {
                  noti_id: v.id,
                  serverName: this.servers[_is_official][_target].info.name,
                  userName: this.load_other_user(v.sender_id, _is_official, _target)['display_name'],
                  group_id: v.content['group_id'],
                  user_id: v.sender_id,
                  isOfficial: _is_official,
                  Target: _target,
                },
              },
            },
          },
          smallIcon_ln: 'diychat',
          autoCancel_ln: true,
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
  }

  /** 채널별 파일 송/수신 경과  
   * 송수신을 시작하면 길이에 해당하는 배열을 만든 후 소거법으로 완료된 파트를 삭제  
   * channel_transfer[isOfficial][target][channel_id][message_id] = [...partsize.length - completed];
   */
  channel_transfer = {
    'official': {},
    'unofficial': {},
  };
  /**
   * 채널에서 백그라운드 파일 발송 요청
   * @param msg 메시지 정보
   * @param upload 업로드하려는 내용
   */
  async WriteStorage_From_channel(msg: any, upload: string[], _is_official: string, _target: string, startFrom = 0) {
    let _msg = JSON.parse(JSON.stringify(msg));
    let _upload = [...upload];
    if (!this.channel_transfer[_is_official][_target]) this.channel_transfer[_is_official][_target] = {};
    if (!this.channel_transfer[_is_official][_target][msg.channel_id]) this.channel_transfer[_is_official][_target][msg.channel_id] = {};
    if (!this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id])
      this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id] = {
        type: 'upload',
        progress: Array.from(Array(_upload.length).keys()),
      };
    for (let i = startFrom, j = _upload.length; i < j; i++)
      await this.servers[_is_official][_target].client.writeStorageObjects(
        this.servers[_is_official][_target].session, [{
          collection: `file_${_msg.channel_id.replace(/[.]/g, '_')}`,
          key: `msg_${_msg.message_id}_${i}`,
          permission_read: 2,
          permission_write: 1,
          value: { data: _upload[i] },
        }]).then(_f => {
          this.when_transfer_success(msg, _is_official, _target, i);
        }).catch(async _e => {
          await this.retry_upload_part(msg, {
            collection: `file_${_msg.channel_id.replace(/[.]/g, '_')}`,
            key: `msg_${_msg.message_id}_${i}`,
            permission_read: 2,
            permission_write: 1,
            value: { data: _upload[i] },
          }, _is_official, _target, i);
        });
  }
  /** 업로드 실패한 파트 다시 올리기 */
  async retry_upload_part(msg: any, info: WriteStorageObject, _is_official: string, _target: string, i: number, _try_left = 10) {
    await this.servers[_is_official][_target].client.writeStorageObjects(
      this.servers[_is_official][_target].session, [info])
      .then(_v => {
        this.when_transfer_success(msg, _is_official, _target, i);
      }).catch(e => {
        if (_try_left > 0)
          this.retry_upload_part(msg, info, _is_official, _target, i, _try_left - 1);
        else {
          console.error('파일 다시 올리기 실패: ', e, info, i);
        }
      });
  }

  /** 파일 전송에 성공했다면 */
  when_transfer_success(msg: any, _is_official: string, _target: string, index: number) {
    if (this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id]['progress'].shift() != index) {
      this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id]['progress'].unshift(index);
      for (let i = 0, j = this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id]['progress'].length; i < j; i++)
        if (this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id]['progress'][i] == index) {
          this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id]['progress'].splice(index, 1);
          break;
        }
    }
    if (!this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id]['progress'].length) {
      delete this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id];
      this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/channels/${msg.channel_id}/transfer.history`);
    } else { // 전송할 것이 남았다면 가끔 기록을 저장하기
      if (this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id]['progress'][0] % 7 == 0) {
        let logging = JSON.parse(JSON.stringify(this.channel_transfer[_is_official][_target][msg.channel_id]));
        logging[msg.message_id]['OnProgress'] = true;
        this.indexed.saveTextFileToUserPath(
          JSON.stringify(logging),
          `servers/${_is_official}/${_target}/channels/${msg.channel_id}/transfer.history`);
      }
    }
  }
  /**
   * 채널 메시지에 기반하여 파일 다운받기
   * @param msg 메시지 정보
   */
  async ReadStorage_From_channel(msg: any, _is_official: string, _target: string, _CallBack = (_blob: Blob) => { }) {
    let _msg = JSON.parse(JSON.stringify(msg));
    if (!this.channel_transfer[_is_official][_target]) this.channel_transfer[_is_official][_target] = {};
    if (!this.channel_transfer[_is_official][_target][msg.channel_id]) this.channel_transfer[_is_official][_target][msg.channel_id] = {};
    // 이미 진행중이라면 무시
    if (this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id]) return;
    if (!this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id])
      this.channel_transfer[_is_official][_target][msg.channel_id][msg.message_id] = {
        type: 'download',
        progress: Array.from(Array(_msg.content['partsize']).keys()),
      }
    let result = [];
    let isSuccessful = true;
    for (let i = 0, j = _msg.content['partsize']; i < j; i++)
      await this.servers[_is_official][_target].client.readStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: `file_${_msg.channel_id.replace(/[.]/g, '_')}`,
          key: `msg_${_msg.message_id}_${i}`,
          user_id: _msg['sender_id'],
        }]
      }).then(v => {
        if (v.objects.length) {
          this.when_transfer_success(_msg, _is_official, _target, i);
          result[i] = v.objects[0].value['data'];
        } else isSuccessful = false;
      }).catch(async _e => {
        await this.retry_download_part(_msg, {
          collection: `file_${_msg.channel_id.replace(/[.]/g, '_')}`,
          key: `msg_${_msg.message_id}_${i}`,
          user_id: _msg['sender_id'],
        }, _is_official, _target, i);
      });
    if (!isSuccessful) return;
    let resultModified = result.join('').replace(/"|\\|=/g, '');
    msg.content['text'] = this.lang.text['ChatRoom']['downloaded'];
    if (resultModified) {
      this.indexed.saveFileToUserPath(resultModified, `servers/${_is_official}/${_target}/channels/${_msg.channel_id}/files/msg_${_msg.message_id}.${_msg.content['file_ext']}`,
        v => {
          _CallBack(new Blob([v], { type: msg.content['type'] }));
        });
    } else this.p5toast.show({
      text: this.lang.text['Nakama']['MissingFile'],
    });
  }
  /** 다운로드 실패한 파트 다시 받기 */
  async retry_download_part(msg: any, info: ApiReadStorageObjectId, _is_official: string, _target: string, i: number, _try_left = 10) {
    await this.servers[_is_official][_target].client.readStorageObjects(
      this.servers[_is_official][_target].session, {
      object_ids: [info],
    }).then(_v => {
      this.when_transfer_success(msg, _is_official, _target, i);
    }).catch(e => {
      if (_try_left > 0)
        this.retry_upload_part(msg, info, _is_official, _target, i, _try_left - 1);
      else console.error('파일 다시 받기 실패: ', e, info, i);
    });
  }

  act_from_QRInfo(v: string) {
    let json: any[] = JSON.parse(v);
    for (let i = 0, j = json.length; i < j; i++)
      switch (json[i].type) {
        case 'link': // 계정 연결처리
          if (!this.check_comm_server_is_online())
            return
          this.weblink.initialize({
            pid: json[i].value,
            uuid: this.uuid,
          });
          break;
        case 'link_reverse': // 게정 연결처리 (빠른 QR공유)
          this.uuid = json[i].value;
          this.indexed.saveTextFileToUserPath(this.uuid, 'link-account');
          this.p5toast.show({
            text: this.lang.text['LinkAccount']['link_account_succ'],
            lateable: true,
          });
          this.logout_all_server();
          this.users.self['online'] = true;
          this.init_all_sessions();
          break;
        case 'QRShare':
          this.modalCtrl.create({
            component: QrSharePage,
          }).then(v => v.present());
          break;
        case 'tools': // 도구모음, 단일 대상 서버 생성 액션시
          if (!this.check_comm_server_is_online())
            return
          this.create_tool_server(json[i].value);
          break;
        case 'server': // 그룹 서버 자동등록처리
          let hasAlreadyTargetKey = Boolean(this.statusBar.groupServer['unofficial'][json[i].value.name]);
          if (hasAlreadyTargetKey) {
            this.p5toast.show({
              text: `${this.lang.text['Nakama']['AlreadyHaveTargetName']}: ${json[i].value.name}`,
            });
            delete json[i].value.name;
            this.modalCtrl.create({
              component: ServerDetailPage,
              componentProps: {
                data: json[i].value,
              },
            }).then(v => v.present());
          } else {
            let new_server_info: any = {};
            new_server_info['name'] = json[i].value.name;
            new_server_info['target'] = json[i].value.target || json[i].value.name;
            new_server_info['address'] = json[i].value.address || '192.168.0.1';
            new_server_info['port'] = json[i].value.port || 7350;
            new_server_info['useSSL'] = json[i].value.useSSL || false;
            new_server_info['isOfficial'] = json[i].value.isOfficial || 'unofficial';
            new_server_info['key'] = json[i].value.key || 'defaultkey';
            let line = new Date().getTime().toString();
            line += `,${new_server_info.isOfficial}`;
            line += `,${new_server_info.name}`;
            line += `,${new_server_info.target}`;
            line += `,${new_server_info.address}`;
            line += `,${new_server_info.port}`;
            line += `,${new_server_info.useSSL}`;
            this.indexed.loadTextFromUserPath('servers/list_detail.csv', (e, v) => {
              let list: string[] = [];
              if (e && v) list = v.split('\n');
              for (let i = 0, j = list.length; i < j; i++) {
                let sep = list[i].split(',');
                if (sep[3] == new_server_info.target) {
                  list.splice(i, 1);
                  break;
                }
              }
              list.push(line);
              this.indexed.saveTextFileToUserPath(list.join('\n'), 'servers/list_detail.csv', (_v) => {
                this.init_server(new_server_info);
                this.servers[new_server_info.isOfficial][new_server_info.target].info = { ...new_server_info };
                this.init_session(new_server_info);
              });
              this.statusBar.groupServer[new_server_info.isOfficial][new_server_info.target] = 'offline';
              this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
            });
          }
          return;
        case 'comm_server':
          this.communityServer.client.close();
          if (json[i].value.useSSL)
            this.communityServer.socket_header = 'wss';
          else this.communityServer.socket_header = 'ws';
          localStorage.setItem('wsc_socket_header', this.communityServer.socket_header);
          this.communityServer.address_override = json[i].value.address_override;
          localStorage.setItem('wsc_address_override', this.communityServer.address_override);
          this.communityServer.initialize();
          break;
        case 'group_dedi': // 그룹사설 채팅 접근
          this.modalCtrl.create({
            component: MinimalChatPage,
            componentProps: {
              address: json[i].value.address,
              name: this.users.self['display_name'],
            },
          }).then(v => {
            v.present();
          });
          break;
        case 'group': // 그룹 자동 등록 시도
          this.try_add_group(json[i]);
          break;
        default: // 동작 미정 알림(debug)
          throw new Error("지정된 틀 아님");
      }
  }

  /** 커뮤니티 서버 온라인 여부 확인 */
  check_comm_server_is_online(): boolean {
    let result = this.communityServer.client.readyState == this.communityServer.client.OPEN;
    if (!result) {
      this.p5toast.show({
        text: this.lang.text['Subscribes']['needLinkWithCommServ'],
      });
    }
    return result;
  }

  /** 도구모음 서버 만들기 */
  create_tool_server(data: UnivToolForm) {
    let PORT: number;
    /** 메시지 받기 행동 구성 */
    let onMessage = (_json: any) => console.warn(`${data.name}_create_tool_server_onMessage: ${_json}`);
    switch (data.name) {
      case 'engineppt':
        PORT = 12021;
        onMessage = (json: any) => {
          console.log('engineppt init test: ', json);
        };
        break;
      default:
        throw new Error(`지정된 툴 정보가 아님: ${data}`);
    }
    this.tools.initialize(data.name, PORT, () => {
      this.tools.check_addresses(data.name, (v: any) => {
        let keys = Object.keys(v);
        let local_addresses = [];
        for (let i = 0, j = keys.length; i < j; i++)
          local_addresses = [...local_addresses, ...v[keys[i]]['ipv4Addresses']];
        this.weblink.initialize({
          from: 'mobile',
          pid: data.client,
          addresses: local_addresses,
        });
      });
    }, onMessage);
  }
}
