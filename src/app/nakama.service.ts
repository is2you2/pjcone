// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable, NgZone } from '@angular/core';
import { Channel, ChannelMessage, Client, Group, GroupUser, Match, Notification, Session, Socket, User } from "@heroiclabs/nakama-js";
import { SERVER_PATH_ROOT, isPlatform } from './app.component';
import { IndexedDBService } from './indexed-db.service';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';
import * as p5 from 'p5';
import { LocalNotiService } from './local-noti.service';
import { AlertController, IonicSafeString, LoadingController, ModalController, NavController, mdTransitionAnimation } from '@ionic/angular';
import { GroupDetailPage } from './portal/settings/group-detail/group-detail.page';
import { LanguageSettingService } from './language-setting.service';
import { AdMob, AdMobRewardItem, RewardAdOptions, RewardAdPluginEvents } from '@capacitor-community/admob';
import { FILE_BINARY_LIMIT, FileInfo, GlobalActService } from './global-act.service';
import { MinimalChatPage } from './minimal-chat/minimal-chat.page';
import { ServerDetailPage } from './portal/settings/group-server/server-detail/server-detail.page';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { VoidDrawPage } from './portal/subscribes/chat-room/void-draw/void-draw.page';

/** 서버 상세 정보 */
export interface ServerInfo {
  /** 표시명, 앱 내 구성키는 target 사용 */
  name?: string;
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
  MANAGE_TODO = 10,
  /** 프로필 정보/이미지 수정 */
  EDIT_PROFILE = 11,
  /** 새로운 채널에 참여됨 */
  ADD_CHANNEL = 14,
  /** WebRTC 시작 요청 */
  WEBRTC_INIT_REQ_SIGNAL = 20,
  /** 초기 요청에 응답 */
  WEBRTC_REPLY_INIT_SIGNAL = 21,
  /** 답변에 반응하기 */
  WEBRTC_RECEIVE_ANSWER = 22,
  /** iceCandidate 정보 교환 */
  WEBRTC_ICE_CANDIDATES = 23,
  /** Stream 변경 등으로 재교환시 */
  WEBRTC_NEGOCIATENEEDED = 24,
  /** 다른 기기에서 통화를 수신함 */
  WEBRTC_RECEIVED_CALL_SELF = 25,
  /** 통화 종료함 */
  WEBRTC_HANGUP = 30,
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
    private loadingCtrl: LoadingController,
    private nav: NavController,
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

  /** 채널 리스트에 서버 이름 표시 여부 */
  showServer = false;

  async initialize() {
    // 기등록 알림 id 검토
    this.noti.GetNotificationIds((list) => {
      this.registered_id = list;
    });
    await this.set_all_todo_notification();
    let profile = await this.indexed.loadTextFromUserPath('servers/self/profile.json');
    if (profile) this.users.self = JSON.parse(profile);
    try {
      let profile_image = (await this.indexed.loadTextFromUserPath('servers/self/profile.img')).replace(/"|\\|=/g, '');
      if (profile_image) this.users.self['img'] = profile_image;
    } catch (e) { }
    // 저장된 사설서버들 정보 불러오기
    let list_detail = await this.indexed.loadTextFromUserPath('servers/list_detail.csv');
    if (list_detail) { // 내용이 있을 때에만 동작
      let list: string[] = list_detail.split('\n');
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
    } else { // 저장된 사설서버가 따로 없음, 사용자가 로그인을 원함
      let has_data = location.href.split('?').length > 1;
      if (this.users.self['online'] || has_data)
        this.toggle_all_session();
    }
    this.catch_group_server_header('offline');
    // 서버별 그룹 정보 불러오기
    let groups = await this.indexed.loadTextFromUserPath('servers/groups.json');
    if (groups)
      this.groups = JSON.parse(groups);
    let all_groups = this.rearrange_group_list();
    all_groups.forEach(async group => {
      let group_img = await this.indexed.loadTextFromUserPath(`servers/${group['server']['isOfficial']}/${group['server']['target']}/groups/${group.id}.img`);
      if (group_img) group['img'] = group_img.replace(/"|=|\\/g, '');
      if (group['status'] != 'missing') {
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
    await this.load_channel_list();
    // 마지막 상태바 정보 불러오기: 사용자의 연결 여부 의사가 반영되어있음
    let list = await this.indexed.loadTextFromUserPath('servers/list.json');
    if (list)
      this.statusBar.groupServer = JSON.parse(list);
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
    this.showServer = Boolean(localStorage.getItem('showServer'));
  }

  /** 시작시 해야할 일 알림을 설정 */
  async set_all_todo_notification() {
    let _list = await this.indexed.GetFileListFromDB('info.todo');
    for (let i = 0, j = _list.length; i < j; i++) {
      let v = await this.indexed.loadTextFromUserPath(_list[i]);
      if (v) {
        let noti_info = JSON.parse(v);
        this.registered_id.push(noti_info.noti_id);
        this.set_todo_notification(noti_info);
      }
    }
  }

  async getGodotDBRecursive() {
    try {
      if (this.indexed.godotDB === undefined)
        throw 'Retry catch godotDB';
      return;
    } catch (e) {
      await new Promise((done) => {
        setTimeout(() => {
          done(undefined);
        }, 100);
      });
      return await this.getGodotDBRecursive();
    }
  }

  /** 할 일이 열린 상태에서 다른 할 일 열람시 행동 */
  AddTodoLinkAct: Function;
  open_add_todo_page(info: string = '') {
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
  async set_todo_notification(noti_info: any) {
    // 시작 시간이 있으면 시작할 때 알림, 시작시간이 없으면 끝날 때 알림
    let targetTime = noti_info.startFrom || noti_info.limit;
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') { // 웹은 예약 발송이 없으므로 지금부터 수를 세야함
      let ScheduleAt = new Date(targetTime).getTime() - new Date().getTime();
      if (ScheduleAt > 0 && ScheduleAt < 2000000000) { // settimeout 최댓값이 있는 것 같다
        let schedule = setTimeout(() => {
          this.noti.PushLocal({
            id: noti_info.noti_id,
            title: noti_info.title,
            body: noti_info.description,
          }, undefined, (_ev: any) => {
            this.open_add_todo_page(JSON.stringify(noti_info));
          });
        }, ScheduleAt);
        this.web_noti_id[noti_info.noti_id] = schedule;
      }
    } else { // 모바일은 예약 발송을 설정
      let schedule_at = new Date(targetTime).getTime();
      for (let i = 0, j = this.registered_id.length; i < j; i++)
        if (this.registered_id[i] == noti_info.id) {
          this.registered_id.splice(i, 1);
          noti_info.id = this.get_noti_id();
          if (!noti_info['done'] && noti_info['remote']) { // 서버 할 일이라면 알림 재등록
            let isOfficial = noti_info['remote']['isOfficial'];
            let target = noti_info['remote']['target'];
            try {
              await this.servers[isOfficial][target].client.writeStorageObjects(
                this.servers[isOfficial][target].session, [{
                  collection: 'server_todo',
                  key: noti_info['id'],
                  permission_read: 2,
                  permission_write: 1,
                  value: noti_info,
                }]).then(async v => {
                  await this.servers[isOfficial][target]
                    .socket.sendMatchState(this.self_match[isOfficial][target].match_id, MatchOpCode.MANAGE_TODO,
                      encodeURIComponent(`add,${v.acks[0].collection},${v.acks[0].key}`));
                });
            } catch (e) {
              console.log('서버 알림 재등록 실패: ', e);
            }
          }
          break;
        }
      if (!noti_info['done'] && schedule_at > new Date().getTime()) {
        let color = '58a192'; // 메모
        switch (noti_info.importance) {
          case '1': // 기억해야 함
            color = 'ddbb41';
            break;
          case '2': // 중요함
            color = 'b95437';
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

  /** 공식 테스트 서버를 대상으로 Nakama 클라이언트 구성을 진행합니다. */
  init_server(_info: ServerInfo) {
    if (!this.servers[_info.isOfficial][_info.target]) this.servers[_info.isOfficial][_info.target] = {};
    this.servers[_info.isOfficial][_info.target].client = new Client(
      (_info.key || 'defaultkey'), _info.address,
      (_info.port || 7350).toString(),
      (_info.useSSL || false),
    );
  }

  /** 채팅 채널이 열려있는 경우 행동시키기 */
  ChatroomLinkAct: Function;
  /** subscribe과 localPush의 채팅방 입장 행동을 통일함 */
  go_to_chatroom_without_admob_act(_info: any, _file?: FileInfo) {
    this.has_new_channel_msg = false;
    this.rearrange_channels();
    if (this.ChatroomLinkAct)
      this.ChatroomLinkAct(_info, _file);
    else this.ngZone.run(() => {
      this.navCtrl.navigateForward('chat-room', {
        animation: mdTransitionAnimation,
        state: {
          info: _info,
          file: _file,
        },
      });
    });
  }

  /** 모든 pending 세션 켜기 */
  async init_all_sessions() {
    let Targets = Object.keys(this.servers['official']);
    for (let i = 0, j = Targets.length; i < j; i++)
      await this.init_session(this.servers['official'][Targets[i]].info);
    let unTargets = Object.keys(this.servers['unofficial']);
    for (let i = 0, j = unTargets.length; i < j; i++)
      await this.init_session(this.servers['unofficial'][unTargets[i]].info);
    return Targets.length + unTargets.length;
  }

  /** 모든 서버 로그아웃처리 */
  logout_all_server() {
    let IsOfficials = Object.keys(this.statusBar.groupServer);
    for (let i = 0, j = IsOfficials.length; i < j; i++) {
      let Targets = Object.keys(this.statusBar.groupServer[IsOfficials[i]]);
      for (let k = 0, l = Targets.length; k < l; k++) {
        if (this.statusBar.groupServer[IsOfficials[i]][Targets[k]] == 'online')
          if (this.servers[IsOfficials[i]][Targets[k]].socket) {
            this.servers[IsOfficials[i]][Targets[k]].socket.disconnect(true);
          } else this.link_group(IsOfficials[i], Targets[k], false);
      }
    }
  }

  /** 세션을 전환하는 중...  
   * 단일 세션 전환일 때에도 막힘
   */
  TogglingSession = false;
  /** 리워드 광고 발동 여부  
   * 리워드 광고를 통해 리워드를 받았다면 광고를 틀지 않습니다.  
   * 리워드 광고로 리워드를 받았다면 개발 테스트 서버에 연결시킵니다.
   */
  isRewardAdsUsed = false;
  /** 모든 세션을 토글 */
  async toggle_all_session(lampAct = false) {
    if (this.TogglingSession) return;
    this.TogglingSession = true;
    if (this.statusBar.settings.groupServer == 'online') {
      this.logout_all_server();
      this.p5toast.show({
        text: this.lang.text['Nakama']['SessionLogout'],
      });
    } else {
      this.p5toast.show({
        text: this.lang.text['Nakama']['PendingLogin'],
      });
      try {
        let count_server = await this.init_all_sessions();
        if (!count_server) {
          this.p5toast.show({
            text: this.lang.text['Subscribes']['Disconnected'],
          });
          if (lampAct) this.nav.navigateForward('portal/settings/group-server');
        }
      } catch (e) { }
    }
    this.TogglingSession = false;
  }

  /** 광고 시청 후 개발자 테스트 서버에 참여하기 */
  async WatchAdsAndGetDevServerInfo(force = false) {
    let RegisteredServer = this.get_all_server_info(true);
    if ((!this.isRewardAdsUsed && !RegisteredServer.length) || force) {
      const options: RewardAdOptions = {
        adId: 'ca-app-pub-6577630868247944/4325703911',
      };
      /** 광고 정보 불러오기 */
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      try { // 파일이 있으면 보여주고, 없다면 보여주지 않음
        let res = await fetch(`${SERVER_PATH_ROOT}pjcone_ads/admob.txt`);
        if (!res.ok) throw "준비된 광고가 없습니다";
        await AdMob.prepareRewardVideoAd(options);
        loading.dismiss();
        await AdMob.showRewardVideoAd();
        if (isPlatform == 'Android') {
          this.bgmode.disable();
          AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
            this.bgmode.enable();
          });
          AdMob.addListener(RewardAdPluginEvents.Rewarded, async (reward: AdMobRewardItem) => {
            if (reward.amount != 0)
              await this.AccessToOfficialTestServer();
          });
        } else { // 브라우저식 웹 광고 구성 필요
          console.log('브라우저식 보상형 광고 준비중');
          await this.AccessToOfficialTestServer();
        }
      } catch (e) { // 파일이 없는 경우 동작
        console.log(e);
        await this.AccessToOfficialTestServer();
        loading.dismiss();
      }
      return true;
    }
    return false;
  }

  /** 공식 테스트 서버 접근 권한 생성 */
  async AccessToOfficialTestServer() {
    let res = await fetch(`${SERVER_PATH_ROOT}assets/data/WSAddress.txt`);
    let address = (await res.text()).split('\n')[0];
    await this.add_group_server({
      isOfficial: 'official',
      address: address,
      name: this.lang.text['Nakama']['DevTestServer'],
      target: 'DevTestServer',
      useSSL: true,
    });
    this.isRewardAdsUsed = true;
    // official 로그인 처리
    let Targets = Object.keys(this.servers['official']);
    for (let i = 0, j = Targets.length; i < j; i++)
      await this.init_session(this.servers['official'][Targets[i]].info);
    if (this.statusBar.settings.groupServer == 'online')
      this.p5toast.show({
        text: this.lang.text['Nakama']['AccessTestServer'],
      });
  }

  /** 서버 연결하기 */
  async link_group(_is_official: string, _target: string, online =
    this.statusBar.groupServer[_is_official][_target] == 'offline') {
    if (online) {
      this.statusBar.groupServer[_is_official][_target] = 'pending';
      this.catch_group_server_header('pending');
      if (this.users.self['online'])
        await this.init_session(this.servers[_is_official][_target].info);
    } else {
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
          if (this.groups[_is_official][_target][_gid]['status'] != 'missing')
            this.groups[_is_official][_target][_gid]['status'] = 'offline';
        });
      }
      this.set_group_statusBar('offline', _is_official, _target);
      this.statusBar.groupServer[_is_official][_target] = 'offline';
      this.catch_group_server_header('offline');
      if (this.servers[_is_official][_target].session) {
        try {
          await this.servers[_is_official][_target].client.sessionLogout(
            this.servers[_is_official][_target].session,
            this.servers[_is_official][_target].session.token,
            this.servers[_is_official][_target].session.refresh_token);
        } catch (e) { }
        if (this.noti_origin[_is_official] && this.noti_origin[_is_official][_target])
          delete this.noti_origin[_is_official][_target];
        this.rearrange_notifications();
      }
      if (this.channels_orig[_is_official] && this.channels_orig[_is_official][_target]) {
        let channel_ids = Object.keys(this.channels_orig[_is_official][_target]);
        channel_ids.forEach(_cid => {
          if (this.channels_orig[_is_official][_target][_cid]['status'] != 'missing')
            delete this.channels_orig[_is_official][_target][_cid]['status'];
        });
      }
    }
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
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
          if (this.statusBar.groupServer['official'][_target] == 'online' || this.statusBar.groupServer['official'][_target] == 'pending')
            result.push(this.servers['official'][_target].info);
        } else if (this.servers['official'][_target])
          result.push(this.servers['official'][_target].info);
      });
    let unTargets = Object.keys(this.servers['unofficial']);
    unTargets.forEach(_target => {
      if (online_only) {
        if (this.statusBar.groupServer['unofficial'][_target] == 'online' || this.statusBar.groupServer['unofficial'][_target] == 'pending')
          result.push(this.servers['unofficial'][_target].info);
      } else if (this.servers['unofficial'][_target])
        result.push(this.servers['unofficial'][_target].info);
    });
    return result;
  }

  /** 그룹 서버 추가하기 */
  add_group_server(info: ServerInfo, _CallBack = () => { }): Promise<void> {
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

    if (!this.groups[info.isOfficial])
      this.groups[info.isOfficial] = {};
    if (!this.groups[info.isOfficial][info.target])
      this.groups[info.isOfficial][info.target] = {};
    if (!this.channels_orig[info.isOfficial])
      this.channels_orig[info.isOfficial] = {};
    if (!this.channels_orig[info.isOfficial][info.target])
      this.channels_orig[info.isOfficial][info.target] = {};

    let line = new Date().getTime().toString();
    line += `,${info.isOfficial}`;
    line += `,${info.name}`;
    line += `,${info.target}`;
    line += `,${info.address}`;
    line += `,${info.port}`;
    line += `,${info.useSSL}`;
    return new Promise(async (done) => {
      // WebRTC 정보 자동 생성처리 (기본 정보 기반)
      {
        let auto_gen_server = {
          urls: [`stun:${info.address}:3478`, `turn:${info.address}:3478`],
          username: 'username',
          credential: 'password',
        }
        await this.SaveWebRTCServer(auto_gen_server);
      }
      if (info.isOfficial != 'official')
        this.indexed.loadTextFromUserPath('servers/list_detail.csv', async (e, v) => {
          let list: string[] = [];
          if (e && v) list = v.split('\n');
          list.push(line);
          this.indexed.saveTextFileToUserPath(list.join('\n'), 'servers/list_detail.csv', (_v) => {
            this.init_server(info);
            this.servers[info.isOfficial][info.target].info = { ...info };
            _CallBack();
          });
          this.statusBar.groupServer[info.isOfficial][info.target] = 'offline';
          await this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
          done();
        });
      else {
        this.init_server(info);
        this.servers[info.isOfficial][info.target].info = { ...info };
        this.statusBar.groupServer[info.isOfficial][info.target] = 'offline';
        done();
      }
    });
  }

  /** WebRTC 정보 저장하기 */
  async SaveWebRTCServer(info: any) {
    let list = await this.indexed.loadTextFromUserPath('servers/webrtc_server.json') || '[]';
    let savedWebRTCData = JSON.parse(list);
    let isExist = false;
    let keys = Object.keys(savedWebRTCData);
    for (let i = 0, j = keys.length; i < j; i++) {
      let add = this.catch_address_from_rtc_server_address(info);
      let exist = this.catch_address_from_rtc_server_address(savedWebRTCData[i]);
      if (add == exist) {
        isExist = true;
        break;
      }
    }
    if (!isExist) savedWebRTCData.push(info);
    await this.indexed.saveTextFileToUserPath(JSON.stringify(savedWebRTCData), 'servers/webrtc_server.json');
  }

  /** 서버를 삭제할 때 해당 주소의 WebRTC 서버를 삭제하기 */
  async RemoveWebRTCServer(address: string) {
    let list = await this.indexed.loadTextFromUserPath('servers/webrtc_server.json') || '[]';
    let savedWebRTCData = JSON.parse(list);
    let keys = Object.keys(savedWebRTCData);
    for (let i = 0, j = keys.length; i < j; i++) {
      let exist = this.catch_address_from_rtc_server_address(savedWebRTCData[i]);
      if (address == exist) savedWebRTCData.splice(i, 1); // 모든 동일 명 서버 삭제
    }
    await this.indexed.saveTextFileToUserPath(JSON.stringify(savedWebRTCData), 'servers/webrtc_server.json');
  }

  /** WebRTC 서버 주소로부터 일반 주소 추출하기 */
  catch_address_from_rtc_server_address(info: any) {
    let result = undefined;
    try { // 가운데 있는 주소부분만 추출
      let addressForm: string = info['urls'][0];
      if (addressForm.indexOf('stun:') >= 0 || addressForm.indexOf('turn:') >= 0)
        addressForm = addressForm.substring(5);
      let SepPort = addressForm.lastIndexOf(':');
      result = addressForm.substring(0, SepPort);
    } catch (e) {
      console.error('webrtc 서버 정보 검토 오류: ', e);
    }
    return result;
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
    this.TogglingSession = true;
    try {
      this.servers[info.isOfficial][info.target].session
        = await this.servers[info.isOfficial][info.target].client.authenticateEmail(this.users.self['email'], this.users.self['password'], false);
      await this.after_login(info.isOfficial, info.target, info.useSSL);
    } catch (e) {
      switch (e.status) {
        case 400: // 이메일/비번이 없거나 하는 등, 요청 정보가 잘못됨
          this.p5toast.show({
            text: this.lang.text['Nakama']['NeedLoginInfo'],
          });
          this.nav.navigateForward('portal/settings/group-server');
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
              lang_tag: navigator.language.split('-')[0] || this.lang.lang,
            });
          this.p5toast.show({
            text: `${this.lang.text['Nakama']['RegisterUserSucc']}: ${info.name}`,
            lateable: true,
          });
          if (this.users.self['img']) {
            try {
              let image = await this.servers[info.isOfficial][info.target].client.writeStorageObjects(
                this.servers[info.isOfficial][info.target].session, [{
                  collection: 'user_public',
                  key: 'profile_image',
                  permission_read: 2,
                  permission_write: 1,
                  value: { img: this.users.self['img'] },
                }]
              );
              this.servers[info.isOfficial][info.target].client.updateAccount(
                this.servers[info.isOfficial][info.target].session, {
                avatar_url: image.acks[0].version,
              });
            } catch (e) {
              console.error('이미지 버전 업데이트 오류: ', e);
            }
          }
          let is_exist = await this.indexed.checkIfFileExist('servers/self/content.pck');
          if (is_exist) this.sync_save_file({ path: 'servers/self/content.pck' }, info.isOfficial, info.target, 'user_public', 'main_content');
          await this.after_login(info.isOfficial, info.target, info.useSSL);
          break;
        default:
          this.p5toast.show({
            text: `(${info.name}) ${this.lang.text['Nakama']['UnexpectedLoginErr']}: ${e}`,
          });
          this.set_group_statusBar('offline', info.isOfficial, info.target);
          break;
      }
    }
    this.TogglingSession = false;
  }

  AfterLoginActDone = false;
  /** 첫 로그인 시도 이후 행동 (빠른 진입 1회 행동) */
  AfterLoginAct: Function[] = [];
  /** 자기 자신과의 매칭 정보  
   * self_match[isOfficial][target] = Match
   */
  self_match = {};
  /** 로그인 및 회원가입 직후 행동들 */
  async after_login(_is_official: any, _target: string, _useSSL: boolean) {
    // 그룹 서버 연결 상태 업데이트
    this.set_group_statusBar('pending', _is_official, _target);
    // 통신 소켓 생성
    this.servers[_is_official][_target].socket = this.servers[_is_official][_target].client.createSocket(_useSSL);
    // 커뮤니티 서버를 쓰는 관리자모드 검토
    try {
      let account = await this.servers[_is_official][_target].client.getAccount(
        this.servers[_is_official][_target].session);
      let metadata = JSON.parse(account.user.metadata);
      this.servers[_is_official][_target].info.is_admin = metadata['is_admin'];
      // 개인 정보를 서버에 맞춤
      let keys = Object.keys(account.user);
      keys.forEach(key => {
        if (key == 'display_name')
          this.users.self[key] = account.user[key];
        else if (!this.users.self['display_name'])
          this.users.self[key] = account.user[key];
      });
      this.save_self_profile();
    } catch (e) { }
    // 개인 프로필 이미지를 서버에 맞춤
    try {
      let image = await this.servers[_is_official][_target].client.readStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: 'user_public',
          key: 'profile_image',
          user_id: this.servers[_is_official][_target].session.user_id,
        }],
      });
      if (image.objects.length) {
        if (this.socket_reactive['profile']) {
          this.socket_reactive['profile'](image.objects[0].value['img']);
        } else {
          this.users.self['img'] = image.objects[0].value['img'];
          this.indexed.saveTextFileToUserPath(JSON.stringify(this.users.self['img']), 'servers/self/profile.img');
        }
      }
    } catch (e) { }
    await this.SyncTodoCounter(_is_official, _target);
    await this.load_server_todo(_is_official, _target);
    await this.RemoteTodoSelfCheck(_is_official, _target);
    // 통신 소켓 연결하기
    let socket = await this.connect_to(_is_official, _target);
    this.set_group_statusBar('online', _is_official, _target);
    await this.get_group_list_from_server(_is_official, _target);
    await this.redirect_channel(_is_official, _target);
    if (!this.noti_origin[_is_official]) this.noti_origin[_is_official] = {};
    if (!this.noti_origin[_is_official][_target]) this.noti_origin[_is_official][_target] = {};
    await this.update_notifications(_is_official, _target);
    try { // 셀프 매치 생성하기
      let prv_match = await this.servers[_is_official][_target].client.readStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: 'self_share',
          key: 'private_match',
          user_id: this.servers[_is_official][_target].session.user_id,
        }]
      });
      try {
        if (!this.self_match[_is_official]) this.self_match[_is_official] = {};
        if (!this.self_match[_is_official][_target]) this.self_match[_is_official][_target] = undefined;
        this.self_match[_is_official][_target] = await socket.joinMatch(prv_match.objects[0].value['match_id']);
        return; // 매치 진입 성공인 경우
      } catch (e) {
        let self_match = await socket.createMatch();
        this.self_match[_is_official][_target] = self_match;
        this.servers[_is_official][_target].client.writeStorageObjects(
          this.servers[_is_official][_target].session, [{
            collection: 'self_share',
            key: 'private_match',
            permission_read: 2,
            permission_write: 1,
            value: { match_id: self_match.match_id },
          }],
        );
      }
    } catch (e) { }
    this.rearrange_channels();
    this.rearrange_group_list();
    for (let i = 0, j = this.AfterLoginAct.length; i < j; i++)
      try {
        await this.AfterLoginAct[i]();
      } catch (e) {
        console.error('진입 동작 오류: ', e);
      }
    this.AfterLoginAct.length = 0;
    this.AfterLoginActDone = true;
  }

  /** 원격 할 일 카운터  
   * RemoteTodoCounter[isOfficial][target] = number[];
   */
  RemoteTodoCounter = {};
  /** 서버에 저장시킨 해야할 일 목록 불러오기 */
  async load_server_todo(_is_official: string, _target: string) {
    try {
      let count = this.RemoteTodoCounter[_is_official][_target];
      if (!this.RemoteTodoCounter[_is_official])
        this.RemoteTodoCounter[_is_official] = {};
      for (let i = count.length - 1; i >= 0; i--) {
        try {
          let key = `RemoteTodo_${count[i]}`;
          let todo = await this.servers[_is_official][_target].client.readStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: 'server_todo',
              key: key,
              user_id: this.servers[_is_official][_target].session.user_id,
            }]
          });
          if (todo.objects.length)
            this.modify_remote_info_as_local(todo.objects[0].value, _is_official, _target);
          else try { // 로컬에 있는 같은 id의 할 일 삭제
            this.RemoteTodoCounter[_is_official][_target].splice(i, 1);
            let data = await this.indexed.loadTextFromUserPath(`todo/${key}/info.todo`)
            let json = JSON.parse(data);
            this.deleteTodoFromStorage(true, json);
          } catch (e) { }
        } catch (e) {
          console.log('서버 해야할 일 불러오기 오류: ', e);
        }
      }
    } catch (e) { }
  }

  /** 로컬에 있는 해야할 일들은 스스로가 원격에 남아있는지 검토하고, 없으면 스스로를 삭제한다 */
  async RemoteTodoSelfCheck(_is_official: string, _target: string) {
    let list = await this.indexed.GetFileListFromDB('todo/RemoteTodo_');
    for (let i = 0, j = list.length; i < j; i++) {
      if (list[i].indexOf('info.todo') >= 0) {
        let todo = await this.indexed.loadTextFromUserPath(list[i]);
        let json = JSON.parse(todo);
        // 이 서버에 대한 검토만을 진행할 예정
        if (json.remote.isOfficial == _is_official && json.remote.target == _target) {
          let check = await this.servers[_is_official][_target].client.readStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: 'server_todo',
              key: json.id,
              user_id: this.servers[_is_official][_target].session.user_id,
            }]
          });
          if (!check.objects.length) { // 원격에서 삭제된 할 일임
            let list = await this.indexed.GetFileListFromDB(`todo/${json.id}`);
            list.forEach(path => this.indexed.removeFileFromUserPath(path));
            if (json.noti_id)
              if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
                clearTimeout(this.web_noti_id[json.noti_id]);
                delete this.web_noti_id[json.noti_id];
              }
            this.noti.ClearNoti(json.id);
            if (this.global.p5todo && this.global.p5todo['remove_todo'])
              this.global.p5todo['remove_todo'](todo);
          }
        }
      }
    }
  }

  /** 원격 할 일 카운터 불러오기 */
  async getRemoteTodoCounter(_is_official: string, _target: string): Promise<number> {
    try {
      this.RemoteTodoCounter[_is_official][_target].sort((a, b) => {
        return a - b;
      });
      let len = this.RemoteTodoCounter[_is_official][_target].length;
      if (!len) throw '정해진 값이 없어?';
      let value = this.RemoteTodoCounter[_is_official][_target][len - 1] + 1;
      this.RemoteTodoCounter[_is_official][_target].push(value);
      return value;
    } catch (e) {
      let v = await this.SyncTodoCounter(_is_official, _target);
      let result = 0;
      if (v && v.objects.length && v.objects[0].value['data'].length) {
        result = v.objects[0].value['data'].pop() + 1;
      } else {
        if (!this.RemoteTodoCounter[_is_official])
          this.RemoteTodoCounter[_is_official] = {};
        this.RemoteTodoCounter[_is_official][_target] = [0];
      }
      return result;
    }
  }

  /** 서버로부터 카운터를 받아 동기화하기 */
  async SyncTodoCounter(_is_official: string, _target: string) {
    try {
      let data = await this.servers[_is_official][_target].client.readStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: 'server_todo',
          key: 'RemoteTodo_Counter',
          user_id: this.servers[_is_official][_target].session.user_id,
        }]
      });
      if (!this.RemoteTodoCounter[_is_official])
        this.RemoteTodoCounter[_is_official] = {};
      this.RemoteTodoCounter[_is_official][_target] = data.objects[0].value['data'];
      return data;
    } catch (e) { }
  }

  /** 원격 할 일 중 완료/삭제된 내용 업데이트 */
  async removeRemoteTodoCounter(_is_official: string, _target: string, index: number) {
    try {
      let find_index = this.RemoteTodoCounter[_is_official][_target].indexOf(index);
      if (find_index >= 0)
        this.RemoteTodoCounter[_is_official][_target].splice(find_index, 1);
    } catch (e) {
      if (!this.RemoteTodoCounter[_is_official])
        this.RemoteTodoCounter[_is_official] = {};
      if (!this.RemoteTodoCounter[_is_official][_target])
        this.RemoteTodoCounter[_is_official][_target] = [];
    }
    await this.updateRemoteCounter(_is_official, _target);
  }

  /** 원격 할 일 카운터 숫자 조정 */
  async updateRemoteCounter(_is_official: string, _target: string) {
    if (this.RemoteTodoCounter[_is_official][_target].length) {
      for (let i = this.RemoteTodoCounter[_is_official][_target].length - 1; i >= 0; i--)
        if (this.RemoteTodoCounter[_is_official][_target][i] === undefined || this.RemoteTodoCounter[_is_official][_target][i] == null) {
          this.RemoteTodoCounter[_is_official][_target].splice(i, 1);
        }
      this.RemoteTodoCounter[_is_official][_target].sort((a, b) => {
        return a - b;
      });
      for (let i = this.RemoteTodoCounter[_is_official][_target].length - 2; i >= 0; i--)
        if (this.RemoteTodoCounter[_is_official][_target][i + 1] == this.RemoteTodoCounter[_is_official][_target][i])
          this.RemoteTodoCounter[_is_official][_target].splice(i, 1);
    }
    await this.servers[_is_official][_target].client.writeStorageObjects(
      this.servers[_is_official][_target].session, [{
        collection: 'server_todo',
        key: 'RemoteTodo_Counter',
        permission_read: 2,
        permission_write: 1,
        value: { data: this.RemoteTodoCounter[_is_official][_target] },
      }]);
  }

  /** 원격 정보를 로컬에 맞게 수정, 그 후 로컬에 다시 저장하기 */
  modify_remote_info_as_local(todo_info: any, _is_official: string, _target: string) {
    todo_info['remote']['name'] = this.servers[_is_official][_target].info.name;
    todo_info['remote']['isOfficial'] = _is_official;
    todo_info['remote']['target'] = _target;
    todo_info['remote']['type'] = `${_is_official}/${_target}`;
    this.set_todo_notification(todo_info);
    if (this.global.p5todo && this.global.p5todo['add_todo']) this.global.p5todo['add_todo'](JSON.stringify(todo_info));
    this.indexed.saveTextFileToUserPath(JSON.stringify(todo_info), `todo/${todo_info['id']}/info.todo`);
  }

  /** 이 일을 완료했습니다 */
  async doneTodo(targetInfo: any) {
    targetInfo.done = true;
    if (this.global.p5todo && this.global.p5todo['add_todo'])
      this.global.p5todo['add_todo'](JSON.stringify(targetInfo));
    if (targetInfo.remote) {
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      if (this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target])
        await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target]
          .socket.sendMatchState(this.self_match[targetInfo.remote.isOfficial][targetInfo.remote.target].match_id, MatchOpCode.MANAGE_TODO,
            encodeURIComponent(`done,${targetInfo.id}`));
      loading.dismiss();
    }
    await this.deleteTodoFromStorage(false, targetInfo);
    this.navCtrl.pop();
  }

  /** 저장소로부터 데이터를 삭제하는 명령 모음  
   * @param isDelete 삭제 여부를 검토하여 애니메이션 토글
   */
  async deleteTodoFromStorage(isDelete: boolean, targetInfo: any) {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    if (targetInfo.remote) {
      try { // 원격 할 일인 경우 원격 저장소에서 삭제
        if (!this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target])
          throw 'Server deleted.';
        try {
          let isOfficial = targetInfo.remote.isOfficial;
          let target = targetInfo.remote.target;
          await this.servers[isOfficial][target].client.deleteStorageObjects(
            this.servers[isOfficial][target].session, {
            object_ids: [{
              collection: 'server_todo',
              key: targetInfo.id,
            }],
          });
          for (let i = 0, j = targetInfo.attach.length; i < j; i++)
            await this.sync_remove_file(targetInfo.attach[i].path, isOfficial, target, 'todo_attach');
          if (isDelete) {
            await this.servers[isOfficial][target]
              .socket.sendMatchState(this.self_match[isOfficial][target].match_id, MatchOpCode.MANAGE_TODO,
                encodeURIComponent(`delete,${targetInfo.id}`));
          }
        } catch (e) {
          console.error('해야할 일 삭제 요청이 서버에 전송되지 않음: ', e);
        }
        try { // 지시받은 업무인 경우, 완료됨 전송
          if (targetInfo.remote.creator_id != this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].session.user_id) {
            let act_time = new Date().getTime();
            try { // 서버 rpc로 변경행동 보내기
              await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].client.rpc(
                this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].session,
                'manage_todo_done_fn', {
                id: targetInfo.id,
                creator_id: targetInfo.remote.creator_id,
                user_id: this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].session.user_id,
                timestamp: act_time,
                isDelete: isDelete,
              });
            } catch (e) { }
            try { // 변경되었음을 매니저에게 알림
              let match = await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].client.readStorageObjects(
                this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].session, {
                object_ids: [{
                  collection: 'self_share',
                  key: 'private_match',
                  user_id: targetInfo.remote.creator_id,
                }],
              });
              if (match.objects.length) { // 가용 매치일 경우에 메시지 발송하기
                await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target]
                  .socket.joinMatch(match.objects[0].value['match_id']);
                await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target]
                  .socket.sendMatchState(match.objects[0].value['match_id'], MatchOpCode.MANAGE_TODO,
                    encodeURIComponent(`worker,${targetInfo.id},${this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].session.user_id},${isDelete},${act_time}`));
                await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target]
                  .socket.leaveMatch(match.objects[0].value['match_id']);
              }
            } catch (e) { }
          }
        } catch (e) { }
        if (targetInfo.workers) { // 매니저 기준 행동
          try { // 모든 등록된 작업자의 기록을 삭제 처리
            await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].client.rpc(
              this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].session,
              'manage_todo_delete_fn', {
              id: targetInfo.id,
              workers: targetInfo.workers,
            });
          } catch (e) { }
          for (let i = 0, j = targetInfo.workers.length; i < j; i++) {
            try {
              let match = await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].client.readStorageObjects(
                this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target].session, {
                object_ids: [{
                  collection: 'self_share',
                  key: 'private_match',
                  user_id: targetInfo.workers[i].id,
                }],
              });
              if (match.objects.length) { // 가용 매치일 경우에 메시지 발송하기
                await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target]
                  .socket.joinMatch(match.objects[0].value['match_id']);
                await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target]
                  .socket.sendMatchState(match.objects[0].value['match_id'], MatchOpCode.MANAGE_TODO,
                    encodeURIComponent(isDelete ? `delete,${targetInfo.id}` : `done,${targetInfo.id}`));
                await this.servers[targetInfo.remote.isOfficial][targetInfo.remote.target]
                  .socket.leaveMatch(match.objects[0].value['match_id']);
              }
            } catch (e) { }
          }
        }
        await this.removeRemoteTodoCounter(targetInfo.remote.isOfficial, targetInfo.remote.target, Number(targetInfo['id'].split('_').pop()));
      } catch (e) {
        console.log('서버 정보 없음, 로컬에서 행동: ', e);
      }
    }
    // 로컬에 저장된 파일 전부 삭제
    let list = await this.indexed.GetFileListFromDB(`todo/${targetInfo.id}`);
    list.forEach(_path => this.indexed.removeFileFromUserPath(_path));
    // 해당 할 일의 알림 삭제
    if (targetInfo.noti_id)
      if (!(isPlatform == 'Android' || isPlatform == 'iOS')) {
        clearTimeout(this.web_noti_id[targetInfo.noti_id]);
        delete this.web_noti_id[targetInfo.noti_id];
      }
    this.removeRegisteredId(targetInfo.noti_id);
    this.noti.ClearNoti(targetInfo.noti_id);
    if (isDelete && this.global.p5todo)
      this.global.p5todo['remove_todo'](JSON.stringify(targetInfo));
    loading.dismiss();
  }

  /** 저장된 그룹 업데이트하여 반영 */
  async load_groups(_is_official: string, _target: string, _gid: string) {
    // 온라인이라면 서버정보로 덮어쓰기
    let channel_id = this.groups[_is_official][_target][_gid]['channel_id'];
    try {
      if (this.groups[_is_official][_target][_gid]['status'] != 'missing') {
        let gulist = await this.servers[_is_official][_target].client.listGroupUsers(
          this.servers[_is_official][_target].session, _gid
        );
        if (!gulist.group_users.length) { // 그룹 비활성중
          this.groups[_is_official][_target][_gid]['status'] = 'missing';
          this.channels_orig[_is_official][_target][channel_id]['status'] = 'missing';
          this.save_channels_with_less_info();
        } else { // 그룹 활성중
          let am_i_lost = true;
          // 내가 이 그룹에 아직 남아있는지 검토
          for (let i = 0, j = gulist.group_users.length; i < j; i++)
            if (gulist.group_users[i].user.id == this.servers[_is_official][_target].session.user_id) {
              switch (gulist.group_users[i].state) {
                case 0: // superadmin
                case 1: // admin
                case 2: // member
                  this.groups[_is_official][_target][_gid]['status'] = 'online';
                  break;
                case 3: // request
                  this.groups[_is_official][_target][_gid]['status'] = 'pending';
                  break;
                default:
                  console.log('이해할 수 없는 코드 반환: ', gulist.group_users[i].state);
                  this.groups[_is_official][_target][_gid]['status'] = 'missing';
                  break;
              }
              am_i_lost = false;
              gulist.group_users[i]['is_me'] = true;
              break;
            }
          if (am_i_lost) { // 그룹은 있으나 구성원은 아님
            this.groups[_is_official][_target][_gid]['status'] = 'missing';
            if (channel_id) // 그룹 수락이 안되어있는 경우
              this.channels_orig[_is_official][_target][channel_id]['status'] = 'missing';
            this.save_channels_with_less_info();
          }
        }
        if (gulist.group_users.length)
          this.groups[_is_official][_target][_gid]['users'] = gulist.group_users;
        for (let i = 0, j = gulist.group_users.length; i < j; i++)
          if (gulist.group_users[i]['is_me'])
            gulist.group_users[i]['user'] = this.users.self;
          else try {
            let image = await this.servers[_is_official][_target].client.readStorageObjects(
              this.servers[_is_official][_target].session, {
              object_ids: [{
                collection: 'user_public',
                key: 'profile_image',
                user_id: gulist.group_users[i]['user']['id'],
              }],
            });
            if (image.objects.length)
              gulist.group_users[i]['user']['img'] = image.objects[0].value['img'];
            else delete gulist.group_users[i]['user']['img'];
            this.save_other_user(gulist.group_users[i]['user'], _is_official, _target);
          } catch (e) {
            console.error('다른 사용자 이미지 업데이트 오류: ', e);
            this.save_other_user(gulist.group_users[i]['user'], _is_official, _target);
          }
        this.save_groups_with_less_info();
      }
    } catch (e) {
      console.log('load_groups_error: ', e);
    }
  }

  /** 서버별 사용자 정보 가져오기
   * users[isOfficial][target][uid] = UserInfo;
   */
  users = {
    self: {},
    deleted: {},
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
  load_other_user(userId: string, _is_official: string, _target: string, _CallBack = (_userInfo: any) => { }) {
    try {
      if (this.servers[_is_official][_target].session.user_id == userId)
        return this.users.self; // 만약 그게 나라면 내 정보 반환
    } catch (e) { }
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
          try {
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
                  if (!this.users[_is_official][_target][userId]['img'])
                    this.users[_is_official][_target][userId]['img'] = null;
                  this.save_other_user(this.users[_is_official][_target][userId], _is_official, _target);
                } else { // 없는 사용자 기록 삭제
                  this.indexed.removeFileFromUserPath(`${_is_official}/${_target}/users/${userId}`);
                  this.indexed.removeFileFromUserPath(`${_is_official}/${_target}/users/${userId}/profile.json`);
                  this.indexed.removeFileFromUserPath(`${_is_official}/${_target}/users/${userId}/profile.img`);
                }
              });
          } catch (e) { }
        }
      });
      if (!this.users[_is_official][_target][userId]['img']) {
        this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/users/${userId}/profile.img`, (e, v) => {
          if (e && v) {
            this.users[_is_official][_target][userId]['img'] = v.replace(/"|=|\\/g, '');
          } else if (this.users[_is_official][_target][userId]['avatar_url'])
            try {
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
            } catch (e) { }
        });
      } else this.save_other_user(this.users[_is_official][_target][userId], _is_official, _target);
    }
    return this.users[_is_official][_target][userId];
  }

  /** 다른 사람의 정보 간소화하여 저장하기 */
  save_other_user(userInfo: any, _is_official: string, _target: string) {
    if (this.servers[_is_official][_target].session.user_id == userInfo['id'])
      return; // 내 정보는 저장하지 않음
    let copied = JSON.parse(JSON.stringify(userInfo));
    if (userInfo['id'] == this.servers[_is_official][_target].session.user_id) return;
    delete copied['img'];
    delete copied['online'];
    // 할 일 업무 분배 보조 자료
    delete copied['todo_checked'];
    delete copied['todo_done'];
    if (!this.users[_is_official][_target]) this.users[_is_official][_target] = {};
    if (!this.users[_is_official][_target][userInfo['id']]) this.users[_is_official][_target][userInfo['id']] = {};
    let keys = Object.keys(userInfo);
    keys.forEach(key => this.users[_is_official][_target][userInfo['id']][key] = userInfo[key]);
    this.indexed.saveTextFileToUserPath(JSON.stringify(copied), `servers/${_is_official}/${_target}/users/${copied['id']}/profile.json`);
    if (userInfo['img'])
      this.indexed.saveTextFileToUserPath(userInfo['img'], `servers/${_is_official}/${_target}/users/${userInfo['id']}/profile.img`);
    else if (userInfo['img'] === undefined)
      this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/users/${userInfo['id']}/profile.img`);
  }

  /** 서버로부터 알림 업데이트하기 (알림 리스트 재정렬 포함됨) */
  async update_notifications(_is_official: string, _target: string) {
    let noti = await this.servers[_is_official][_target].client.listNotifications(this.servers[_is_official][_target].session, 1);
    this.noti_origin[_is_official][_target] = {};
    for (let i = 0, j = noti.notifications.length; i < j; i++)
      this.act_on_notification(noti.notifications[i], _is_official, _target);
    this.rearrange_notifications();
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
    if (!this.channels_orig[_is_official][_target][channel_info.id]) {
      this.channels_orig[_is_official][_target][channel_info.id] = {};
      let keys = Object.keys(channel_info);
      keys.forEach(key => this.channels_orig[_is_official][_target][channel_info.id][key] = channel_info[key]);
      if (!this.channels_orig[_is_official][_target][channel_info.id]['cnoti_id'])
        this.channels_orig[_is_official][_target][channel_info.id]['cnoti_id'] = this.get_noti_id();
      switch (this.channels_orig[_is_official][_target][channel_info.id]['redirect']['type']) {
        case 2: // 1:1 대화
          let targetId = this.channels_orig[_is_official][_target][channel_info.id]['redirect']['id'];
          this.channels_orig[_is_official][_target][channel_info.id]['color'] = (targetId.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
          let result_status = this.load_other_user(targetId, _is_official, _target)['online'] ? 'online' : 'pending';
          this.channels_orig[_is_official][_target][channel_info.id]['status'] = result_status;
          break;
        case 3: // 새로 개설된 그룹 채널인 경우
          try {
            let group_id = this.channels_orig[_is_official][_target][channel_info.id]['redirect']['id'];
            this.channels_orig[_is_official][_target][channel_info.id]['color'] = (group_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
            let users = await this.servers[_is_official][_target].client.listGroupUsers(
              this.servers[_is_official][_target].session, group_id);
            if (!this.groups[_is_official][_target][group_id]['users'])
              this.groups[_is_official][_target][group_id]['users'] = [];
            users.group_users.forEach(_user => {
              if (_user.user.id != this.servers[_is_official][_target].session.user_id)
                if (!this.users[_is_official][_target][_user.user['id']])
                  this.save_other_user(_user.user, _is_official, _target);
              if (_user.user.id == this.servers[_is_official][_target].session.user_id)
                _user.user['is_me'] = true;
              else if (!this.users[_is_official][_target][_user.user['id']]) this.save_other_user(_user.user, _is_official, _target);
              _user.user = this.load_other_user(_user.user.id, _is_official, _target);
              this.add_group_user_without_duplicate(_user, group_id, _is_official, _target);
            });
          } catch (e) {
            console.error('그룹 채널 생성 오류: ', e);
          }
          this.count_channel_online_member(this.channels_orig[_is_official][_target][channel_info.id], _is_official, _target);
          break;
        default:
          console.error('예상하지 못한 채널 종류: ', this.channels_orig[_is_official][_target][channel_info.id]);
          break;
      }
      this.rearrange_channels();
      this.servers[_is_official][_target].socket.sendMatchState(this.self_match[_is_official][_target].match_id, MatchOpCode.ADD_CHANNEL,
        encodeURIComponent(''));
    }
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
  async load_channel_list() {
    let channels = await this.indexed.loadTextFromUserPath('servers/channels.json');
    if (channels) {
      this.channels_orig = JSON.parse(channels);
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
            if (this.channels_orig[_is_official][_target][_cid]['redirect']['type'] == 0)
              this.channels_orig[_is_official][_target][_cid]['status'] = 'online';
            if (this.channels_orig[_is_official][_target][_cid]['is_new'] && !this.subscribe_lock)
              this.has_new_channel_msg = true;
          });
        });
      });
    }
    this.rearrange_channels();
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
    this.registered_id.push(this.noti_id);
    return this.noti_id;
  }
  check_If_RegisteredId(expectation_number: number): number {
    let already_registered = false;
    for (let i = 0, j = this.registered_id.length; i < j; i++)
      if (this.registered_id[i] == expectation_number) {
        already_registered = true;
        break;
      } // ^ 검토할 숫자를 줄이기 위해 기존 정보를 삭제함
    if (already_registered)
      return this.check_If_RegisteredId(expectation_number + 1);
    else return expectation_number;
  }
  /** 기등록된 아이디 수집 */
  registered_id: number[] = [];
  removeRegisteredId(id: number) {
    for (let i = 0, j = this.registered_id.length; i < j; i++)
      if (this.registered_id[i] == id) {
        this.registered_id.splice(i, 1);
        break;
      }
  }
  /** 세션 재접속 시 기존 정보를 이용하여 채팅방에 다시 로그인함  
   * 개인 채팅에 대해서만 검토
   */
  async redirect_channel(_is_official: string, _target: string) {
    if (this.channels_orig[_is_official][_target]) {
      let channel_ids = Object.keys(this.channels_orig[_is_official][_target]);
      for (let i = 0, j = channel_ids.length; i < j; i++)
        if (this.channels_orig[_is_official][_target][channel_ids[i]]['status'] != 'missing') {
          try {
            await this.servers[_is_official][_target].socket.joinChat(
              this.channels_orig[_is_official][_target][channel_ids[i]]['redirect']['id'],
              this.channels_orig[_is_official][_target][channel_ids[i]]['redirect']['type'],
              this.channels_orig[_is_official][_target][channel_ids[i]]['redirect']['persistence'],
              false
            );
            if (!this.channels_orig[_is_official][_target][channel_ids[i]]['cnoti_id'])
              this.channels_orig[_is_official][_target][channel_ids[i]]['cnoti_id'] = this.get_noti_id();
            this.channels_orig[_is_official][_target][channel_ids[i]]['color'] = (this.channels_orig[_is_official][_target][channel_ids[i]]['info']['id'].replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
            switch (this.channels_orig[_is_official][_target][channel_ids[i]]['redirect']['type']) {
              case 2: // 1:1 채팅
                try {
                  let user = await this.servers[_is_official][_target].client.readStorageObjects(
                    this.servers[_is_official][_target].session, {
                    object_ids: [{
                      collection: 'user_public',
                      key: 'profile_image',
                      user_id: this.channels_orig[_is_official][_target][channel_ids[i]]['redirect']['id'],
                    }]
                  });
                  let targetUser =
                    this.load_other_user(this.channels_orig[_is_official][_target][channel_ids[i]]['redirect']['id'], _is_official, _target);
                  if (user.objects.length) {
                    targetUser['img'] = user.objects[0].value['img'];
                  } else targetUser['img'] = undefined;
                  this.save_other_user(targetUser, _is_official, _target);
                } catch (e) { }
              case 3: // 그룹 채팅
                if (!this.channels_orig[_is_official][_target][channel_ids[i]]['update']) {
                  let c_msg = await this.servers[_is_official][_target].client.listChannelMessages(
                    this.servers[_is_official][_target].session, channel_ids[i], 1, false);
                  if (c_msg.messages.length)
                    this.update_from_channel_msg(c_msg.messages[0], _is_official, _target);
                }
                this.count_channel_online_member(this.channels_orig[_is_official][_target][channel_ids[i]], _is_official, _target);
                break;
              default:
                console.log('예상하지 못한 리다이렉션 타입: ', this.channels_orig[_is_official][_target][channel_ids[i]]['redirect']['type']);
                break;
            }
          } catch (e) {
            this.channels_orig[_is_official][_target][channel_ids[i]]['status'] = 'missing';
          }
        }
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
          try {
            this.channels_orig[_is_official][_target][_cid]['server']['name'] =
              this.servers[_is_official][_target].info.name;
          } catch (e) {
            this.channels_orig[_is_official][_target][_cid]['server']['name'] = this.lang.text['Nakama']['DeletedServer'];
          }
          switch (this.channels_orig[_is_official][_target][_cid]['redirect']['type']) {
            case 1: // 방 대화
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
                  if (this.groups[_is_official][_target][this.channels_orig[_is_official][_target][_cid]['redirect']['id']]['status'] == 'missing')
                    this.channels_orig[_is_official][_target][_cid]['status'] = this.groups[_is_official][_target][this.channels_orig[_is_official][_target][_cid]['redirect']['id']]['status'];
                } else this.channels_orig[_is_official][_target][_cid]['status'] = 'missing';
              }
              break;
            case 0: // 로컬 대화 기록, 채널로부터 복사하기
              if (!this.channels_orig[_is_official][_target][_cid]['info']) this.channels_orig[_is_official][_target][_cid]['info'] = {};
              this.channels_orig[_is_official][_target][_cid]['info']['name'] = this.channels_orig[_is_official][_target][_cid]['title'];
              if (!this.channels_orig[_is_official][_target][_cid]['info']['img'])
                this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/groups/${_cid}.img`, (e, v) => {
                  if (e && v) this.channels_orig[_is_official][_target][_cid]['info']['img'] = v;
                });
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
      let a_time = new Date(a['last_comment_time'] || 0).getTime();
      let b_time = new Date(b['last_comment_time'] || 0).getTime();
      if (a_time < b_time)
        return 1;
      else if (a_time > b_time)
        return -1;
      else return 0;
    });
    result.sort((a, b) => {
      if (a['is_new']) {
        if (b['is_new']) {
          return 0;
        } else return -1;
      } else {
        if (b['is_new']) {
          return 1;
        } else return 0;
      }
    });
    this.channels = result;
    this.MakeChannelHaveContextMenuAct();
    this.save_channels_with_less_info();
    return result;
  }

  /** 구독 페이지에서 우클릭시 채널 종류에 따른 정보 보여주기 */
  MakeChannelHaveContextMenuAct() {
    setTimeout(() => {
      for (let i = 0, j = this.channels.length; i < j; i++) {
        let TargetChannel = document.getElementById(`${this.channels[i]['server'].isOfficial}_${this.channels[i]['server'].target}_${this.channels[i]['id']}`);
        if (TargetChannel && TargetChannel.oncontextmenu == null)
          TargetChannel.oncontextmenu = () => {
            let index: number;
            for (let k = 0, l = this.channels.length; k < l; k++)
              if (`${this.channels[k]['server'].isOfficial}_${this.channels[k]['server'].target}_${this.channels[k].id}` == TargetChannel.id) {
                index = k;
                break;
              }
            let isOfficial = this.channels[index]['server'].isOfficial;
            let target = this.channels[index]['server'].target;
            let targetHeader = this.channels[index]['info'].name || this.channels[index]['info'].display_name;
            if (this.channels[index]['redirect'].type == 2) // 1:1 대화인 경우
              targetHeader = targetHeader || this.lang.text['Profile']['noname_user'];
            else targetHeader = targetHeader || this.lang.text['ChatRoom']['noname_chatroom'];
            switch (this.channels[index]['redirect'].type) {
              case 3: // 그룹 채널
                if (this.channels[index]['status'] == 'online' || this.channels[index]['status'] == 'pending') {
                  this.modalCtrl.create({
                    component: GroupDetailPage,
                    componentProps: {
                      info: this.groups[isOfficial][target][this.channels[index]['group_id']],
                      server: { isOfficial: isOfficial, target: target },
                    },
                  }).then(v => {
                    let cache_func = this.global.p5key['KeyShortCut'];
                    this.global.p5key['KeyShortCut'] = {};
                    v.onDidDismiss().then(() => {
                      this.global.p5key['KeyShortCut'] = cache_func;
                    });
                    v.present();
                  });
                  break;
                } // 온라인 그룹이 아니라면 1:1 채널과 같게 처리
              case 2: // 1:1 채널
                if (this.channels[index]['status'] == 'online' || this.channels[index]['status'] == 'pending') {
                  this.alertCtrl.create({
                    header: targetHeader,
                    message: this.lang.text['ChatRoom']['UnlinkChannel'],
                    buttons: [{
                      text: this.lang.text['ChatRoom']['LogOut'],
                      handler: async () => {
                        try {
                          await this.servers[isOfficial][target].socket.leaveChat(this.channels[index].id);
                          this.channels_orig[isOfficial][target][this.channels[index].id]['status'] = 'missing';
                        } catch (e) {
                          console.error('채널에서 나오기 실패: ', e);
                        }
                        this.rearrange_channels();
                      },
                      cssClass: 'redfont',
                    }]
                  }).then(v => v.present());
                } else this.alertCtrl.create({
                  header: targetHeader,
                  message: this.lang.text['ChatRoom']['RemoveChannelLogs'],
                  buttons: [{
                    text: this.lang.text['ChatRoom']['Delete'],
                    handler: async () => {
                      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
                      loading.present();
                      this.remove_group_list(this.channels_orig[isOfficial][target][this.channels[index].id]['info'], isOfficial, target, true);
                      delete this.channels_orig[isOfficial][target][this.channels[index].id];
                      this.remove_channel_files(isOfficial, target, this.channels[index].id);
                      let list = await this.indexed.GetFileListFromDB(`servers/${isOfficial}/${target}/channels/${this.channels[index].id}`);
                      for (let i = 0, j = list.length; i < j; i++) {
                        loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${j - i}`
                        await this.indexed.removeFileFromUserPath(list[i]);
                      }
                      loading.dismiss();
                      this.rearrange_channels();
                    },
                    cssClass: 'redfont',
                  }]
                }).then(v => v.present());
                break;
              case 0: // 로컬 채널
                this.alertCtrl.create({
                  header: targetHeader,
                  message: this.lang.text['ChatRoom']['RemoveChannelLogs'],
                  buttons: [{
                    text: this.lang.text['ChatRoom']['Delete'],
                    handler: async () => {
                      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
                      loading.present();
                      delete this.channels_orig[isOfficial][target][this.channels[index].id];
                      try {
                        await this.indexed.removeFileFromUserPath(`servers/${isOfficial}/${target}/groups/${this.channels[index].id}.img`);
                      } catch (e) {
                        console.log('그룹 이미지 삭제 오류: ', e);
                      }
                      this.remove_channel_files(isOfficial, target, this.channels[index].id, true);
                      this.save_groups_with_less_info();
                      let list = await this.indexed.GetFileListFromDB(`servers/${isOfficial}/${target}/channels/${this.channels[index].id}`);
                      for (let i = 0, j = list.length; i < j; i++) {
                        loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${j - i}`
                        await this.indexed.removeFileFromUserPath(list[i]);
                      }
                      loading.dismiss();
                      this.rearrange_channels();
                    },
                    cssClass: 'redfont',
                  }]
                }).then(v => v.present());
                break;
            }
            return false;
          }
      }
    }, 100);
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
          delete channels_copy[_is_official][_target][_cid]['status'];
          delete channels_copy[_is_official][_target][_cid]['color'];
          if (!channels_copy[_is_official][_target][_cid]['is_new'])
            delete channels_copy[_is_official][_target][_cid]['is_new'];
        });
        if (!ChannelIds.length) delete channels_copy[_is_official][_target];
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
  try_add_group(_info: any): Promise<void> {
    return new Promise(async (done, err) => {
      let servers = this.get_all_online_server();
      for (let i = 0, j = servers.length; i < j; i++)
        try {
          let v: any = await servers[i].client.joinGroup(servers[i].session, _info.id);
          if (!v) {
            console.log('그룹 join 실패... 벤 당했을 때인듯? 향후에 검토 필');
            return;
          }
          v = await servers[i].client.listGroups(servers[i].session, decodeURIComponent(_info['name']));
          for (let k = 0, l = v.groups.length; k < l; k++)
            if (v.groups[k].id == _info['id']) {
              let pending_group = v.groups[k];
              pending_group['status'] = pending_group.open ? 'online' : 'pending';
              pending_group['server'] = this.servers[servers[i].info.isOfficial][servers[i].info.target].info;
              try {
                let _list = await this.servers[servers[i].info.isOfficial][servers[i].info.target].client.listGroupUsers(
                  this.servers[servers[i].info.isOfficial][servers[i].info.target].session, v.groups[k].id
                );
                pending_group['users'] = _list.group_users;
                _list.group_users.forEach(_guser => {
                  if (_guser.user.id == this.servers[servers[i].info.isOfficial][servers[i].info.target].session.user_id)
                    _guser['is_me'] = true;
                  else this.save_other_user(_guser.user, servers[i].info.isOfficial, servers[i].info.target);
                });
              } catch (e) {
                console.error('그룹 정보 검토 오류: ', e);
              }
              try {
                let gimg = await this.servers[servers[i].info.isOfficial][servers[i].info.target].client.readStorageObjects(
                  this.servers[servers[i].info.isOfficial][servers[i].info.target].session, {
                  object_ids: [{
                    collection: 'group_public',
                    key: `group_${v.groups[k].id}`,
                    user_id: v.groups[k].creator_id,
                  }],
                });
                if (gimg.objects.length)
                  pending_group['img'] = gimg.objects[0].value['img'];
              } catch (e) {
                console.error('그룹 이미지 확인 오류: ', e);
              }
              this.save_group_info(pending_group, servers[i].info.isOfficial, servers[i].info.target);
              await servers[i].socket.sendMatchState(this.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.ADD_CHANNEL,
                encodeURIComponent(''));
              if (pending_group.open) { // 열린 그룹이라면 즉시 채널에 참가
                let c = await this.join_chat_with_modulation(pending_group.id, 3, servers[i].info.isOfficial, servers[i].info.target);
                if (!this.opened_page_info['channel']
                  || this.opened_page_info['channel']['isOfficial'] != servers[i].info.isOfficial
                  || this.opened_page_info['channel']['target'] != servers[i].info.target
                  || this.opened_page_info['channel']['id'] != c.id
                ) {
                  try {
                    let channel = await this.servers[servers[i].info.isOfficial][servers[i].info.target].client.listChannelMessages(
                      this.servers[servers[i].info.isOfficial][servers[i].info.target].session, c.id, 1, false);
                    if (channel.messages.length)
                      this.update_from_channel_msg(channel.messages[0], servers[i].info.isOfficial, servers[i].info.target);
                    this.save_group_info(pending_group, servers[i].info.isOfficial, servers[i].info.target);
                    this.go_to_chatroom_without_admob_act(c);
                  } catch (e) {
                    console.error('채널 정보 추가 오류: ', e);
                  }
                }
              }
              done();
              break;
            }
        } catch (e) {
          switch (e.status) {
            case 400: // 그룹에 이미 있는데 그룹추가 시도함
              let v = await servers[i].client.listGroups(servers[i].session, decodeURIComponent(_info['name']))
              for (let i = 0, j = v.groups.length; i < j; i++)
                if (v.groups[i].id == _info['id']) {
                  try {
                    let pending_group = v.groups[i];
                    let _list = await this.servers[servers[i].info.isOfficial][servers[i].info.target].client.listGroupUsers(
                      this.servers[servers[i].info.isOfficial][servers[i].info.target].session, v.groups[i].id
                    );
                    pending_group['users'] = _list.group_users;
                    _list.group_users.forEach(_guser => {
                      if (_guser.user.id == this.servers[servers[i].info.isOfficial][servers[i].info.target].session.user_id)
                        _guser['is_me'] = true;
                      else this.save_other_user(_guser.user, servers[i].info.isOfficial, servers[i].info.target);
                    });
                    this.save_group_info(pending_group, servers[i].info.isOfficial, servers[i].info.target);
                  } catch (e) {
                    console.error('그룹 정보 중복 정보: ', e);
                  }
                  break;
                }
              break;
            case 404: // 이 서버에는 없는 그룹
              break;
            default:
              console.error('그룹 추가 오류: ', e);
              break;
          }
        }
      err(this.lang.text['Nakama']['GroupAllListDone']);
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
                try { // 삭제된 그룹에서 발생하는 오류 무시용
                  if (copied_group[_is_official][_target][_gid]['users'][i]['user']['id']) {
                    copied_group[_is_official][_target][_gid]['users'][i]['user'] = { id: copied_group[_is_official][_target][_gid]['users'][i]['user']['id'] };
                    if (this.servers[_is_official][_target] && this.servers[_is_official][_target].session
                      && copied_group[_is_official][_target][_gid]['users'][i]['user']['id'] == this.servers[_is_official][_target].session.user_id)
                      copied_group[_is_official][_target][_gid]['users'][i]['is_me'] = true;
                  } else if (!copied_group[_is_official][_target][_gid]['users'][i]['is_me']) copied_group[_is_official][_target][_gid]['users'].splice(i, 1);
                } catch (e) { }
              }
            }
        });
        if (!GroupId.length) delete copied_group[_is_official][_target];
      });
    });
    this.indexed.saveTextFileToUserPath(JSON.stringify(copied_group), 'servers/groups.json', () => {
      _CallBack();
    });
    this.MakeChannelHaveContextMenuAct();
  }

  /** 그룹 리스트 로컬/리모트에서 삭제하기 (방장일 경우)  
   * 그룹 이미지 삭제처리
   * @param [_remove_history=false] 로컬 파일을 남겨두는지 여부
   */
  async remove_group_list(info: any, _is_official: string, _target: string, _remove_history = false) {
    try { // 내가 방장이면 해산처리 우선, 이 외의 경우 기록 삭제
      let is_creator = info['creator_id'] == this.servers[_is_official][_target].session.user_id;
      if (this.servers[_is_official][_target] && is_creator) {
        let v = await this.servers[_is_official][_target].client.deleteGroup(
          this.servers[_is_official][_target].session, info['id']);
        if (!v) console.log('그룹 삭제 오류 검토 필요');
        this.remove_channel_files(_is_official, _target, info['channel_id'], is_creator);
        try {
          await this.servers[_is_official][_target].client.deleteStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: 'group_public',
              key: `group_${info['id']}`,
            }]
          });
          throw "Remove group image well";
        } catch (e) {
          throw "No group image found";
        }
      } else throw "not a group creator";
    } catch (e) { }
    try {
      if (_remove_history)
        await this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/groups/${info.id}.img`);
    } catch (e) { }
  }

  /** 그룹 내에서 사용했던 서버 파일들 전부 삭제  
   * 채널 관리자라면 모든 파일 삭제  
   * 구성원이라면 자신의 파일만 삭제하기
   */
  remove_channel_files(_is_official: string, _target: string, channel_id: string, is_creator?: boolean) {
    try {
      this.servers[_is_official][_target].client.rpc(
        this.servers[_is_official][_target].session,
        'remove_channel_file', {
        collection: `file_${channel_id.replace(/[.]/g, '_')}`,
        is_creator: is_creator,
      }).catch(_e => { });
    } catch (e) { }
  }

  /** 연결된 서버에서 자신이 참여한 그룹을 리모트에서 가져오기  
   * ***돌려주는 값이 없는 nakama.initialize 단계 함수, 다른 용도로는 사용하지 말 것**  
   * 그룹 채팅 채널 접속 및 그룹 사용자 검토도 이곳에서 시도함
   */
  async get_group_list_from_server(_is_official: string, _target: string) {
    if (!this.groups[_is_official]) this.groups[_is_official] = {};
    if (!this.groups[_is_official][_target]) this.groups[_is_official][_target] = {};
    try {
      let userGroups = await this.servers[_is_official][_target].client.listUserGroups(
        this.servers[_is_official][_target].session,
        this.servers[_is_official][_target].session.user_id);
      for (let i = 0, j = userGroups.user_groups.length; i < j; i++) {
        if (!this.groups[_is_official][_target][userGroups.user_groups[i].group.id]) {
          this.groups[_is_official][_target][userGroups.user_groups[i].group.id] = {};
          try { // 로컬에 없던 그룹은 이미지 확인
            let gimg = await this.servers[_is_official][_target].client.readStorageObjects(
              this.servers[_is_official][_target].session, {
              object_ids: [{
                collection: 'group_public',
                key: `group_${userGroups.user_groups[i].group.id}`,
                user_id: userGroups.user_groups[i].group.creator_id,
              }],
            });
            if (gimg.objects.length) {
              this.groups[_is_official][_target][userGroups.user_groups[i].group.id]['img'] = gimg.objects[0].value['img'];
              this.indexed.saveTextFileToUserPath(gimg.objects[0].value['img'], `servers/${_is_official}/${_target}/groups/${userGroups.user_groups[i].group.id}.img`);
            }
          } catch (e) {
            console.error('그룹 이미지 가져오기 오류: ', e);
          }
        }
        this.groups[_is_official][_target][userGroups.user_groups[i].group.id]
          = { ...this.groups[_is_official][_target][userGroups.user_groups[i].group.id], ...userGroups.user_groups[i].group };
        this.groups[_is_official][_target][userGroups.user_groups[i].group.id]['status'] = 'online';
        try {
          let _guser = await this.servers[_is_official][_target].client.listGroupUsers(
            this.servers[_is_official][_target].session, userGroups.user_groups[i].group.id
          );
          for (let k = 0, l = _guser.group_users.length; k < l; k++) {
            if (_guser.group_users[k].user.id == this.servers[_is_official][_target].session.user_id)
              _guser.group_users[k].user['is_me'] = true;
            else {
              _guser.group_users[k].user['img'] = null;
              this.save_other_user(_guser.group_users[k].user, _is_official, _target);
            }
            _guser.group_users[k].user = this.load_other_user(_guser.group_users[k].user.id, _is_official, _target);
            this.add_group_user_without_duplicate(_guser.group_users[k], userGroups.user_groups[i].group.id, _is_official, _target);
          }
        } catch (e) {
          console.error('그룹 사용자 가져오기 오류: ', e);
        }
        try {
          await this.join_chat_with_modulation(userGroups.user_groups[i].group.id, 3, _is_official, _target);
        } catch (e) { }
      }
      this.save_groups_with_less_info();
    } catch (e) {
      console.error('사용자 그룹 가져오기 오류: ', e);
    }
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
          try {
            this.groups[_is_official][_target][_gid]['server'] = this.servers[_is_official][_target].info;
          } catch (e) {
            this.groups[_is_official][_target][_gid]['server'] = {
              name: this.lang.text['Nakama']['DeletedServer'],
              isOfficial: _is_official,
              target: _target,
            }
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
    if (this.statusBar.groupServer[_is_official][_target])
      this.statusBar.groupServer[_is_official][_target] = _status;
    this.catch_group_server_header(_status);
  }

  /** 채널 상태 검토 */
  async count_channel_online_member(p: any, _is_official: string, _target: string) {
    let result_status = 'pending';
    try {
      if (this.statusBar.groupServer[_is_official][_target] == 'offline')
        throw '서버 오프라인';
      if (p['group_id']) { // 그룹 채널인 경우
        if (this.groups[_is_official][_target][p['group_id']]
          && this.groups[_is_official][_target][p['group_id']]['users']) {
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
        if (!this.channels_orig[_is_official][_target][p.channel_id || p.id]) {
          try {
            let c = await this.join_chat_with_modulation(
              p['user_id_one'] != this.servers[_is_official][_target].session.user_id ? p['user_id_one'] : p['user_id_two'],
              2, _is_official, _target);
            let targetId = this.channels_orig[_is_official][_target][c.id]['redirect']['id'];
            result_status = this.load_other_user(targetId, _is_official, _target)['online'] ? 'online' : 'pending';
          } catch (e) {
            console.error(e);
          }
        } else {
          let targetId = this.channels_orig[_is_official][_target][p.channel_id || p.id]['redirect']['id'];
          let user = await this.servers[_is_official][_target].client.getUsers(
            this.servers[_is_official][_target].session, [targetId]);
          let keys = Object.keys(user.users[0]);
          keys.forEach(key => {
            this.users[_is_official][_target][targetId][key] = user.users[0][key];
          });
          result_status = this.load_other_user(targetId, _is_official, _target)['online'] ? 'online' : 'pending';
        }
      }
    } catch (e) {
      result_status = this.statusBar.groupServer[_is_official][_target] == 'offline' ? 'offline' : 'missing';
    }
    if (!this.channels_orig[_is_official][_target][p.channel_id || p.id])
      this.channels_orig[_is_official][_target][p.channel_id || p.id] = {};
    if (this.channels_orig[_is_official][_target][p.channel_id || p.id]['status'] != 'missing')
      this.channels_orig[_is_official][_target][p.channel_id || p.id]['status'] = result_status;
  }

  /** 사설 서버 삭제 */
  async remove_server(_is_official: string, _target: string) {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    loading.message = this.lang.text['Nakama']['RemovingAccount'];
    try {
      this.servers[_is_official][_target].client.rpc(
        this.servers[_is_official][_target].session,
        'remove_account_fn', { user_id: this.servers[_is_official][_target].session.user_id })
        .catch(_e => { });
    } catch (e) { }
    // 로그인 상태일 경우 로그오프처리
    loading.message = this.lang.text['Nakama']['LogoutAccount'];
    if (this.statusBar.groupServer[_is_official][_target] == 'online') {
      try {
        this.servers[_is_official][_target].socket.disconnect(true);
      } catch (e) {
        this.link_group(_is_official, _target, false);
      }
    }
    // 알림정보 삭제
    loading.message = this.lang.text['Nakama']['RemovingNotification'];
    try {
      delete this.noti_origin[_is_official][_target];
    } catch (e) { }
    this.rearrange_notifications();
    // 예하 채널들 손상처리
    loading.message = this.lang.text['Nakama']['MissingChannels'];
    try {
      let channel_ids = Object.keys(this.channels_orig[_is_official][_target]);
      if (!this.channels_orig['deleted']) this.channels_orig['deleted'] = {};
      if (!this.channels_orig['deleted'][_target]) this.channels_orig['deleted'][_target] = {};
      channel_ids.forEach(_cid => {
        this.channels_orig[_is_official][_target][_cid]['info']['status'] = 'missing';
        this.channels_orig[_is_official][_target][_cid]['status'] = 'missing';
        this.channels_orig['deleted'][_target][_cid] = JSON.parse(JSON.stringify(this.channels_orig[_is_official][_target][_cid]));
      });
      delete this.channels_orig[_is_official][_target];
    } catch (e) { }
    this.rearrange_channels();
    // 관련 파일들 전부 이관
    let list = await this.indexed.GetFileListFromDB(`servers/unofficial/${_target}`);
    for (let i = 0, j = list.length; i < j; i++) {
      let file = await this.indexed.GetFileInfoFromDB(list[i]);
      let targetPath = list[i].replace('/official/', '/deleted/').replace('/unofficial/', '/deleted/');
      await this.indexed.saveFileToUserPath(file, targetPath);
      await this.indexed.removeFileFromUserPath(list[i]);
      loading.message = `${this.lang.text['Nakama']['MissingChannelFiles']}: ${list[i]}`;
      if (isPlatform == 'Android' || isPlatform == 'iOS')
        this.noti.noti.schedule({
          id: 9,
          title: `${this.lang.text['Nakama']['MissingChannelFiles']}: ${j - i}`,
          progressBar: { value: i, maxValue: j },
          sound: null,
          smallIcon: 'res://icon_mono',
          color: 'b0b0b0',
        });
    }
    // 예하 그룹들 손상처리
    loading.message = this.lang.text['Nakama']['MissingGroups'];
    try {
      if (!this.groups['deleted']) this.groups['deleted'] = {};
      if (!this.groups['deleted'][_target]) this.groups['deleted'][_target] = {};
      this.groups['deleted'][_target] = JSON.parse(JSON.stringify(this.groups[_is_official][_target]));
      let group_ids = Object.keys(this.groups['deleted'][_target]);
      group_ids.forEach(_gid => {
        this.groups['deleted'][_target][_gid]['server']['name'] = this.lang.text['Nakama']['DeletedServer'];
        this.groups['deleted'][_target][_gid]['server']['isOfficial'] = 'deleted';
        this.groups['deleted'][_target][_gid]['status'] = 'missing';
        this.groups['deleted'][_target][_gid] = JSON.parse(JSON.stringify(this.groups[_is_official][_target][_gid]));
      });
      delete this.groups[_is_official][_target];
    } catch (e) { }
    // 그룹서버 정리
    loading.message = this.lang.text['Nakama']['DeletingServerInfo'];
    this.set_group_statusBar('offline', _is_official, _target);
    delete this.statusBar.groupServer[_is_official][_target];
    // 동일 주소 WebRTC 서버 일괄 삭제
    this.RemoveWebRTCServer(this.servers[_is_official][_target].info.address);
    delete this.servers[_is_official][_target];
    this.save_groups_with_less_info();
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
    // 파일로부터 일치하는 정보 삭제
    let list_detail = await this.indexed.loadTextFromUserPath('servers/list_detail.csv');
    if (list_detail) {
      let lines = list_detail.split('\n');
      for (let i = 0, j = lines.length; i < j; i++) {
        let sep = lines[i].split(',');
        if (sep[3] == _target) {
          lines.splice(i, 1);
          break;
        }
      }
      this.indexed.saveTextFileToUserPath(lines.join('\n'), 'servers/list_detail.csv');
    }
    setTimeout(() => {
      this.noti.ClearNoti(9);
    }, 100);
    loading.dismiss();
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
  /** 매니저의 할 일이 실시간 업데이트될 수 있도록 도움 (from match) */
  AddTodoManageUpdateAct: Function;
  /** 수신된 통화에 즉각 반응하기 위한 함수 링크 */
  WebRTCService: any;
  /** 소켓 서버에 연결 */
  async connect_to(_is_official: 'official' | 'unofficial' = 'official', _target = 'default') {
    await this.servers[_is_official][_target].socket.connect(
      this.servers[_is_official][_target].session, true);
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
    socket.onmatchdata = async (m) => {
      m['data_str'] = decodeURIComponent(new TextDecoder().decode(m.data));
      switch (m.op_code) {
        case MatchOpCode.MANAGE_TODO: {
          let sep = m['data_str'].split(',');
          switch (sep[0]) {
            case 'add': // 추가 또는 수정
              this.servers[_is_official][_target].client.readStorageObjects(
                this.servers[_is_official][_target].session, {
                object_ids: [{
                  collection: sep[1],
                  key: sep[2],
                  user_id: this.servers[_is_official][_target].session.user_id,
                }],
              }).then(async v => {
                if (v.objects.length) {
                  try { // 수정인 경우 기존 알림을 삭제
                    let json = v.objects[0].value as any;
                    let data = await this.indexed.loadTextFromUserPath(`todo/${json.id}/info.todo`);
                    let get_json = JSON.parse(data);
                    this.removeRegisteredId(get_json.noti_id);
                    this.noti.ClearNoti(get_json.noti_id);
                  } catch (e) { }
                  this.modify_remote_info_as_local(v.objects[0].value, _is_official, _target);
                  let json = v.objects[0].value as any;
                  this.noti.ClearNoti(json.noti_id);
                  this.set_todo_notification(json);
                  this.p5toast.show({
                    text: `${this.lang.text['Main']['RequestTodo']}: ${json.title}`,
                  });
                }
              });
              break;
            case 'done': // 완료
              this.indexed.loadTextFromUserPath(`todo/${sep[1]}/info.todo`, (e, v) => {
                if (e && v) {
                  let todo_info = JSON.parse(v);
                  todo_info.done = true;
                  this.modify_remote_info_as_local(todo_info, _is_official, _target);
                  this.indexed.GetFileListFromDB(`todo/${sep[1]}`, (v) => {
                    v.forEach(_path => this.indexed.removeFileFromUserPath(_path));
                    if (todo_info.noti_id)
                      if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
                        clearTimeout(this.web_noti_id[todo_info.noti_id]);
                        delete this.web_noti_id[todo_info.noti_id];
                      }
                    this.removeRegisteredId(todo_info.noti_id);
                    this.noti.ClearNoti(todo_info.noti_id);
                    this.SyncTodoCounter(_is_official, _target);
                  });
                }
              });
              break;
            case 'delete': // 삭제
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
                    this.removeRegisteredId(todo_info.noti_id);
                    this.noti.ClearNoti(todo_info.noti_id);
                    if (this.global.p5todo && this.global.p5todo['remove_todo'])
                      this.global.p5todo['remove_todo'](JSON.stringify(todo_info));
                  });
                  this.SyncTodoCounter(_is_official, _target);
                }
              });
              break;
            case 'worker': // 매니저 입장에서, 작업자 완료
              let isDelete = sep[3] == 'true';
              if (this.AddTodoManageUpdateAct)
                this.AddTodoManageUpdateAct(sep[1], sep[2], isDelete, Number(sep[4]));
              let userAct = isDelete ? this.lang.text['Main']['WorkerAbandon'] : this.lang.text['Main']['WorkerDone'];
              this.p5toast.show({
                text: `${userAct}: ${this.users[_is_official][_target][sep[2]]['display_name']}`,
              });
              // 로컬 자료를 변경해야함
              this.indexed.loadTextFromUserPath(`todo/${sep[1]}/info.todo`, (e, v) => {
                if (e && v) {
                  let todo_info = JSON.parse(v);
                  for (let i = 0, j = todo_info.workers.length; i < j; i++)
                    if ((todo_info.workers[i].user_id || todo_info.workers[i].id) == sep[2]) {
                      todo_info.workers[i]['isDelete'] = sep[3] == 'true';
                      todo_info.workers[i]['timestamp'] = Number(sep[4]);
                      break;
                    }
                  this.modify_remote_info_as_local(todo_info, _is_official, _target);
                  this.SyncTodoCounter(_is_official, _target);
                }
              });
              break;
            default:
              console.log('등록되지 않은 할 일 행동: ', m);
              break;
          }
          this.SyncTodoCounter(_is_official, _target);
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
            default:
              console.log('예상하지 못한 프로필 동기화 정보: ', m);
              break;
          }
        }
          break;
        case MatchOpCode.ADD_CHANNEL: {
          this.get_group_list_from_server(_is_official, _target);
        }
          break;
        case MatchOpCode.WEBRTC_INIT_REQ_SIGNAL: {
          let is_me = this.servers[_is_official][_target].session.user_id == m.presence.user_id;
          if (!is_me && this.socket_reactive['WEBRTC_INIT_REQ_SIGNAL'])
            this.socket_reactive['WEBRTC_INIT_REQ_SIGNAL']();
        }
          break;
        case MatchOpCode.WEBRTC_REPLY_INIT_SIGNAL: {
          let is_me = this.servers[_is_official][_target].session.user_id == m.presence.user_id;
          if (!is_me && this.socket_reactive['WEBRTC_REPLY_INIT_SIGNAL'])
            this.socket_reactive['WEBRTC_REPLY_INIT_SIGNAL'](m['data_str']);
        }
          break;
        case MatchOpCode.WEBRTC_RECEIVE_ANSWER: {
          let is_me = this.servers[_is_official][_target].session.user_id == m.presence.user_id;
          if (!is_me && this.socket_reactive['WEBRTC_RECEIVE_ANSWER'])
            this.socket_reactive['WEBRTC_RECEIVE_ANSWER'](m['data_str']);
        }
          break;
        case MatchOpCode.WEBRTC_ICE_CANDIDATES: {
          let is_me = this.servers[_is_official][_target].session.user_id == m.presence.user_id;
          if (!is_me && this.socket_reactive['WEBRTC_ICE_CANDIDATES'])
            this.socket_reactive['WEBRTC_ICE_CANDIDATES'](m['data_str']);
        }
          break;
        case MatchOpCode.WEBRTC_NEGOCIATENEEDED: {
          let is_me = this.servers[_is_official][_target].session.user_id == m.presence.user_id;
          if (!is_me && this.socket_reactive['WEBRTC_NEGOCIATENEEDED'])
            this.socket_reactive['WEBRTC_NEGOCIATENEEDED'](m['data_str']);
        }
          break;
        // 여러 기기를 이용할 경우 한 기기에서 통화를 받음
        case MatchOpCode.WEBRTC_RECEIVED_CALL_SELF: {
          if (this.socket_reactive['WEBRTC_RECEIVED_CALL_SELF'])
            this.socket_reactive['WEBRTC_RECEIVED_CALL_SELF']();
        }
          break;
        case MatchOpCode.WEBRTC_HANGUP: {
          let is_me = this.servers[_is_official][_target].session.user_id == m.presence.user_id;
          if (!is_me && this.WebRTCService) await this.WebRTCService.close_webrtc();
        }
          break;
        default:
          console.log('예상하지 못한 동기화 정보: ', m);
          break;
      }
    }
    socket.onchannelmessage = (c) => {
      if (!this.channels_orig[_is_official][_target][c.channel_id]) { // 재참가 + 놓친 메시지인 경우 검토
        if (c.user_id_one) // 1:1 채팅
          this.join_chat_with_modulation(c.sender_id, 2, _is_official, _target);
        else if (c.group_id)  // 그룹 채팅
          this.join_chat_with_modulation(c.group_id, 3, _is_official, _target);
      } else { // 평상시에
        this.update_from_channel_msg(c, _is_official, _target);
        if (c.content['match'] && c.sender_id != this.servers[_is_official][_target].session.user_id)
          this.JoinWebRTCMatch(c, _is_official, _target, this.channels_orig[_is_official][_target][c.channel_id]);
      }
    }
    socket.ondisconnect = (_e) => {
      this.OnSocketDisconnect(_is_official, _target);
    }
    return socket;
  }

  /** 소켓 닫힐 때 행동 */
  OnSocketDisconnect(_is_official: string, _target: string) {
    this.link_group(_is_official, _target, false);
    let keys = Object.keys(this.on_socket_disconnected);
    keys.forEach(key => this.on_socket_disconnected[key]());
  }

  /** 현재 보여지는 메시지들을 저장함  
   * @param messages 메시지[]
   */
  saveListedMessage(messages: any[], channel_info: any, _is_official: string, _target: string) {
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
      delete msg.content['local_comp'];
      delete msg.content['path'];
      delete msg['msgDate'];
      delete msg['displayDate'];
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
    let DateSep = SepByDate['target'].split('-');
    this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/channels/${channel_info.id}/chats/${DateSep[0]}/${DateSep[1]}/${DateSep[2]}`, (e, v) => {
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
      this.indexed.saveTextFileToUserPath(JSON.stringify(result), `servers/${_is_official}/${_target}/channels/${channel_info.id}/chats/${DateSep[0]}/${DateSep[1]}/${DateSep[2]}`);
    });
  }

  /** 메시지 수신 시각을 수신자에게 맞춤 */
  ModulateTimeDate(msg: any) {
    let currentTime = new Date(msg.create_time);
    let localeDate = currentTime.toLocaleDateString(this.lang.lang);
    msg['displayDate'] = localeDate;
    msg['msgDate'] = `${currentTime.getFullYear()}-${("00" + (currentTime.getMonth() + 1)).slice(-2)}-${("00" + currentTime.getDate()).slice(-2)}`;
    msg['msgTime'] = `${("00" + currentTime.getHours()).slice(-2)}:${("00" + currentTime.getMinutes()).slice(-2)}`;
  }

  /** 열린 채널에서 행동이 중첩되지 않도록 검토하는 용도  
   * 구분(e.g. channel) > { isOfficial, target, ... }
   */
  opened_page_info = {};
  /** 채널 정보를 변형한 후 추가하기 */
  async join_chat_with_modulation(targetId: string, type: number, _is_official: string, _target: string, isNewChannel = false) {
    if (!this.channels_orig[_is_official][_target]) this.channels_orig[_is_official][_target] = {};
    let c = await this.servers[_is_official][_target].socket.joinChat(targetId, type, true, false)
    try {
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
      try {
        this.channels_orig[_is_official][_target][c.id]['status'] = 'offline';
      } catch (e) { }
      await this.add_channels(c, _is_official, _target);
      if (!this.opened_page_info['channel']
        || this.opened_page_info['channel']['isOfficial'] != _is_official
        || this.opened_page_info['channel']['target'] != _target
        || this.opened_page_info['channel']['id'] != c.id
      ) {
        try {
          let msg = await this.servers[_is_official][_target].client.listChannelMessages(
            this.servers[_is_official][_target].session, c.id, 1, false);
          if (msg.messages.length)
            this.update_from_channel_msg(msg.messages[0], _is_official, _target, isNewChannel);
        } catch (e) {
          console.error('마지막 메시지 받아서 업데이트 오류: ', e);
        }
      }
      this.count_channel_online_member(c, _is_official, _target);
      this.save_groups_with_less_info();
      return c;
    } catch (e) {
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
      throw `${this.lang.text['Nakama']['AddChannelFailed']}: ${err_info}`;
    }
  }

  /** 채팅 페이지를 보고있는지 여부 */
  subscribe_lock = false;
  /** 채널에 새 메시지가 있는 경우 뱃지 표시 */
  has_new_channel_msg = false;
  /** 채널 메시지를 변조 후 전파하기 */
  async update_from_channel_msg(msg: ChannelMessage, _is_official: string, _target: string, isNewChannel = false) {
    let is_me = msg.sender_id == this.servers[_is_official][_target].session.user_id;
    let is_new = msg.message_id != this.channels_orig[_is_official][_target][msg.channel_id]['last_comment_id'];
    let c = this.modulation_channel_message(msg, _is_official, _target);
    if (!is_me && is_new) {
      let PushInfo = {
        id: this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id'],
        title: this.channels_orig[_is_official][_target][msg.channel_id]['info']['name']
          || this.channels_orig[_is_official][_target][msg.channel_id]['info']['display_name']
          || this.channels_orig[_is_official][_target][msg.channel_id]['title']
          || this.lang.text['Subscribes']['noTitiedChat'],
        body: c.content['msg'] || c.content['noti']
          || (c.content['match'] ? this.lang.text['ChatRoom']['JoinWebRTCMatch'] : undefined)
          || `(${this.lang.text['ChatRoom']['attachments']})`,
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
      }
      if (c.content['url'] && c.content['type'].indexOf('image/') == 0)
        PushInfo['image'] = c.content['url'];
      this.noti.PushLocal(PushInfo, this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id'], (ev: any) => {
        // 알림 아이디가 같으면 진입 허용
        if (ev && ev['id'] == this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id']) {
          this.go_to_chatroom_without_admob_act(this.channels_orig[_is_official][_target][msg.channel_id]);
        } else this.go_to_chatroom_without_admob_act(this.channels_orig[_is_official][_target][msg.channel_id]);
      });
    }
    if (is_me) this.noti.ClearNoti(this.channels_orig[_is_official][_target][msg.channel_id]['cnoti_id']);
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
      case 1: // 채널 메시지를 편집한 경우
      case 2: // 채널 메시지를 삭제한 경우
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
          try {
            let noti = await this.servers[_is_official][_target].client.deleteNotifications(
              this.servers[_is_official][_target].session, empty_ids);
            if (!noti) console.log('사용하지 않는 알림 삭제 후 오류');
            this.update_notifications(_is_official, _target);
          } catch (e) {
            console.error('알림 삭제 오류: ', e);
          }
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
    this.channels_orig[_is_official][_target][msg.channel_id]['last_comment_time'] = msg.update_time;
    this.channels_orig[_is_official][_target][c.channel_id]['last_comment_id'] = c.message_id;
    if (!isNewChannel && this.channels_orig[_is_official][_target][c.channel_id]['update'])
      this.channels_orig[_is_official][_target][c.channel_id]['update'](c);
    this.saveListedMessage([c], this.channels_orig[_is_official][_target][c.channel_id], _is_official, _target);
    let hasFile = c.content['filename'] ? `(${this.lang.text['ChatRoom']['attachments']}) ` : '';
    this.channels_orig[_is_official][_target][c.channel_id]['last_comment'] = hasFile +
      (original_msg || c.content['noti'] || (c.content['match'] ? this.lang.text['ChatRoom']['JoinWebRTCMatch'] : undefined) || '');
    this.rearrange_channels();
  }

  /** 커뮤니티 페이지를 보고 있는지 여부 */
  is_post_lock = false;
  /** 사설 SNS에 새 글이 게시된 경우 뱃지 표시 */
  has_new_post = false;
  /** 내가 참여한 채널의 게시물들  
   * posts_orig[isOfficial][target][user_id][post.id] = { post_info... }
   */
  posts_orig = {
    local: { target: { me: {} } },
    official: {},
    unofficial: {},
  };
  /** 내가 참여한 채널의 게시물들 (정렬됨) */
  posts = [];

  /** 모든 포스트 정보를 재정렬 */
  rearrange_posts() {
    this.posts.length = 0;
    let isOfficial = Object.keys(this.posts_orig);
    for (let i = 0, j = isOfficial.length; i < j; i++) {
      let target = Object.keys(this.posts_orig[isOfficial[i]]);
      for (let k = 0, l = target.length; k < l; k++) {
        let user_id = Object.keys(this.posts_orig[isOfficial[i]][target[k]]);
        for (let m = 0, n = user_id.length; m < n; m++) {
          let key = Object.keys(this.posts_orig[isOfficial[i]][target[k]][user_id[m]]);
          for (let o = 0, p = key.length; o < p; o++)
            this.posts.push(this.posts_orig[isOfficial[i]][target[k]][user_id[m]][key[o]]);
        }
      }
    }
    // 시간순 정렬
    this.posts.sort((a, b) => {
      if (a['create_time'] < b['create_time'])
        return 1;
      if (a['create_time'] > b['create_time'])
        return -1;
      return 0;
    });
    this.MakeContextMenuOnPost();
  }

  /** 게시물 우클릭 행동 추가 */
  MakeContextMenuOnPost() {
    setTimeout(() => {
      for (let i = 0, j = this.posts.length; i < j; i++) {
        let TargetPost = document.getElementById(this.posts[i]['id']);
        if (TargetPost && TargetPost.oncontextmenu == null)
          TargetPost.oncontextmenu = () => {
            let index: number;
            for (let k = 0, l = this.posts.length; k < l; k++)
              if (this.posts[k]['id'] == TargetPost.id) {
                index = k;
                break;
              }
            if (this.posts[index]['server']['local'] ||
              this.posts[index]['creator_id'] == this.servers[this.posts[index]['server']['isOfficial']][this.posts[index]['server']['target']].session.user_id)
              this.alertCtrl.create({
                header: this.posts[index]['title'],
                message: this.posts[index]['content'],
                buttons: [{
                  text: this.lang.text['ChatRoom']['EditChat'],
                  handler: () => {
                    this.EditPost(this.posts[index]);
                  }
                }, {
                  text: this.lang.text['TodoDetail']['remove'],
                  handler: () => {
                    this.RemovePost(this.posts[index]);
                  },
                  cssClass: 'redfont',
                }],
              }).then(v => v.present());
            return false;
          }
      }
    }, 100);
  }

  /** 커뮤니티 탭에서 게시물 편집 열기 */
  CommunityGoToEditPost: Function;
  /** 게시물 편집 */
  EditPost(info: any) {
    if (this.CommunityGoToEditPost)
      this.CommunityGoToEditPost(info);
  }

  /** 게시물 폴더 삭제 */
  async RemovePost(info: any, slient = false) {
    let loading: HTMLIonLoadingElement;
    if (!slient) loading = await this.loadingCtrl.create({ message: this.lang.text['PostViewer']['RemovePost'] });
    let list = await this.indexed.GetFileListFromDB(`servers/${info['server']['isOfficial']}/${info['server']['target']}/posts/${info['creator_id']}/${info['id']}`);
    if (loading) loading.present();
    for (let i = 0, j = list.length; i < j; i++) {
      if (loading) loading.message = `${this.lang.text['PostViewer']['RemovePost']}: ${list[i]}`;
      await this.indexed.removeFileFromUserPath(list[i]);
    }
    // 첨부파일 삭제
    for (let i = 0, j = info['attachments'].length; i < j; i++)
      try {
        if (loading) loading.message = `${this.lang.text['PostViewer']['RemovePost']}: ${info['attachments'][i]['filename']}`;
        if (info['attachments'][i].url) {
          await this.global.remove_file_from_storage(info['attachments'][i].url);
        } else {
          try {
            if (!info.server.local)
              await this.sync_remove_file(`${info['id']}_attach_${i}`, info['server']['isOfficial'], info['server']['target'], 'server_post', '', `${info['id']}_attach_${i}`);
          } catch (e) { }
        }
      } catch (e) { }
    // 메인 사진 삭제
    if (info['mainImage'])
      try {
        if (info['mainImage'].url) {
          await this.global.remove_file_from_storage(info['mainImage'].url);
        } else {
          try {
            if (!info.server.local)
              await this.sync_remove_file(`${info['id']}_mainImage`, info['server']['isOfficial'], info['server']['target'], 'server_post', '', `${info['id']}_mainImage`);
          } catch (e) { }
        }
      } catch (e) { }
    // 게시물 정보 삭제하기
    try {
      if (!info.server.local)
        await this.sync_remove_file(info['id'], info['server']['isOfficial'], info['server']['target'], 'server_post', '', `${info['id']}`);
    } catch (e) { }
    if (loading) loading.dismiss();
    delete this.posts_orig[info['server']['isOfficial']][info['server']['target']][info['creator_id']][info['id']];
    this.rearrange_posts();
  }

  /** WebRTC 통화 채널에 참가하기 */
  async JoinWebRTCMatch(msg: any, _is_official: string, _target: string, c_info: any) {
    try {
      try {
        this.WebRTCService.CurrentMatch = await this.servers[_is_official][_target].socket.joinMatch(msg.content.match);
      } catch (e) {
        throw e;
      }
      if (this.WebRTCService)
        await this.WebRTCService.initialize('audio', undefined, {
          isOfficial: _is_official,
          target: _target,
          channel_id: c_info['id'],
          user_id: c_info['info']['id'] || c_info['info']['user_id'],
        }, false);
      await this.servers[_is_official][_target].socket.sendMatchState(
        msg.content.match, MatchOpCode.WEBRTC_INIT_REQ_SIGNAL, encodeURIComponent(''))
    } catch (e) {
      switch (e.code) {
        case 4:
          this.p5toast.show({
            text: this.lang.text['ChatRoom']['MatchExpiration'],
          });
          break;
        default:
          console.log('참여 실패: ', e);
          this.p5toast.show({
            text: `${this.lang.text['ChatRoom']['JoinMatchFailed']}: ${e}`,
          });
          break;
      }
    }
  }

  /** 메시지를 엔터 단위로 분리, 메시지 내 하이퍼링크가 있는 경우 검토  
   * 이 곳에서 메시지가 작은 단위별로 쪼개지며 메시지에 필요한 정보가 구성된다
   */
  content_to_hyperlink(msg: any) {
    if (!msg.content['msg'] || typeof msg.content['msg'] == 'object') return;
    let sep_msg = msg.content['msg'].split('\n');
    msg.content['msg'] = [];
    sep_msg.forEach(_msg => {
      let currentPart = { text: _msg };
      if (_msg) msg.content['msg'].push([currentPart]);
      try {
        let hasEmoji = currentPart.text.match(/\p{Emoji}+/gu)[0].replace(/[0-9]/g, '');
        if (currentPart.text.length == hasEmoji.length)
          currentPart['size'] = 48;
      } catch (e) { }
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
        }
      }
  }

  /** 발신인 표시를 위한 메시지 추가 가공 */
  check_sender_and_show_name(c: ChannelMessage, _is_official: string, _target: string) {
    try {
      c['color'] = (c.sender_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
      if (c.sender_id == this.servers[_is_official][_target].session.user_id) {
        c['user_display_name'] = this.users.self['display_name'];
        c['is_me'] = true;
      } else c['user_display_name'] = this.load_other_user(c.sender_id, _is_official, _target)['display_name'];
      c['user_display_name'] = c['user_display_name'] || this.lang.text['Profile']['noname_user'];
    } catch (e) {
      console.log('발신자 체크 오류: ', e);
    }
  }

  /** 채널 정보를 분석하여 메시지 변형 (행동은 하지 않음)
   * @return c.modulated
   */
  modulation_channel_message(c: ChannelMessage, _is_official: string, _target: string) {
    this.translate_updates(c);
    let is_me = false;
    try {
      is_me = c.sender_id == this.servers[_is_official][_target].session.user_id;
    } catch (error) {
      is_me = c.content['user_update'];
    }
    let target: any;
    try { // 온라인인 경우 검토
      target = is_me ? this.users.self : this.load_other_user(c.sender_id, _is_official, _target);
    } catch (e) { // 로컬 채널은 무조건 나임
      target = this.users.self;
    }
    switch (c.code) {
      case 0: // 사용자가 작성한 일반적인 메시지
        if (c.content['filename']) { // 파일이라면 전송 정보 연결 시도하기
          try {
            c.content['transfer_index'] = this.OnTransfer[_is_official][_target][c.channel_id][c.message_id];
          } catch (e) { }
          try {
            this.OnTransferMessage[c.message_id] = c;
          } catch (e) { }
        }
        break;
      case 1: // 사용자가 편집한 메시지
      case 2: // 사용자가 삭제한 메시지
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
        console.log('예상하지 못한 메시지 코드: ', c);
        break;
    }
    return c;
  }

  /** 그룹 정보 변경 처리 */
  update_group_info(c: ChannelMessage, _is_official: string, _target: string) {
    this.translate_updates(c);
    switch (c.content['gupdate']) {
      case 'remove': // 그룹이 삭제됨
      case 'force_remove': // 그룹이 강제 삭제됨
        this.groups[_is_official][_target][c.group_id]['status'] = 'missing';
        this.save_groups_with_less_info();
        this.channels_orig[_is_official][_target][c.channel_id]['status'] = 'missing';
        this.servers[_is_official][_target].socket.leaveChat(c.channel_id);
        break;
      default:
        console.log('예상하지 못한 그룹 행동: ', c);
        break;
    }
  }

  /** 사용자 및 그룹 업데이트 안내 문구 번역 구성 */
  translate_updates(msg: any) {
    if (msg.content['user_update'])
      switch (msg.content['user_update']) {
        case 'modify_data': // 프로필 정보가 변경됨
          msg.content['noti'] = `${this.lang.text['Profile']['user_profile_changed']}${msg.content['noti_form']}`;
          break;
        case 'modify_img': // 프로필 이미지가 변경됨
          msg.content['noti'] = `${this.lang.text['Profile']['user_image_changed']}${msg.content['noti_form']}`;
          break;
      }
    if (msg.content['gupdate'])
      switch (msg.content['gupdate']) {
        case 'remove': // 그룹이 삭제됨
          msg.content['noti'] = this.lang.text['GroupDetail']['GroupRemoved'];
          break;
        case 'force_remove': // 그룹이 삭제됨
          msg.content['noti'] = this.lang.text['GroupDetail']['GroupForceRemoved'];
          break;
      }
  }

  /** 그룹 채널 사용자 상태 변경 처리 */
  async update_group_user_info(c: ChannelMessage, _is_official: string, _target: string) {
    this.translate_updates(c);
    if (this.servers[_is_official][_target].session.user_id == c.sender_id)
      return; // 혹시 내가 보낸 정보라면 처리하지 마세요
    switch (c.content['user_update']) {
      case 'modify_data': // 프로필 정보가 변경됨
        try {
          let other = await this.servers[_is_official][_target].client.getUsers(
            this.servers[_is_official][_target].session, [c.sender_id]
          );
          if (other.users.length) {
            this.save_other_user(other.users[0], _is_official, _target);
          } else {
            delete this.users[_is_official][_target][c.sender_id];
            this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/users/${c.sender_id}/profile.json`)
          }
        } catch (e) {
          console.error('다른 사용자 프로필 정보 변경 오류: ', e);
        }
        break;
      case 'modify_img': // 프로필 이미지 변경됨
        try {
          let user_img = await this.servers[_is_official][_target].client.readStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: 'user_public',
              key: 'profile_image',
              user_id: c.sender_id,
            }]
          }
          );
          if (user_img.objects.length) {
            this.load_other_user(c.sender_id, _is_official, _target)['img'] = user_img.objects[0].value['img'].replace(/"|\\|=/g, '');
            this.indexed.saveTextFileToUserPath(this.users[_is_official][_target][c.sender_id]['img'],
              `servers/${_is_official}/${_target}/users/${c.sender_id}/profile.img`);
          } else {
            delete this.users[_is_official][_target][c.sender_id]['img'];
            this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/users/${c.sender_id}/profile.img`)
          }
        } catch (e) {
          console.error('다른 사용자 프로필 이미지 변경 오류: ', e);
        }
        break;
      default:
        console.log('예상하지 못한 그룹 사용자 행동: ', c);
        break;
    }
  }

  /** 알림 내용 클릭시 행동 */
  async check_notifications(this_noti: Notification, _is_official: string, _target: string) {
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
        try {
          let noti = await this_server.client.deleteNotifications(this_server.session, [this_noti['id']]);
          if (!noti) console.log('알림 거부처리 검토 필요');
          this.update_notifications(_is_official, _target);
        } catch (e) {
          console.error('알림 삭제 오류: ', e);
        }
        break;
      case -5: // 그룹 참가 요청 받음
        try {
          let other_user = await this_server.client.getUsers(this_server.session, [this_noti['sender_id']]);
          if (other_user.users.length) {
            let msg = '';
            msg += `${this.lang.text['Nakama']['ReqContServer']}: ${this_noti['server']['name']}<br>`;
            msg += `${this.lang.text['Nakama']['ReqContUserName']}: ${other_user.users[0].display_name}`;
            this.alertCtrl.create({
              header: this.lang.text['Nakama']['ReqContTitle'],
              message: msg,
              buttons: [{
                text: this.lang.text['Nakama']['ReqContAccept'],
                handler: async () => {
                  try {
                    let user = await this_server.client.addGroupUsers(this_server.session, this_noti['content']['group_id'], [other_user.users[0].id]);
                    if (!user) console.log('밴인 경우인 것 같음, 확인 필요');
                    this.noti.RemoveListener(`check${this_noti.code}`);
                    this.noti.ClearNoti(this_noti.code);
                    try {
                      let noti = await this_server.client.deleteNotifications(this_server.session, [this_noti['id']]);
                      if (noti) this.update_notifications(_is_official, _target);
                      else console.log('알림 지우기 실패: ', noti);
                    } catch (e) {
                      console.error('알림 삭제 오류: ', e);
                    }
                  } catch (e) {
                    console.error('그룹에 사용자 추가 오류: ', e);
                  }
                }
              }, {
                text: this.lang.text['Nakama']['ReqContReject'],
                handler: async () => {
                  try {
                    let kick = await this_server.client.kickGroupUsers(this_server.session, this_noti['content']['group_id'], [other_user.users[0].id]);
                    if (!kick) console.log('그룹 참여 거절을 kick한 경우 오류');
                    this_server.client.deleteNotifications(this_server.session, [this_noti['id']]);
                    this.update_notifications(_is_official, _target);
                  } catch (e) {
                    console.error('사용자 강퇴 오류: ', e);
                  }
                },
                cssClass: 'redfont',
              }],
            }).then(v => v.present());
          } else {
            try {
              let noti = await this_server.client.deleteNotifications(this_server.session, [this_noti['id']]);
              if (!noti) console.log('알림 거부처리 검토 필요');
              this.p5toast.show({
                text: this.lang.text['Nakama']['UserNotFound'],
              })
              this.update_notifications(_is_official, _target);
            } catch (e) {
              console.error('알림 삭제 오류: ', e);
            }
          }
        } catch (e) {
          console.error('사용자 정보 받아오기 오류: ', e);
        }
        break;
      case -7: // 서버에서 단일 세션 연결 허용시 끊어진 것에 대해
        this.LoginAgain(this.noti_origin, _is_official, _target);
        break;
      default:
        console.log('예상하지 못한 알림 구분: ', this_noti.code);
        break;
    }
  }

  /** 들어오는 알림에 반응하기 */
  async act_on_notification(v: Notification, _is_official: string, _target: string) {
    /** 처리과정에서 알림이 지워졌는지 여부 */
    let is_removed = false;
    v['server'] = this.servers[_is_official][_target].info;
    switch (v.code) {
      case 404:
        this.remove_server(_is_official, _target);
        break;
      case 1: // 전체 알림 메시지 수신
        try {
          let noti = await this.servers[_is_official][_target].client.deleteNotifications(
            this.servers[_is_official][_target].session, [v['id']]);
          if (!noti) console.log('알림 거부처리 검토 필요');
          this.update_notifications(_is_official, _target);
        } catch (e) {
          console.error('알림 삭제 오류: ', e);
        }
        let decode_body = decodeURIComponent(v.content['msg']);
        let decode_image = decodeURIComponent(v.content['uri']);
        this.noti.PushLocal({
          id: v.code,
          title: this.servers[_is_official][_target].info.name,
          body: decode_body,
          image: decode_image,
          extra_ln: {
            type: 'AllUserNotification',
            title: this.servers[_is_official][_target].info.name,
            body: decode_body,
            image: decode_image,
            isOfficial: _is_official,
            target: _target,
            noti_id: v.id,
          },
          smallIcon_ln: 'diychat',
          group_ln: 'all_user_noti',
          iconColor_ln: 'b95437',
        }, 'global_noti_all', (_ev: any) => {
          let image_form = `<img src="${decode_image}" alt="noti_image" style="border-radius: 2px">`;
          let text_form = `<div>${decode_body}</div>`;
          let result_form = decode_image ? image_form + text_form : text_form;
          this.alertCtrl.create({ // 전체 알림 알람 내용보기
            header: this.servers[_is_official][_target].info.name,
            message: new IonicSafeString(result_form),
            buttons: [{
              text: this.lang.text['Nakama']['LocalNotiOK'],
              handler: () => {
                this.servers[_is_official][_target].client.deleteNotifications(
                  this.servers[_is_official][_target].session, [v.id]);
              }
            }]
          }).then(v => v.present());
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
            this.join_chat_with_modulation(v['sender_id'], targetType, _is_official, _target);
            break;
          default:
            console.log('예상하지 못한 알림 행동처리: ', v, targetType);
            v['request'] = `${v.code}-${v.subject}`;
            break;
        }
        is_removed = true;
        try {
          let noti = await this.servers[_is_official][_target].client.deleteNotifications(
            this.servers[_is_official][_target].session, [v['id']]);
          if (!noti) console.log('알림 거부처리 검토 필요');
          this.update_notifications(_is_official, _target);
        } catch (e) {
          console.error('알림 삭제 오류: ', e);
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
        this.groups[_is_official][_target][v.content['group_id']]['status'] = 'online';
        v['request'] = `${v.code}-${v.subject}`;
        this.noti.RemoveListener(`check${v.code}`);
        this.noti.SetListener(`check${v.code}`, (_v: any) => {
          this.noti.ClearNoti(_v['id']);
          this.noti.RemoveListener(`check${v.code}`);
          this.check_notifications(v, _is_official, _target);
        });
        try {
          let img = await this.servers[_is_official][_target].client.readStorageObjects(
            this.servers[_is_official][_target].session, {
            object_ids: [{
              collection: 'group_public',
              key: `group_${v.content['group_id']}`,
              user_id: this.groups[_is_official][_target][v.content['group_id']].creator_id,
            }]
          });
          if (img.objects.length) {
            this.groups[_is_official][_target][v.content['group_id']]['img'] = img.objects[0].value['img'];
            this.indexed.saveTextFileToUserPath(img.objects[0].value['img'], `servers/${_is_official}/${_target}/groups/${v.content['group_id']}.img`);
          }
        } catch (e) {
          console.error('그룹 이미지 가져오기 오류: ', e);
        }
        try {
          let gulist = await this.servers[_is_official][_target].client.listGroupUsers(
            this.servers[_is_official][_target].session, v.content['group_id']);
          if (gulist.group_users.length) {
            gulist.group_users.forEach(user => {
              this.load_other_user(user.user.id, _is_official, _target);
            });
          }
        } catch (e) {
          console.error('그룹 사용자 가져오기 오류: ', e);
        }
        this.join_chat_with_modulation(v.content['group_id'], 3, _is_official, _target);
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
          try {
            let noti = await this.servers[_is_official][_target].client.deleteNotifications(
              this.servers[_is_official][_target].session, [v.id]);
            if (noti) this.update_notifications(_is_official, _target);
            else console.log('알림 지우기 실패: ', noti);
          } catch (e) {
            console.error('알림 제거 오류: ', e);
          }
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
        v['request'] = `${this.servers[_is_official][_target].info.name}: ${this.lang.text['Nakama']['SessionLogout']}`;
        this.LoginAgain(v, _is_official, _target);
        break;
      default:
        console.log('확인되지 않은 실시간 알림_nakama_noti: ', v);
        v['request'] = `${v.code}-${v.subject}`;
        break;
    }
    if (is_removed) return;
    if (!this.noti_origin[_is_official]) this.noti_origin[_is_official] = {};
    if (!this.noti_origin[_is_official][_target]) this.noti_origin[_is_official][_target] = {};
    this.noti_origin[_is_official][_target][v.id] = v;
  }

  LoginAgain(v: Notification, _is_official: string, _target) {
    this.alertCtrl.create({
      header: this.servers[_is_official][_target].info.name,
      message: this.lang.text['Nakama']['LoginAgain'],
      buttons: [{
        text: this.lang.text['Profile']['login_toggle'],
        handler: () => {
          try {
            delete this.noti_origin[_is_official][_target][v.id];
          } catch (e) { }
          this.rearrange_notifications();
          this.link_group(_is_official, _target, true);
        }
      }]
    }).then(v => v.present());
  }

  /** 전송중인 파일 검토  
   * OnTransfer[isOfficial][target][channel_id][message_id] = index;
   */
  OnTransfer = {};
  /** 전송중인 파일에 해당하는 썸네일을 받을 개체
   * OnTransferMessage[message_id] = index;  
   * 채널 채팅 화면을 벗어날 때 삭제됨
   */
  OnTransferMessage = {};
  /**
   * 채널에서 백그라운드 파일 발송 요청
   * @param msg 메시지 정보
   * @param path indexedDB 파일 경로
   */
  async WriteStorage_From_channel(msg: any, path: string, _is_official: string, _target: string, startFrom = 0) {
    let _msg = JSON.parse(JSON.stringify(msg));
    let file_info = await this.global.req_file_info(path);
    let partsize = Math.ceil(file_info.contents.length / FILE_BINARY_LIMIT);
    if (!this.OnTransfer[_is_official]) this.OnTransfer[_is_official] = {};
    if (!this.OnTransfer[_is_official][_target]) this.OnTransfer[_is_official][_target] = {};
    if (!this.OnTransfer[_is_official][_target][msg.channel_id]) this.OnTransfer[_is_official][_target][msg.channel_id] = {};
    if (!this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id])
      this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id] = { index: partsize };
    if (this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id]['OnTransfer']) return;
    if (!msg.content['transfer_index'])
      msg.content['transfer_index'] = this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id];
    for (let i = startFrom; i < partsize; i++)
      try {
        let part = this.global.req_file_part_base64(file_info, i, path);
        await this.servers[_is_official][_target].client.writeStorageObjects(
          this.servers[_is_official][_target].session, [{
            collection: `file_${_msg.channel_id.replace(/[.]/g, '_')}`,
            key: `msg_${_msg.message_id}_${i}`,
            permission_read: 2,
            permission_write: 1,
            value: { data: part },
          }])
        this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id]['index'] = partsize - 1 - i;
        this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id]['OnTransfer'] = 'upload';
      } catch (e) {
        console.log('WriteStorage_From_channel: ', e);
        this.p5toast.show({
          text: `${this.lang.text['Nakama']['FailedUpload']}: ${e}`,
        });
        break;
      }
    setTimeout(() => {
      delete this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id];
      this.global.remove_req_file_info(msg, path);
      this.p5toast.show({
        text: `${this.lang.text['ChatRoom']['SendFile']}: ${_msg.content.filename}`,
      });
    }, 100);
  }

  /**
   * 채널 메시지에 기반하여 파일 다운받기
   * @param msg 메시지 정보
   */
  async ReadStorage_From_channel(msg: any, path: string, _is_official: string, _target: string, startFrom = 0) {
    let _msg = JSON.parse(JSON.stringify(msg));
    if (!this.OnTransfer[_is_official]) this.OnTransfer[_is_official] = {};
    if (!this.OnTransfer[_is_official][_target]) this.OnTransfer[_is_official][_target] = {};
    if (!this.OnTransfer[_is_official][_target][msg.channel_id]) this.OnTransfer[_is_official][_target][msg.channel_id] = {};
    if (!this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id])
      this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id] = { index: _msg.content['partsize'] };
    // 이미 진행중이라면 무시
    if (this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id]['OnTransfer']) return;
    if (!msg.content['transfer_index'])
      msg.content['transfer_index'] = this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id];
    let isSuccessful = true;
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
        this.global.save_file_part(path, i, v.objects[0].value['data']);
        this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id]['index'] = j - 1 - i;
        this.OnTransfer[_is_official][_target][msg.channel_id][msg.message_id]['OnTransfer'] = 'download';
      } catch (e) {
        console.log('ReadStorage_From_channel: ', e);
        isSuccessful = false;
        this.p5toast.show({
          text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`,
        });
        break;
      }
    if (isSuccessful) {
      if (msg.content['url']) { // 링크
        msg.content['thumbnail'] = msg.content['url'];
      } else { // 서버에 업로드된 파일
        msg.content['text'] = [this.lang.text['ChatRoom']['SavingFile']];
        delete msg.content['transfer_index'];
        delete this.OnTransfer[_is_official][_target][_msg.channel_id][_msg.message_id]['index'];
        this.p5toast.show({
          text: `${this.lang.text['ChatRoom']['SavingFile']}: ${_msg.content.filename}`,
        });
        if (isPlatform == 'Android' || isPlatform == 'iOS')
          this.noti.noti.schedule({
            id: 8,
            title: `${this.lang.text['ContentViewer']['SavingFile']}: ${msg.content.filename}`,
            progressBar: { indeterminate: true },
            sound: null,
            smallIcon: 'res://diychat',
            color: 'b0b0b0',
          });
        let GatheringInt8Array = [];
        let ByteSize = 0;
        await new Promise(async (done) => {
          for (let i = 0, j = _msg.content['partsize']; i < j; i++)
            try {
              let part = await this.indexed.GetFileInfoFromDB(`${path}_part/${i}.part`);
              ByteSize += part.contents.length;
              GatheringInt8Array[i] = part;
            } catch (e) {
              console.log('파일 병합하기 오류: ', e);
              break;
            }
          try {
            let SaveForm: Int8Array = new Int8Array(ByteSize);
            let offset = 0;
            for (let i = 0, j = GatheringInt8Array.length; i < j; i++) {
              SaveForm.set(GatheringInt8Array[i].contents, offset);
              offset += GatheringInt8Array[i].contents.length;
            }
            await this.indexed.saveInt8ArrayToUserPath(SaveForm, path);
            for (let i = 0, j = _msg.content['partsize']; i < j; i++)
              this.indexed.removeFileFromUserPath(`${path}_part/${i}.part`)
            await this.indexed.removeFileFromUserPath(`${path}_part`)
            this.global.remove_req_file_info(_msg, path);
            msg.content['text'] = [this.lang.text['ChatRoom']['FileSaved']];
          } catch (e) {
            console.log('파일 최종 저장하기 오류: ', e);
          }
          done(undefined);
        });
        this.noti.ClearNoti(8);
      }
      _msg.content['path'] = path;
      let url: string;
      if (_msg.content.viewer != 'godot') {
        let blob = await this.indexed.loadBlobFromUserPath(path, msg.content['type'] || '')
        url = URL.createObjectURL(blob);
      }
      await this.global.modulate_thumbnail((this.OnTransferMessage[_msg.message_id] || msg).content, url);
      delete this.OnTransfer[_is_official][_target][_msg.channel_id][_msg.message_id];
      delete this.OnTransferMessage[_msg.message_id];
    }
    return isSuccessful;
  }

  /** 로컬 파일을 저장하며 원격에 분산하여 올리기 */
  async sync_save_file(info: FileInfo, _is_official: string, _target: string, _collection: string, _key_force = '') {
    try {
      if (info.blob.size)
        await this.indexed.saveBlobToUserPath(info.blob, info.path);
      let file_info = await this.global.req_file_info(info.path);
      info.partsize = Math.ceil((info['filesize'] || file_info.contents.length) / FILE_BINARY_LIMIT);
      delete info['blob'];
      await this.servers[_is_official][_target].client.writeStorageObjects(
        this.servers[_is_official][_target].session, [{
          collection: _collection,
          key: _key_force || info.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120),
          permission_read: 2,
          permission_write: 1,
          value: info,
        }]);
      // 여기서 전체 길이로 for문을 돌리고 매 회차마다 파트를 받아서 base64 변환 후 집어넣어야 함
      for (let i = 0; i < info.partsize; i++) {
        let part = this.global.req_file_part_base64(file_info, i, info.path);
        await this.servers[_is_official][_target].client.writeStorageObjects(
          this.servers[_is_official][_target].session, [{
            collection: _collection,
            key: _key_force ? `${_key_force}_${i}` : (info.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120) + `_${i}`),
            permission_read: 2,
            permission_write: 1,
            value: { data: part },
          }]);
      }
      this.indexed.removeFileFromUserPath(`${info.path}.history`);
    } catch (e) {
      console.log('SyncSaveFailed: ', e);
    }
  }

  /** 로컬에 있는 파일을 불러오기, 로컬에 없다면 원격에서 요청하여 생성 후 불러오기
   * @returns 파일의 blob
   */
  async sync_load_file(info: FileInfo, _is_official: string, _target: string, _collection: string, _userid = '', _key_force = '', show_noti = true) {
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
        let isSuccessful = true;
        for (let i = 0; i < info_json.partsize; i++) {
          try {
            let part = await this.servers[_is_official][_target].client.readStorageObjects(
              this.servers[_is_official][_target].session, {
              object_ids: [{
                collection: _collection,
                key: _key_force ? `${_key_force}_${i}` : (info_json.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120) + `_${i}`),
                user_id: _userid || this.servers[_is_official][_target].session.user_id,
              }],
            });
            this.global.save_file_part(info_json.path, i, part.objects[0].value['data']);
          } catch (e) {
            console.log('ReadStorage_From_channel: ', e);
            isSuccessful = false;
            this.p5toast.show({
              text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`,
            });
            break;
          }
        }
        if (isSuccessful) {
          if (info['url']) { // 링크
            info['thumbnail'] = info['url'];
          } else { // 서버에 업로드된 파일
            info['text'] = [this.lang.text['ChatRoom']['SavingFile']];
            if (show_noti)
              this.p5toast.show({
                text: `${this.lang.text['ChatRoom']['SavingFile']}: ${info_json.filename}`,
              });
            if (isPlatform == 'Android' || isPlatform == 'iOS')
              this.noti.noti.schedule({
                id: 8,
                title: `${this.lang.text['ContentViewer']['SavingFile']}: ${info_json.filename}`,
                progressBar: { indeterminate: true },
                sound: null,
                smallIcon: 'res://diychat',
                color: 'b0b0b0',
              });
            let GatheringInt8Array = [];
            let ByteSize = 0;
            await new Promise(async (done, err) => {
              for (let i = 0, j = info_json['partsize']; i < j; i++)
                try {
                  let part = await this.indexed.GetFileInfoFromDB(`${info_json.path}_part/${i}.part`);
                  ByteSize += part.contents.length;
                  GatheringInt8Array[i] = part;
                } catch (e) {
                  console.log('파일 병합하기 오류: ', e);
                  break;
                }
              try {
                let SaveForm: Int8Array = new Int8Array(ByteSize);
                let offset = 0;
                for (let i = 0, j = GatheringInt8Array.length; i < j; i++) {
                  SaveForm.set(GatheringInt8Array[i].contents, offset);
                  offset += GatheringInt8Array[i].contents.length;
                }
                await this.indexed.saveInt8ArrayToUserPath(SaveForm, info_json.path);
                for (let i = 0, j = info_json['partsize']; i < j; i++)
                  this.indexed.removeFileFromUserPath(`${info_json.path}_part/${i}.part`)
                await this.indexed.removeFileFromUserPath(`${info_json.path}_part`)
              } catch (e) {
                console.log('파일 최종 저장하기 오류: ', e);
                err();
              }
              done(undefined);
            });
            this.noti.ClearNoti(8);
            this.indexed.removeFileFromUserPath(`${info_json.path}.history`);
          }
        }
        return await this.indexed.loadBlobFromUserPath(info_json.path, info_json.type || '');
      } catch (e) {
        return null;
      }
    }
  }

  /** 로컬 파일을 삭제하며 원격 분산파일도 삭제하기 */
  async sync_remove_file(path: string, _is_official: string, _target: string, _collection: string, _userid: string = '', force_path = '') {
    try {
      await this.indexed.removeFileFromUserPath(path);
    } catch (e) { }
    try {
      let file_info = await this.servers[_is_official][_target].client.readStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: _collection,
          key: path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120),
          user_id: _userid || this.servers[_is_official][_target].session.user_id,
        }],
      });
      let info_json: FileInfo = file_info.objects[0].value;
      try {
        this.servers[_is_official][_target].client.rpc(
          this.servers[_is_official][_target].session,
          'remove_channel_file', {
          collection: _collection,
          key: (force_path || info_json.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120)) + '_',
        });
      } catch (e) { }
      await this.servers[_is_official][_target].client.deleteStorageObjects(
        this.servers[_is_official][_target].session, {
        object_ids: [{
          collection: _collection,
          key: force_path || info_json.path.replace(/:|\?|\/|\\|<|>|\.| |\(|\)|\-/g, '_').substring(0, 120),
        }],
      });
    } catch (e) {
      console.log('SyncRemoveFailed: ', e);
    }
  }

  async AddressToQRCodeAct(init: any, NeedReturn = false) {
    let json = [];
    if (init['open_profile']) // 프로필 화면 유도
      json.push({ type: 'open_profile' });
    if (init['tmp_user']) { // 임시 사용자 정보 기입, 첫 데이터로 반영
      let sep = init['tmp_user'][0].split(',');
      this.users.self['email'] = sep[0];
      this.users.self['password'] = sep[1];
      this.users.self['display_name'] = sep[2];
      this.users.self['online'] = true;
      this.save_self_profile();
    }
    if (init['server']) { // 그룹 서버 등록
      for (let i = 0, j = init['server'].length; i < j; i++) {
        let sep = init['server'][i].split(',');
        json.push({
          type: 'server',
          value: {
            name: sep[0] || 'No named server',
            target: sep[0] || 'No named server',
            address: sep[1] || '192.168.0.1',
            useSSL: sep[2] || false,
            port: sep[3] || 7350,
            key: sep[4] || 'defaultkey',
            isOfficial: 'unofficial',
          },
        });
      }
    }
    if (init['group']) { // 그룹 진입 추가
      for (let i = 0, j = init['group'].length; i < j; i++) {
        let sep = init['group'][i].split(',');
        json.push({
          type: 'group',
          name: sep[0],
          id: sep[1],
        });
      }
    }
    if (init['group_dedi']) { // 그룹 사설 채팅 진입, 1개만 받음
      if (window.location.protocol == 'http:') // 보안 연결이 아닐 때에만 동작
        json.push({
          type: 'group_dedi',
          value: {
            address: `ws://${init['group_dedi'][0]}`,
          },
        })
    }
    if (init['open_prv_channel']) {
      let sep = init['open_prv_channel'][0].split(',');
      json.push({
        type: 'open_prv_channel',
        user_id: sep[0],
        isOfficial: sep[1] || 'official',
        target: sep[2] || 'DevTestServer',
      });
    }
    if (init['open_channel']) {
      let sep = init['open_channel'][0].split(',');
      json.push({
        type: 'open_channel',
        group_id: sep[0],
        isOfficial: sep[1],
        target: sep[2],
      });
    }
    if (init['rtcserver']) {
      for (let i = 0, j = init['rtcserver'].length; i < j; i++) {
        let sep_array = init['rtcserver'][i].split(']');
        let array = sep_array[0].split('[')[1];
        let sep_user = sep_array[1].split(',');
        json.push({
          type: 'rtcserver',
          value: {
            urls: array.split(','),
            username: sep_user[1],
            credential: sep_user[2],
          },
        });
      }
    }
    if (init['voidDraw']) {
      for (let i = 0, j = init['voidDraw'].length; i < j; i++) {
        let sep_array = init['voidDraw'][i].split(']');
        let array = sep_array[0].split('[')[1];
        json.push({
          type: 'voidDraw',
          addresses: array.split(','),
        });
      }
    }
    if (NeedReturn) return json;
    else await this.act_from_QRInfo(json);
  }

  async act_from_QRInfo(json: any) {
    for (let i = 0, j = json.length; i < j; i++)
      switch (json[i].type) {
        case 'open_profile': // 프로필 페이지 열기 유도
          this.nav.navigateForward('portal/settings/group-server');
          break;
        case 'tmp_user': // 빠른 임시 진입을 위해 사용자 정보를 임의로 기입
          break;
        case 'server': // 그룹 서버 자동등록처리
          let hasAlreadyTargetKey = Boolean(this.statusBar.groupServer['unofficial'][json[i].value.name]);
          if (hasAlreadyTargetKey) {
            this.p5toast.show({
              text: `${this.lang.text['Nakama']['AlreadyHaveTargetName']}: ${json[i].value.name}`,
            });
            delete json[i].value.name;
            await this.modalCtrl.create({
              component: ServerDetailPage,
              componentProps: {
                data: json[i].value,
              },
            }).then(v => v.present());
          } else {
            let new_server_info: ServerInfo = {
              name: decodeURIComponent(json[i].value.name),
              target: decodeURIComponent(json[i].value.target),
              address: decodeURIComponent(json[i].value.address),
              port: json[i].value.port,
              useSSL: json[i].value.useSSL,
              isOfficial: json[i].value.isOfficial,
              key: decodeURIComponent(json[i].value.key),
            };
            await this.add_group_server(new_server_info);
            this.init_session(new_server_info);
          }
          break;
        case 'group_dedi': // 그룹사설 채팅 접근
          await this.modalCtrl.create({
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
          // 시작과 동시에 진입할 때 서버 연결 시간을 고려함
          if (this.AfterLoginActDone)
            await this.try_add_group(json[i]);
          else this.AfterLoginAct.push(async () => await this.try_add_group(json[i]));
          break;
        case 'open_prv_channel': // 1:1 대화 열기 (폰에서 넘어가기 보조용)
          if (this.AfterLoginActDone) {
            let c = await this.join_chat_with_modulation(json[i]['user_id'], 2, json[i]['isOfficial'], json[i]['target'], true);
            this.go_to_chatroom_without_admob_act(c);
          } else this.AfterLoginAct.push(async () => {
            let c = await this.join_chat_with_modulation(json[i]['user_id'], 2, json[i]['isOfficial'], json[i]['target'], true);
            this.go_to_chatroom_without_admob_act(c);
          });
          await this.AutoConnectServer();
          break;
        case 'open_channel': // 그룹 대화 열기 (폰에서 넘어가기 보조용)
          if (this.AfterLoginActDone) {
            let c = await this.join_chat_with_modulation(json[i]['group_id'], 3, json[i]['isOfficial'], json[i]['target'], true);
            this.go_to_chatroom_without_admob_act(c);
          } else this.AfterLoginAct.push(async () => {
            let c = await this.join_chat_with_modulation(json[i]['group_id'], 3, json[i]['isOfficial'], json[i]['target'], true);
            this.go_to_chatroom_without_admob_act(c);
          });
          await this.AutoConnectServer();
          break;
        case 'rtcserver':
          let ServerInfos = [];
          try {
            if (!this.lang.text['WebRTCDevManager']['NoRegServer']) // 번역 준비 검토
              throw '번역 준비 안됨';
            let list = await this.indexed.loadTextFromUserPath('servers/webrtc_server.json');
            ServerInfos = JSON.parse(list);
          } catch (e) { }
          ServerInfos.push(json[i].value);
          await this.indexed.saveTextFileToUserPath(JSON.stringify(ServerInfos), 'servers/webrtc_server.json');
          break;
        case 'voidDraw':
          if (this.AfterLoginActDone) {
            this.modalCtrl.create({
              component: VoidDrawPage,
              componentProps: {
                addresses: json[i]['addresses'],
              },
              cssClass: 'fullscreen',
            }).then(v => v.present());
          } else this.AfterLoginAct.push(async () => {
            this.modalCtrl.create({
              component: VoidDrawPage,
              componentProps: {
                addresses: json[i]['addresses'],
              },
              cssClass: 'fullscreen',
            }).then(v => v.present());
          });
          break;
        default: // 동작 미정 알림(debug)
          throw "지정된 틀 아님";
      }
  }
  /** 등록된 서버가 없다면 자동으로 테스트 서버에 연결 시도 */
  async AutoConnectServer() {
    let servers = this.get_all_server_info();
    if (!servers.length)
      await this.WatchAdsAndGetDevServerInfo(true);
  }

  /** 아이디 기반 게시물 불러오기  
  * @returns 정상적으로 불러와짐 여부 돌려줌
  */
  async load_local_post_with_id(id: string): Promise<boolean> {
    if (this.posts_orig.local.target.me[id])
      delete this.posts_orig.local.target.me[id];
    let v = await this.indexed.loadTextFromUserPath(`servers/local/target/posts/me/${id}/info.json`);
    try {
      let json = JSON.parse(v);
      json['server'] = {
        name: this.lang.text['AddGroup']['UseLocalStorage'],
        isOfficial: 'local',
        target: 'target',
        local: true,
      }
      if (json['mainImage']) {
        if (json['mainImage']['url']) {
          json['mainImage']['thumbnail'] = json['mainImage']['url'];
        } else { // URL 주소가 아니라면 이미지 직접 불러오기
          let blob = await this.indexed.loadBlobFromUserPath(json['mainImage']['path'], json['mainImage']['type']);
          json['mainImage']['blob'] = blob;
          let FileURL = URL.createObjectURL(blob);
          json['mainImage']['thumbnail'] = FileURL;
          setTimeout(() => {
            URL.revokeObjectURL(FileURL);
          }, 100);
        }
      }
      this.posts_orig.local.target.me[id] = json;
      return true;
    } catch (e) {
      return false;
    }
  }
}
