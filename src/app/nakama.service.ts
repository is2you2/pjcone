// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable, NgZone } from '@angular/core';
import { Channel, ChannelMessage, Client, Group, GroupUser, Match, Notification, Session, Socket, User, WriteStorageObject } from "@heroiclabs/nakama-js";
import { isPlatform } from './app.component';
import { IndexedDBService } from './indexed-db.service';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';
import * as p5 from 'p5';
import { LocalNotiService } from './local-noti.service';
import { AlertController, ModalController, NavController, mdTransitionAnimation } from '@ionic/angular';
import { GroupDetailPage } from './portal/settings/group-detail/group-detail.page';
import { ApiReadStorageObjectId } from '@heroiclabs/nakama-js/dist/api.gen';
import { LanguageSettingService } from './language-setting.service';
import { AdMob } from '@capacitor-community/admob';
import { FileInfo, GlobalActService } from './global-act.service';
import { MinimalChatPage } from './minimal-chat/minimal-chat.page';
import { ServerDetailPage } from './portal/settings/group-server/server-detail/server-detail.page';
import { QrSharePage } from './portal/settings/qr-share/qr-share.page';
import { EnginepptPage } from './portal/settings/engineppt/engineppt.page';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';

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
  /** 이 서버의 관리자 여부 */
  is_admin?: boolean;
  /** 기능에 따라 일시적으로 사용하는 매칭 정보  
   * **페이지 벗어날 때 삭제할 것** */
  match?: Match;
}

/** 서버마다 구성 */
interface NakamaGroup {
  /** 서버 정보 */
  info?: ServerInfo;
  client?: Client;
  session?: Session;
  socket?: Socket;
}

export enum MatchOpCode {
  /** 해야할 일 생성/수정/삭제/완료 */
  ADD_TODO = 10,
  /** 프로필 정보/이미지 수정 */
  EDIT_PROFILE = 11,
  /** 빠른 QR공유 */
  QR_SHARE = 12,
  ENGINE_PPT = 13,
}

@Injectable({
  providedIn: 'root'
})
export class NakamaService {

  constructor(
    private p5toast: P5ToastService,
    private statusBar: StatusManageService,
    private indexed: IndexedDBService,
    private noti: LocalNotiService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private lang: LanguageSettingService,
    private global: GlobalActService,
    private bgmode: BackgroundMode,
    private navCtrl: NavController,
    private ngZone: NgZone,
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
    // 기등록 알림 id 검토
    this.noti.GetNotificationIds((list) => {
      this.registered_id = list;
      this.set_all_todo_notification();
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
          this.servers[info.isOfficial][info.target] = {};
          this.servers[info.isOfficial][info.target].info = info;
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
  }
  /** 시작시 해야할 일 알림을 설정 */
  set_all_todo_notification() {
    this.indexed.GetFileListFromDB('info.todo', _list => {
      _list.forEach(info => {
        this.indexed.loadTextFromUserPath(info, (e, v) => {
          if (e && v) {
            let noti_info = JSON.parse(v);
            this.set_todo_notification(noti_info);
          }
        });
      });
    });
  }

  AddTodoLinkAct: Function;
  open_add_todo_page(info: string) {
    if (this.AddTodoLinkAct)
      this.AddTodoLinkAct(info);
    else this.ngZone.run(() => {
      this.navCtrl.navigateForward('add-todo-menu', {
        animation: mdTransitionAnimation,
        state: {
          data: info,
        },
      });
    });
  }

  /** 해야할 일 알림 추가하기 */
  set_todo_notification(noti_info: any) {
    // 시작 시간이 있으면 시작할 때 알림, 시작시간이 없으면 끝날 때 알림
    let targetTime = noti_info.startFrom || noti_info.limit;
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') { // 웹은 예약 발송이 없으므로 지금부터 수를 세야함
      let schedule = setTimeout(() => {
        this.noti.PushLocal({
          id: noti_info.noti_id,
          title: noti_info.title,
          body: noti_info.description,
        }, undefined, (_ev: any) => {
          this.open_add_todo_page(JSON.stringify(noti_info));
        });
      }, new Date(targetTime).getTime() - new Date().getTime());
      this.web_noti_id[noti_info.noti_id] = schedule;
    } else { // 모바일은 예약 발송을 설정
      let schedule_at = new Date(targetTime).getTime();
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
        if (noti_info['custom_color'])
          color = noti_info['custom_color'];
        this.noti.PushLocal({
          id: noti_info.noti_id,
          title: noti_info.title,
          body: noti_info.description,
          smallIcon_ln: 'todo',
          iconColor_ln: color,
          group_ln: 'todo',
          triggerWhen_ln: {
            at: new Date(targetTime),
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

  /** 채팅 채널이 열려있는 경우 행동시키기 */
  ChatroomLinkAct: Function;
  /** subscribe과 localPush의 채팅방 입장 행동을 통일함 */
  go_to_chatroom_without_admob_act(_info: any) {
    this.removeBanner();
    this.has_new_channel_msg = false;
    this.rearrange_channels();
    this.save_channels_with_less_info();
    if (this.ChatroomLinkAct)
      this.ChatroomLinkAct(_info);
    else this.ngZone.run(() => {
      this.navCtrl.navigateForward('chat-room', {
        animation: mdTransitionAnimation,
        state: {
          info: _info,
        },
      });
    });
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

    if (!this.groups[info.isOfficial][info.target])
      this.groups[info.isOfficial][info.target] = {};
    if (!this.channels_orig[info.isOfficial][info.target])
      this.channels_orig[info.isOfficial][info.target] = {};

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
  /** 세션처리
   * @param _CallBack 오류시 행동방침
   * @param info.target 대상 key
   */
  async init_session(info: ServerInfo) {
    try {
      this.servers[info.isOfficial][info.target].session
        = await this.servers[info.isOfficial][info.target].client.authenticateEmail(this.users.self['email'], this.users.self['password'], false);
      this.after_login(info.isOfficial, info.target, info.useSSL);
    } catch (e) {
      switch (e.status) {
        case 400: // 이메일/비번이 없거나 하는 등, 요청 정보가 잘못됨
          this.p5toast.show({
            text: this.lang.text['Nakama']['NeedLoginInfo'],
          });
          this.users.self['online'] = false;
          delete this.users.self['password'];
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
        case 401: // 비밀번호 잘못됨
          this.p5toast.show({
            text: this.lang.text['Nakama']['NeedAccountReset'],
          });
          this.users.self['online'] = false;
          delete this.users.self['password'];
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
        case 404: // 아이디 없음
          this.servers[info.isOfficial][info.target].session = await this.servers[info.isOfficial][info.target].client.authenticateEmail(this.users.self['email'], this.users.self['password'], true);
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
          let is_exist = await this.indexed.checkIfFileExist('servers/self/content.pck');
          if (is_exist) this.sync_save_file({ path: 'servers/self/content.pck' }, info.isOfficial, info.target, 'user_public', 'main_content');
          this.after_login(info.isOfficial, info.target, info.useSSL);
          break;
        default:
          this.p5toast.show({
            text: `(${info.name}) ${this.lang.text['Nakama']['UnexpectedLoginErr']}: ${e}`,
          });
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
      }
    }
  }

  /** 자기 자신과의 매칭 정보  
   * self_match[isOfficial][target] = Match
   */
  self_match = {};
  /** 로그인 및 회원가입 직후 행동들 */
  after_login(_is_official: any, _target: string, _useSSL: boolean) {
    // 통신 소켓 생성
    this.servers[_is_official][_target].socket = this.servers[_is_official][_target].client.createSocket(_useSSL);
    // 그룹 서버 연결 상태 업데이트
    this.set_group_statusBar('online', _is_official, _target);
    // 커뮤니티 서버를 쓰는 관리자모드 검토
    this.servers[_is_official][_target].client.getAccount(
      this.servers[_is_official][_target].session).then(v => {
        let metadata = JSON.parse(v.user.metadata);
        this.servers[_is_official][_target].info.is_admin = metadata['is_admin'];
      });
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
    // 서버에서 나와 연관있는 모든 사용자 정보 읽어오기
    this.server_user_info_update(_is_official, _target);
    this.load_server_todo(_is_official, _target);
    // 통신 소켓 연결하기
    this.connect_to(_is_official, _target, async (socket) => {
      await this.get_group_list_from_server(_is_official, _target);
      this.redirect_channel(_is_official, _target);
      if (!this.noti_origin[_is_official]) this.noti_origin[_is_official] = {};
      if (!this.noti_origin[_is_official][_target]) this.noti_origin[_is_official][_target] = {};
      this.update_notifications(_is_official, _target);
      this.servers[_is_official][_target].client.readStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: 'self_share',
          key: 'private_match',
          user_id: this.servers[_is_official][_target].session.user_id,
        }]
      }).then(async v => {
        try {
          if (!this.self_match[_is_official]) this.self_match[_is_official] = {};
          if (!this.self_match[_is_official][_target]) this.self_match[_is_official][_target] = undefined;
          this.self_match[_is_official][_target] = await socket.joinMatch(v.objects[0].value['match_id']);
          return; // 매치 진입 성공인 경우
        } catch (e) {
          socket.createMatch().then(v => {
            this.self_match[_is_official][_target] = v;
            this.servers[_is_official][_target].client.writeStorageObjects(
              this.servers[_is_official][_target].session, [{
                collection: 'self_share',
                key: 'private_match',
                permission_read: 1,
                permission_write: 1,
                value: { match_id: v.match_id },
              }],
            );
          });
        }
      });
    });
  }

  /** 서버에 저장시킨 해야할 일 목록 불러오기 */
  load_server_todo(_is_official: string, _target: string, _cursor?: string) {
    this.servers[_is_official][_target].client.listStorageObjects(
      this.servers[_is_official][_target].session, 'server_todo',
      this.servers[_is_official][_target].session.user_id, 1, _cursor
    ).then(v => {
      if (v.objects.length)
        this.modify_remote_info_as_local(v.objects[0].value, _is_official, _target);
      if (v.cursor) this.load_server_todo(_is_official, _target, v.cursor);
    });
  }

  /** 원격 정보를 로컬에 맞게 수정, 그 후 로컬에 다시 저장하기 */
  modify_remote_info_as_local(todo_info: any, _is_official: string, _target: string) {
    todo_info['remote']['name'] = this.servers[_is_official][_target].info.name;
    todo_info['remote']['isOfficial'] = _is_official;
    todo_info['remote']['target'] = _target;
    todo_info['remote']['type'] = `${_is_official}/${_target}`;
    this.set_todo_notification(todo_info);
    if (this.global.godot_window['add_todo']) this.global.godot_window['add_todo'](JSON.stringify(todo_info));
    this.indexed.saveTextFileToUserPath(JSON.stringify(todo_info), `todo/${todo_info['id']}/info.todo`);
  }

  /** 저장된 그룹 업데이트하여 반영 */
  async load_groups(_is_official: string, _target: string, _gid: string) {
    // 온라인이라면 서버정보로 덮어쓰기
    let channel_id = this.groups[_is_official][_target][_gid]['channel_id'];
    if (this.statusBar.groupServer[_is_official][_target] == 'online') {
      if (this.groups[_is_official][_target][_gid]['status'] != 'missing')
        await this.servers[_is_official][_target].client.listGroupUsers(
          this.servers[_is_official][_target].session, _gid
        ).then(v => { // 삭제된 그룹 여부 검토
          if (!v.group_users.length) { // 그룹 비활성중
            this.groups[_is_official][_target][_gid]['status'] = 'missing';
            this.channels_orig[_is_official][_target][channel_id]['status'] = 'missing';
            this.save_channels_with_less_info();
          } else { // 그룹 활성중
            let am_i_lost = true;
            // 내가 이 그룹에 아직 남아있는지 검토
            for (let i = 0, j = v.group_users.length; i < j; i++)
              if (v.group_users[i].user.id == this.servers[_is_official][_target].session.user_id) {
                switch (v.group_users[i].state) {
                  case 0: // superadmin
                  case 1: // admin
                  case 2: // member
                    this.groups[_is_official][_target][_gid]['status'] = 'online';
                    break;
                  case 3: // request
                    this.groups[_is_official][_target][_gid]['status'] = 'pending';
                    break;
                  default:
                    console.warn('이해할 수 없는 코드 반환: ', v.group_users[i].state);
                    this.groups[_is_official][_target][_gid]['status'] = 'missing';
                    break;
                }
                am_i_lost = false;
                v.group_users[i]['is_me'] = true;
                break;
              }
            if (am_i_lost) { // 그룹은 있으나 구성원은 아님
              this.groups[_is_official][_target][_gid]['status'] = 'missing';
              if (channel_id) // 그룹 수락이 안되어있는 경우
                this.channels_orig[_is_official][_target][channel_id]['status'] = 'missing';
              this.save_channels_with_less_info();
            }
          }
          if (v.group_users.length)
            this.groups[_is_official][_target][_gid]['users'] = v.group_users;
          v.group_users.forEach(async User => {
            if (User['is_me'])
              User['user'] = this.users.self;
            else {
              if (User['user'].id != this.servers[_is_official][_target].session.user_id
                && (this.load_other_user(User['user'].id, _is_official, _target)['avatar_url'] != User['user'].avatar_url
                  || !this.load_other_user(User['user'].id, _is_official, _target)['img']))
                await this.servers[_is_official][_target].client.readStorageObjects(
                  this.servers[_is_official][_target].session, {
                  object_ids: [{
                    collection: 'user_public',
                    key: 'profile_image',
                    user_id: User['user']['id'],
                  }],
                }).then(v => {
                  if (v.objects.length)
                    User['user']['img'] = v.objects[0].value['img'];
                  else delete User['user']['img'];
                  this.save_other_user(User['user'], _is_official, _target);
                });
              else this.save_other_user(User['user'], _is_official, _target);
            }
          });
          this.save_groups_with_less_info();
        });
    }
  }

  /** 이 서버 내 나와 접촉한 모든 사용자 정보 업데이트 */
  server_user_info_update(_is_official: string, _target: string) {
    this.indexed.GetFileListFromDB(`${_is_official}/${_target}/users/`, list => {
      let users = [];
      list.forEach(path => {
        let getUserId = path.split('/')[4];
        if (!users.includes(getUserId))
          users.push(getUserId);
      });
      users.forEach(userId => {
        if (this.servers[_is_official][_target].session.user_id != userId)
          this.load_other_user(userId, _is_official, _target);
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
  load_other_user(userId: string, _is_official: string, _target: string, _CallBack = (userInfo: any) => { }) {
    let already_use_callback = false;
    if (!this.users[_is_official][_target]) this.users[_is_official][_target] = {};
    if (!this.users[_is_official][_target][userId]) {
      this.users[_is_official][_target][userId] = {};
      this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/users/${userId}/profile.json`, (e, v) => {
        if (e && v) {
          let data = JSON.parse(v);
          let keys = Object.keys(data);
          keys.forEach(key => this.users[_is_official][_target][userId][key] = data[key]);
          if (!already_use_callback) {
            _CallBack(this.users[_is_official][_target][userId]);
            already_use_callback = true;
          }
        } else {
          this.servers[_is_official][_target].client.getUsers(
            this.servers[_is_official][_target].session, [userId])
            .then(v => {
              if (v.users.length) {
                let keys = Object.keys(v.users[0]);
                keys.forEach(key => this.users[_is_official][_target][userId][key] = v.users[0][key]);
                if (!already_use_callback) {
                  _CallBack(this.users[_is_official][_target][userId]);
                  already_use_callback = true;
                }
                this.save_other_user(this.users[_is_official][_target][userId], _is_official, _target);
              } else { // 없는 사용자 기록 삭제
                this.indexed.GetFileListFromDB(`${_is_official}/${_target}/users/${userId}`, list => {
                  list.forEach(path => this.indexed.removeFileFromUserPath(path));
                });
              }
            });
        }
      });
      if (!this.users[_is_official][_target][userId]['img']) {
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
                if (!already_use_callback) {
                  _CallBack(this.users[_is_official][_target][userId]);
                  already_use_callback = true;
                }
                this.save_other_user(this.users[_is_official][_target][userId], _is_official, _target);
              }).catch(_e => {
                if (this.users[_is_official][_target][userId]['img']) {
                  delete this.users[_is_official][_target][userId]['img'];
                  if (!already_use_callback) {
                    _CallBack(this.users[_is_official][_target][userId]);
                    already_use_callback = true;
                  }
                  this.save_other_user(this.users[_is_official][_target][userId], _is_official, _target);
                }
              });
        });
      } else this.save_other_user(this.users[_is_official][_target][userId], _is_official, _target);
    }
    return this.users[_is_official][_target][userId];
  }

  /** 다른 사람의 정보 간소화하여 저장하기 */
  save_other_user(userInfo: any, _is_official: string, _target: string) {
    let copied = JSON.parse(JSON.stringify(userInfo));
    if (userInfo['id'] == this.servers[_is_official][_target].session.user_id) return;
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
              if (_user.user.id != this.servers[_is_official][_target].session.user_id)
                if (!this.users[_is_official][_target][_user.user['id']])
                  this.save_other_user(_user.user, _is_official, _target);
              if (_user.user.id == this.servers[_is_official][_target].session.user_id)
                _user.user['is_me'] = true;
              else if (!this.users[_is_official][_target][_user.user['id']]) this.save_other_user(_user.user, _is_official, _target);
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
    if (!this.groups[_is_official][_target][gid]['users']) this.groups[_is_official][_target][gid]['users'] = [];
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
    let already_registered = false;
    for (let i = 0, j = this.registered_id.length; i < j; i++)
      if (this.registered_id[i] == expectation_number) {
        already_registered = true;
        this.registered_id.splice(i, 1);
        break;
      } // ^ 검토할 숫자를 줄이기 위해 기존 정보를 삭제함
    if (already_registered)
      return this.check_If_RegisteredId(expectation_number + 1);
    else return expectation_number;
  }
  /** 기등록된 아이디 수집 */
  registered_id: number[] = [];
  /** 세션 재접속 시 기존 정보를 이용하여 채팅방에 다시 로그인함  
   * 개인 채팅에 대해서만 검토
   */
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
              case 2: // 1:1 채팅
              case 3: // 그룹 채팅
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
  limit_image_size(base64: string, _CallBack: Function = (_rv: string) => { }) {
    const SIZE_LIMIT = 245000;
    new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.loadImage(base64, v => {
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
        .then(async v => {
          if (!v) {
            console.warn('그룹 join 실패... 벤 당했을 때인듯? 향후에 검토 필');
            return;
          }
          await server.client.listGroups(server.session, _info['name']).then(async v => {
            for (let i = 0, j = v.groups.length; i < j; i++)
              if (v.groups[i].id == _info['id']) {
                let pending_group = v.groups[i];
                pending_group['status'] = pending_group.open ? 'online' : 'pending';
                pending_group['server'] = this.servers[server.info.isOfficial][server.info.target].info;
                await this.servers[server.info.isOfficial][server.info.target].client.listGroupUsers(
                  this.servers[server.info.isOfficial][server.info.target].session, v.groups[i].id
                ).then(_list => {
                  pending_group['users'] = _list.group_users;
                  _list.group_users.forEach(_guser => {
                    if (_guser.user.id == this.servers[server.info.isOfficial][server.info.target].session.user_id)
                      _guser['is_me'] = true;
                    else this.save_other_user(_guser.user, server.info.isOfficial, server.info.target);
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
                });
                this.save_group_info(pending_group, server.info.isOfficial, server.info.target);
                if (pending_group.open) { // 열린 그룹이라면 즉시 채널에 참가
                  this.join_chat_with_modulation(pending_group.id, 3, server.info.isOfficial, server.info.target, (c) => {
                    this.servers[server.info.isOfficial][server.info.target].client.listChannelMessages(
                      this.servers[server.info.isOfficial][server.info.target].session, c.id, 1, false)
                      .then(v => {
                        if (v.messages.length)
                          this.update_from_channel_msg(v.messages[0], server.info.isOfficial, server.info.target);
                      });
                  });
                }
                break;
              }
          });
        }).catch(async e => {
          switch (e.status) {
            case 400: // 그룹에 이미 있는데 그룹추가 시도함
              await server.client.listGroups(server.session, _info['name']).then(async v => {
                for (let i = 0, j = v.groups.length; i < j; i++)
                  if (v.groups[i].id == _info['id']) {
                    let pending_group = v.groups[i];
                    pending_group['status'] = pending_group.open ? 'online' : 'pending';
                    await this.servers[server.info.isOfficial][server.info.target].client.listGroupUsers(
                      this.servers[server.info.isOfficial][server.info.target].session, v.groups[i].id
                    ).then(_list => {
                      pending_group['users'] = _list.group_users;
                      _list.group_users.forEach(_guser => {
                        if (_guser.user.id == this.servers[server.info.isOfficial][server.info.target].session.user_id)
                          _guser['is_me'] = true;
                        else this.save_other_user(_guser.user, server.info.isOfficial, server.info.target);
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
            for (let i = 0, j = copied_group[_is_official][_target][_gid]['users'].length; i < j; i++) {
              if (copied_group[_is_official][_target][_gid]['users'][i]) {
                delete copied_group[_is_official][_target][_gid]['users'][i]['state'];
                if (copied_group[_is_official][_target][_gid]['users'][i]['user']['id']) {
                  copied_group[_is_official][_target][_gid]['users'][i]['user'] = { id: copied_group[_is_official][_target][_gid]['users'][i]['user']['id'] };
                  if (this.servers[_is_official][_target] && this.servers[_is_official][_target].session
                    && copied_group[_is_official][_target][_gid]['users'][i]['user']['id'] == this.servers[_is_official][_target].session.user_id)
                    copied_group[_is_official][_target][_gid]['users'][i]['is_me'] = true;
                } else if (!copied_group[_is_official][_target][_gid]['users'][i]['is_me']) copied_group[_is_official][_target][_gid]['users'].splice(i, 1);
              }
            }
        });
      });
    });
    this.indexed.saveTextFileToUserPath(JSON.stringify(copied_group), 'servers/groups.json', () => {
      _CallBack();
    });
  }

  /** 그룹 리스트 로컬/리모트에서 삭제하기 (방장일 경우) */
  async remove_group_list(info: any, _is_official: string, _target: string) {
    try { // 내가 방장이면 해산처리 우선, 이 외의 경우 기록 삭제
      if (this.servers[_is_official][_target] && info['creator_id'] == this.servers[_is_official][_target].session.user_id)
        await this.servers[_is_official][_target].client.deleteGroup(
          this.servers[_is_official][_target].session, info['id'],
        ).then(async v => {
          if (!v) console.warn('그룹 삭제 오류 검토 필요');
          this.remove_channel_files(_is_official, _target, info['channel_id']);
          this.servers[_is_official][_target].client.deleteStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: 'group_public',
              key: `group_${info['id']}`,
            }]
          }).then(_v => {
            throw "Remove group image well";
          }).catch(_e => {
            throw "No group image found";
          });
        });
      else throw "not a group creator";
    } catch (e) {
      console.log(e);
      delete this.groups[_is_official][_target][info['id']];
      this.save_groups_with_less_info();
      this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/groups/${info.id}.img`);
    }
  }

  /** 그룹 내에서 사용했던 서버 파일들 전부 삭제 */
  async remove_channel_files(_is_official: string, _target: string, channel_id: string, cursor?: string) {
    if (this.statusBar.groupServer[_is_official][_target] == 'online')
      await this.servers[_is_official][_target].client.listStorageObjects(
        this.servers[_is_official][_target].session, `file_${channel_id.replace(/[.]/g, '_')}`,
        this.servers[_is_official][_target].session.user_id, 1, cursor
      ).then(async v => {
        for (let i = 0, j = v.objects.length; i < j; i++)
          await this.servers[_is_official][_target].client.deleteStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: v.objects[i].collection,
              key: v.objects[i].key,
            }],
          });
        if (v.cursor) this.remove_channel_files(_is_official, _target, channel_id, v.cursor);
      });
  }

  /** 연결된 서버에서 자신이 참여한 그룹을 리모트에서 가져오기  
   * ***돌려주는 값이 없는 nakama.initialize 단계 함수, 사용하지 말 것**  
   * 그룹 채팅 채널 접속 및 그룹 사용자 검토도 이곳에서 시도함
   */
  async get_group_list_from_server(_is_official: string, _target: string) {
    if (!this.groups[_is_official]) this.groups[_is_official] = {};
    if (!this.groups[_is_official][_target]) this.groups[_is_official][_target] = {};
    await this.servers[_is_official][_target].client.listUserGroups(
      this.servers[_is_official][_target].session,
      this.servers[_is_official][_target].session.user_id)
      .then(v => {
        v.user_groups.forEach(async user_group => {
          if (!this.groups[_is_official][_target][user_group.group.id]) { // 로컬에 없던 그룹은 이미지 확인
            this.groups[_is_official][_target][user_group.group.id] = {};
            await this.servers[_is_official][_target].client.readStorageObjects(
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
          this.groups[_is_official][_target][user_group.group.id]['status'] = 'online';
          await this.servers[_is_official][_target].client.listGroupUsers(
            this.servers[_is_official][_target].session, user_group.group.id
          ).then(_guser => {
            _guser.group_users.forEach(_user => {
              if (_user.user.id == this.servers[_is_official][_target].session.user_id)
                _user.user['is_me'] = true;
              else this.save_other_user(_user.user, _is_official, _target);
              _user.user = this.load_other_user(_user.user.id, _is_official, _target);
              this.add_group_user_without_duplicate(_user, user_group.group.id, _is_official, _target);
            });
          });
          this.join_chat_with_modulation(user_group.group.id, 3, _is_official, _target, (_c) => {
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
    try {
      if (p['group_id']) { // 그룹 채널인 경우
        if (this.groups[_is_official][_target][p['group_id']]
          && this.groups[_is_official][_target][p['group_id']]['users']) {
          this.servers[_is_official][_target].client.listGroupUsers
          let user_length = this.groups[_is_official][_target][p['group_id']]['users'].length;
          if (user_length == 1) result_status = this.users.self['online'] ? 'online' : 'offline'; // 그룹에 혼자만 있음
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
    } catch (e) {
      result_status = this.statusBar.groupServer[_is_official][_target] == 'offline' ? 'offline' : 'missing';
    }
    if (this.channels_orig[_is_official][_target][p.channel_id || p.id]['status'] != 'missing')
      this.channels_orig[_is_official][_target][p.channel_id || p.id]['status'] = result_status;
  }

  check_if_online() {
    let as_admin = this.get_all_server_info(true, true);
    if (as_admin.length) {
      this.bgmode.setDefaults({
        title: this.lang.text['GlobalAct']['OnlineMode'],
        text: this.lang.text['GlobalAct']['OnlineMode_text'],
        icon: 'icon_mono',
        color: 'ffd94e', // 모자 밑단 노란색
      });
      this.bgmode.configure({
        title: this.lang.text['GlobalAct']['OnlineMode'],
        text: this.lang.text['GlobalAct']['OnlineMode_text'],
        icon: 'icon_mono',
        color: 'ffd94e', // 모자 밑단 노란색
      });
    } else {
      this.bgmode.setDefaults({
        title: this.lang.text['GlobalAct']['OfflineMode'],
        text: this.lang.text['GlobalAct']['OfflineMode_text'],
        icon: 'icon_mono',
        color: 'ffd94e', // 모자 밑단 노란색
      });
      this.bgmode.configure({
        title: this.lang.text['GlobalAct']['OfflineMode'],
        text: this.lang.text['GlobalAct']['OfflineMode_text'],
        icon: 'icon_mono',
        color: 'ffd94e', // 모자 밑단 노란색
      });
    }
  }

  /** 소켓이 행동할 때 행동중인 무언가가 있을 경우 검토하여 처리 */
  socket_reactive = {};
  /** 소켓 연결이 시작될 때 행동  
   * on_socket_connected[key] = function(void)
   */
  on_socket_connected = {};
  /** 소켓이 끊어질 때 행동  
   * on_socket_disconnected[key] = function(void)
   */
  on_socket_disconnected = {};
  /** 기능 매치 행동  
   * match_act[key] = function(void)
   */
  match_act = {};
  /** 소켓 서버에 연결 */
  connect_to(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _CallBack = (_socket: Socket) => { }) {
    this.servers[_is_official][_target].socket.connect(
      this.servers[_is_official][_target].session, true).then(_v => {
        let socket = this.servers[_is_official][_target].socket;
        let keys = Object.keys(this.on_socket_connected);
        keys.forEach(key => this.on_socket_connected[key]());
        // 실시간으로 알림을 받은 경우
        socket.onnotification = (v) => {
          this.act_on_notification(v, _is_official, _target);
          this.rearrange_notifications();
        }
        socket.onchannelpresence = (p) => {
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
            others.forEach(_userId => this.load_other_user(_userId, _is_official, _target));
            this.count_channel_online_member(p, _is_official, _target);
          }
          if (this.socket_reactive['others-online'])
            this.socket_reactive['others-online']();
        }
        socket.onmatchdata = (m) => {
          m['data_str'] = decodeURIComponent(new TextDecoder().decode(m.data));
          switch (m.op_code) {
            case MatchOpCode.ADD_TODO: {
              let sep = m['data_str'].split(',');
              switch (sep[0]) {
                case 'add':
                  this.servers[_is_official][_target].client.readStorageObjects(
                    this.servers[_is_official][_target].session, {
                    object_ids: [{
                      collection: sep[1],
                      key: sep[2],
                      user_id: this.servers[_is_official][_target].session.user_id,
                    }],
                  }).then(v => {
                    if (v.objects.length)
                      this.modify_remote_info_as_local(v.objects[0].value, _is_official, _target);
                  });
                  break;
                case 'done':
                  this.indexed.loadTextFromUserPath(`todo/${sep[1]}/info.todo`, (e, v) => {
                    if (e && v) {
                      let todo_info = JSON.parse(v);
                      todo_info.done = true;
                      this.modify_remote_info_as_local(todo_info, _is_official, _target);
                    }
                  });
                  break;
                case 'delete':
                  this.indexed.loadTextFromUserPath(`todo/${sep[1]}/info.todo`, (e, v) => {
                    if (e && v) {
                      let todo_info = JSON.parse(v);
                      this.indexed.GetFileListFromDB(`todo/${sep[1]}`, (v) => {
                        v.forEach(_path => this.indexed.removeFileFromUserPath(_path));
                        if (todo_info.noti_id)
                          if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
                            clearTimeout(this.web_noti_id[todo_info.noti_id]);
                            delete this.web_noti_id[todo_info.noti_id];
                          }
                        this.noti.ClearNoti(todo_info.noti_id);
                        let godot = this.global.godot.contentWindow || this.global.godot.contentDocument;
                        godot['remove_todo'](JSON.stringify(todo_info));
                      });
                    }
                  });
                  break;
                default:
                  console.warn('등록되지 않은 할 일 행동: ', m);
                  break;
              }
            }
              break;
            case MatchOpCode.EDIT_PROFILE: {
              switch (m['data_str']) {
                case 'info':
                  this.servers[_is_official][_target].client.getAccount(
                    this.servers[_is_official][_target].session).then(v => {
                      let keys = Object.keys(v.user);
                      keys.forEach(key => this.users.self[key] = v.user[key]);
                      this.save_self_profile();
                    });
                  break;
                case 'image':
                  this.servers[_is_official][_target].client.readStorageObjects(
                    this.servers[_is_official][_target].session, {
                    object_ids: [{
                      collection: 'user_public',
                      key: 'profile_image',
                      user_id: this.servers[_is_official][_target].session.user_id,
                    }],
                  }).then(v => {
                    if (v.objects.length) {
                      this.indexed.saveTextFileToUserPath(JSON.stringify(v.objects[0].value['img']), 'servers/self/profile.img');
                      this.users.self['img'] = v.objects[0].value['img'].replace(/"|=|\\/g, '');
                    } else this.indexed.removeFileFromUserPath('servers/self/profile.img');
                  });
                  break;
                case 'content': {
                  if (this.socket_reactive['self_profile_content_update'])
                    this.socket_reactive['self_profile_content_update']();
                }
                  break;
                default:
                  console.warn('예상하지 못한 프로필 동기화 정보: ', m);
                  break;
              }
            }
              break;
            case MatchOpCode.QR_SHARE: {
              this.act_from_QRInfo(m['data_str']);
              if (this.socket_reactive['qr-share']) this.socket_reactive['qr-share']();
            }
              break;
            case MatchOpCode.ENGINE_PPT: {

            }
              break;
            default:
              console.warn('예상하지 못한 동기화 정보: ', m);
              break;
          }
        }
        socket.onchannelmessage = (c) => {
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
          if (this.channels_orig[_is_official] && this.channels_orig[_is_official][_target]) {
            let channel_ids = Object.keys(this.channels_orig[_is_official][_target]);
            channel_ids.forEach(_cid => {
              if (this.channels_orig[_is_official][_target][_cid]['status'] != 'missing')
                delete this.channels_orig[_is_official][_target][_cid]['status'];
            });
            this.rearrange_channels();
          }
          if (this.groups[_is_official] && this.groups[_is_official][_target]) {
            let groups_id = Object.keys(this.groups[_is_official][_target]);
            groups_id.forEach(_gid => {
              this.groups[_is_official][_target][_gid]['status'] = 'offline';
            });
          }
          this.set_group_statusBar('pending', _is_official, _target);
          let keys = Object.keys(this.on_socket_disconnected);
          keys.forEach(key => this.on_socket_disconnected[key]());
        }
        _CallBack(socket);
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
            base[i] = _msg;
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
    }).catch(e => {
      let err_info: string = '';
      switch (e.code) {
        case 3: // 사용자 정보 없음 (계정 삭제의 경우)
          err_info = this.lang.text['Nakama']['AddChannelFailed_Code3'];
          break;
        default:
          err_info = e.message;
          break;
      }
      this.p5toast.show({
        text: `${this.lang.text['Nakama']['AddChannelFailed']}: ${err_info}`,
      });
      _CallBack(undefined);
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
    if (!is_me && is_new) {
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
        if (ev && ev['id'] == this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id']) {
          this.go_to_chatroom_without_admob_act(this.channels_orig[_is_official][_target][msg.channel_id]);
        } else this.go_to_chatroom_without_admob_act(this.channels_orig[_is_official][_target][msg.channel_id]);
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
        console.log('예상하지 못한 채널 메시지 코드: ', c);
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

  /** 메시지를 엔터 단위로 분리, 메시지 내 하이퍼링크가 있는 경우 검토 */
  content_to_hyperlink(msg: any) {
    if (!msg.content['msg']) return;
    let sep_msg = msg.content['msg'].split('\n');
    msg.content['msg'] = [];
    sep_msg.forEach(_msg => {
      if (_msg) msg.content['msg'].push([{ text: _msg }]);
    });
    for (let i = 0, j = msg.content['msg'].length; i < j; i++)
      if (msg.content['msg'][i][0]['text']) { // 메시지가 포함되어있는 경우에 한함
        let index = msg.content['msg'][i][0]['text'].indexOf('http://');
        if (index < 0)
          index = msg.content['msg'][i][0]['text'].indexOf('https://');
        if (index >= 0) { // 주소가 있는 경우 추출
          let result_msg = [];
          let front_msg: string;
          if (index != 0) {
            front_msg = msg.content['msg'][i][0]['text'].substring(0, index);
            result_msg.push({ text: front_msg });
          }
          let AddrHead = msg.content['msg'][i][0]['text'].substring(index);
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
          msg.content['msg'][i] = result_msg;
          // } else { // 주소가 없는 경우 양식을 일치시킴
          //   msg.content['msg'][i] = [msg.content['msg'][i]];
        }
      }
  }

  /** 발신인 표시를 위한 메시지 추가 가공 */
  check_sender_and_show_name(c: ChannelMessage, _is_official: string, _target: string) {
    c['color'] = (c.sender_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
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
    this.translate_updates(c);
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
        setTimeout(() => {
          this.count_channel_online_member(c, _is_official, _target);
        }, 50);
        break;
      case 5: // 그룹에 있던 사용자 나감(들어오려다가 포기한 사람 포함)
        c.content['user_update'] = target;
        c.content['noti'] = `${this.lang.text['Nakama']['GroupUserOut']}: ${target['display_name']}`;
        setTimeout(() => {
          this.count_channel_online_member(c, _is_official, _target);
        }, 50);
        break;
      case 6: // 누군가 그룹에서 내보내짐 (kick)
        c.content['user_update'] = target;
        c.content['noti'] = `${this.lang.text['Nakama']['GroupUserKick']}: ${target['display_name']}`;
        setTimeout(() => {
          this.count_channel_online_member(c, _is_official, _target);
        }, 50);
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
        case 'modify_content':
          msg.content['noti'] = `${this.lang.text['Profile']['user_content_changed']}${msg.content['noti_form']}`;
          break;
        case 'remove_content':
          msg.content['noti'] = `${this.lang.text['Profile']['user_content_removed']}${msg.content['noti_form']}`;
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

  /** 그룹 채널 사용자 상태 변경 처리 */
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
      case 'modify_content':
      case 'remove_content':
        if (this.socket_reactive['other_user_content_update'])
          this.socket_reactive['other_user_content_update']();
        break;
      default:
        console.warn('예상하지 못한 그룹 사용자 행동: ', c);
        break;
    }
  }

  /** 알림 내용 클릭시 행동 */
  check_notifications(this_noti: Notification, _is_official: string, _target: string) {
    let this_server = this.servers[_is_official][_target];
    switch (this_noti.code) {
      case 0: // 예약된 알림
        break;
      case -2: // 친구 요청 받음
        break;
      case 1: // 전체 알림 수신
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
      case 1: // 전체 알림 메시지 수신
        this.servers[_is_official][_target].client.deleteNotifications(
          this.servers[_is_official][_target].session, [v['id']]).then(b => {
            if (!b) console.warn('알림 거부처리 검토 필요');
            this.update_notifications(_is_official, _target);
          });
        this.noti.PushLocal({
          id: v.code,
          title: this.servers[_is_official][_target].info.name,
          body: decodeURIComponent(v.content['msg']),
          image: decodeURIComponent(v.content['uri']),
          smallIcon_ln: 'diychat',
          group_ln: 'all_user_noti',
          iconColor_ln: 'ff754e',
        }, 'global_noti_all', (_ev: any) => {
          this.check_notifications(v, _is_official, _target);
        });
        break;
      case 0: // 예약된 알림
        v['request'] = `${v.code}-${v.subject}`;
        break;
      case -1: // 오프라인이거나 채널에 없을 때 알림 받음
        // 모든 채팅에 대한건지, 1:1에 한정인지 검토 필요
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
        this.servers[_is_official][_target].client.listGroupUsers(
          this.servers[_is_official][_target].session, v.content['group_id'])
          .then(v => {
            if (v.group_users.length) {
              v.group_users.forEach(user => {
                this.load_other_user(user.user.id, _is_official, _target);
              });
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
        if (this.socket_reactive['group_detail'] && this.socket_reactive['group_detail'].info.id == v.content['group_id'])
          this.socket_reactive['group_detail'].update_from_notification(v);
        this.noti.RemoveListener(`check${v.code}`);
        this.noti.SetListener(`check${v.code}`, (_v: any) => {
          this.noti.ClearNoti(_v['id']);
          this.noti.RemoveListener(`check${v.code}`);
          if (this.socket_reactive['group_detail']) return;
          this.modalCtrl.create({
            component: GroupDetailPage,
            componentProps: {
              info: this.groups[_is_official][_target][v.content['group_id']],
              server: this.servers[_is_official][_target].info,
            },
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

  /**
   * 채널에서 백그라운드 파일 발송 요청
   * @param msg 메시지 정보
   * @param path indexedDB 파일 경로
   */
  async WriteStorage_From_channel(msg: any, path: string, _is_official: string, _target: string, startFrom = 0) {
    let _msg = JSON.parse(JSON.stringify(msg));
    let part_len = await this.global.req_file_len(path);
    let partsize = Math.ceil(part_len / 120000);
    for (let i = startFrom; i < partsize; i++)
      try {
        await this.servers[_is_official][_target].client.writeStorageObjects(
          this.servers[_is_official][_target].session, [{
            collection: `file_${_msg.channel_id.replace(/[.]/g, '_')}`,
            key: `msg_${_msg.message_id}_${i}`,
            permission_read: 2,
            permission_write: 1,
            value: { data: await this.global.req_file_part_base64(path, i, part_len) },
          }])
        msg.content['transfer_index'] = partsize - i;
      } catch (e) {
        this.p5toast.show({
          text: `${this.lang.text['Nakama']['FailedUpload']}: ${e}`,
        });
        break;
      }
    setTimeout(() => {
      delete msg.content['transfer_index'];
      this.global.remove_req_file_info(path);
    }, 100);
  }

  /**
   * 채널 메시지에 기반하여 파일 다운받기
   * @param msg 메시지 정보
   */
  async ReadStorage_From_channel(msg: any, path: string, _is_official: string, _target: string, _CallBack = (_blob: Blob) => { }, startFrom = 0) {
    let _msg = JSON.parse(JSON.stringify(msg));
    // 이미 진행중이라면 무시
    for (let i = startFrom, j = _msg.content['partsize']; i < j; i++)
      try {
        let v = await this.servers[_is_official][_target].client.readStorageObjects(
          this.servers[_is_official][_target].session, {
          object_ids: [{
            collection: `file_${_msg.channel_id.replace(/[.]/g, '_')}`,
            key: `msg_${_msg.message_id}_${i}`,
            user_id: _msg['sender_id'],
          }]
        });
        await this.global.save_file_part(path, i, v.objects[0].value['data']);
        msg.content['transfer_index'] = j - i;
      } catch (e) {
        this.p5toast.show({
          text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`,
        });
        break;
      }
    setTimeout(async () => {
      let blob = await this.indexed.loadBlobFromUserPath(path, _msg.content['type'] || '')
      if (_CallBack) _CallBack(blob);
      msg.content['text'] = [this.lang.text['ChatRoom']['downloaded']];
      delete msg.content['transfer_index'];
      this.global.remove_req_file_info(path);
    }, 100);
  }

  /** 로컬 파일을 저장하며 원격에 분산하여 올리기 */
  async sync_save_file(info: FileInfo, _is_official: string, _target: string, _collection: string, _key_force = '') {
    try {
      // 여기서 파일 정보를 받아와야함 (전체 길이, 파트 수)
      let base64 = info.base64 || await this.global.GetBase64ThroughFileReader(await this.indexed.loadBlobFromUserPath(info.path, info.type || ''));
      delete info.base64;
      await this.indexed.saveBase64ToUserPath(base64, info.path);
      let separate = base64.match(/(.{1,220000})/g);
      info.partsize = separate.length;
      await this.servers[_is_official][_target].client.writeStorageObjects(
        this.servers[_is_official][_target].session, [{
          collection: _collection,
          key: _key_force || info.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120),
          permission_read: 2,
          permission_write: 1,
          value: info,
        }]);
      // 여기서 전체 길이로 for문을 돌리고 매 회차마다 파트를 받아서 base64 변환 후 집어넣어야 함
      for (let i = separate.length - 1, j = i; i >= 0; i--) {

        await this.servers[_is_official][_target].client.writeStorageObjects(
          this.servers[_is_official][_target].session, [{
            collection: _collection,
            key: `${_key_force}_${j - i}` || (info.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120) + `_${j - i}`),
            permission_read: 2,
            permission_write: 1,
            value: { data: separate.shift() },
          }]);
      }
    } catch (e) {
      console.log('SyncSaveFailed: ', e);
    }
  }

  /** 로컬에 있는 파일을 불러오기, 로컬에 없다면 원격에서 요청하여 생성 후 불러오기
   * @returns 파일의 blob
   */
  async sync_load_file(info: FileInfo, _is_official: string, _target: string, _collection: string, _userid = '', _key_force = '') {
    try {
      return await this.indexed.loadBlobFromUserPath(info.path, info.type || '');
    } catch (e) {
      try {
        let file_info = await this.servers[_is_official][_target].client.readStorageObjects(
          this.servers[_is_official][_target].session, {
          object_ids: [{
            collection: _collection,
            key: _key_force || info.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120),
            user_id: _userid || this.servers[_is_official][_target].session.user_id,
          }],
        });
        let info_json: FileInfo = file_info.objects[0].value;
        let merged = '';
        for (let i = 0; i < info_json.partsize; i++) {
          let part = await this.servers[_is_official][_target].client.readStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: _collection,
              key: `${_key_force}_${i}` || (info.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120) + `_${i}`),
              user_id: _userid || this.servers[_is_official][_target].session.user_id,
            }],
          });
          merged += part.objects[0].value['data'].replace(/"|=|\\/g, '');
        }
        await this.indexed.saveBase64ToUserPath(merged, info.path);
        return await this.indexed.loadBlobFromUserPath(info.path, info.type || '');
      } catch (e) {
        console.log('SyncLoadFailed:', e);
        return null;
      }
    }
  }

  /** 로컬 파일을 삭제하며 원격 분산파일도 삭제하기 */
  async sync_remove_file(path: string, _is_official: string, _target: string, _collection: string, _userid: string = '') {
    try {
      await this.indexed.removeFileFromUserPath(path);
      let file_info = await this.servers[_is_official][_target].client.readStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: _collection,
          key: path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120),
          user_id: _userid || this.servers[_is_official][_target].session.user_id,
        }],
      });
      let info_json: FileInfo = file_info.objects[0].value;
      for (let i = 0; i < info_json.partsize; i++) {
        await this.servers[_is_official][_target].client.deleteStorageObjects(
          this.servers[_is_official][_target].session, {
          object_ids: [{
            collection: _collection,
            key: info_json.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120) + `_${i}`,
          }],
        });
      }
      await this.servers[_is_official][_target].client.deleteStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: _collection,
          key: info_json.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120),
        }],
      });
    } catch (e) {
      console.log('SyncRemoveFailed: ', e);
    }
  }

  act_from_QRInfo(v: string) {
    let json: any[] = JSON.parse(v);
    for (let i = 0, j = json.length; i < j; i++)
      switch (json[i].type) {
        case 'QRShare':
          this.modalCtrl.create({
            component: QrSharePage,
          }).then(v => v.present());
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
            let new_server_info: ServerInfo = {
              name: json[i].value.name,
              target: json[i].value.target,
              address: json[i].value.address,
              port: json[i].value.port,
              useSSL: json[i].value.useSSL,
              isOfficial: json[i].value.isOfficial,
              key: json[i].value.key,
            };
            this.add_group_server(new_server_info, () => {
              this.init_session(new_server_info);
            });
          }
          return;
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
        case 'EnginePPTLink': // 엔진PPT를 컴퓨터와 연결하기
          this.modalCtrl.create({
            component: EnginepptPage,
            componentProps: {
              pid: json[i]['pid'],
            },
          }).then(v => {
            v.present();
          });
          break;
        default: // 동작 미정 알림(debug)
          throw "지정된 틀 아님";
      }
  }
}
