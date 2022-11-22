import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Channel, Client, Session, Socket } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';
import { IndexedDBService } from './indexed-db.service';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';
import * as p5 from 'p5';
import { LocalNotiService } from './local-noti.service';
import { ModalController } from '@ionic/angular';
import { GroupDetailPage } from './portal/settings/group-detail/group-detail.page';

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
          target: 'default'
        }
      }
    },
    'unofficial': {},
  };

  initialize() {
    this.uuid = this.device.uuid;
    this.load_channel_list();
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
  init_server(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _address = SOCKET_SERVER_ADDRESS, _key = 'defaultkey', _port = 7350, _useSSL = false) {
    if (!this.servers[_is_official][_target]) this.servers[_is_official][_target] = {};
    this.servers[_is_official][_target].client = new Client(_key, _address, _port.toString(), _useSSL);
  }

  /** 모든 pending 세션 켜기 */
  init_all_sessions(_CallBack = (v: boolean, _o: any, _t: any) => console.log('init_all_sessions: ', v)) {
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
        this.init_server(info.isOfficial as any, info.target, info.address, info.key);
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

  /** Nakama에서 들어왔던, 읽지 않은 알림들 */
  notifications = [];
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
   * @param _target 대상 key
   */
  async init_session(_CallBack = (_v: boolean, _o?: any, _t?: any) => console.warn('nakama.init_session.callback null: ', _v), _is_official: 'official' | 'unofficial' = 'official', _target = 'default', _useSSL = false) {
    try {
      if (!this.servers[_is_official][_target]) this.servers[_is_official][_target] = {};
      this.servers[_is_official][_target].session
        = await this.servers[_is_official][_target].client.authenticateEmail(localStorage.getItem('email'), this.uuid, false);
      this.get_group_list(_is_official, _target);
      this.set_group_statusBar('online', _is_official, _target);
      _CallBack(true);
      this.servers[_is_official][_target].socket = this.servers[_is_official][_target].client.createSocket(_useSSL);
      this.connect_to(_is_official, _target, () => this.redirect_channel(_is_official, _target));
      this.update_notifications(_is_official, _target);
    } catch (e) {
      switch (e.status) {
        case 400: // 비번이 없거나 하는 등, 요청이 잘못됨
          this.p5toast.show({
            text: '사용자를 연결한 후 사용하세요.',
          });
          _CallBack(false);
          this.set_group_statusBar('missing', _is_official, _target);
          break;
        case 401: // 비밀번호 잘못됨
          this.p5toast.show({
            text: '기기 재검증 이메일 발송 필요! (아직 개발되지 않음)',
          });
          _CallBack(false);
          this.set_group_statusBar('missing', _is_official, _target);
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
          this.indexed.loadTextFromUserPath('servers/self/profile.json', (e, v) => {
            if (e && v) {
              let profile = JSON.parse(v);
              this.servers[_is_official][_target].client.writeStorageObjects(
                this.servers[_is_official][_target].session, [{
                  collection: 'user_public',
                  key: 'profile_image',
                  permission_read: 2,
                  permission_write: 1,
                  value: { img: profile['img'] },
                }]
              );
            }
          })
          _CallBack(undefined, _is_official, _target);
          this.set_group_statusBar('online', _is_official, _target);
          break;
        default:
          this.p5toast.show({
            text: `준비되지 않은 오류 유형: ${e}`,
          });
          _CallBack(false);
          this.set_group_statusBar('missing', _is_official, _target);
          break;
      }
    }
  }

  /** 서버로부터 알림 업데이트하기 (알림 리스트 재정렬 포함됨) */
  update_notifications(_is_official: string, _target: string) {
    this.servers[_is_official][_target].client.listNotifications(this.servers[_is_official][_target].session, 3)
      .then(v => {
        this.noti_origin = {};
        for (let i = 0, j = v.notifications.length; i < j; i++) {
          let is_removed = false;
          v.notifications[i]['server'] = this.servers[_is_official][_target].info;
          switch (v.notifications[i].code) {
            case 0: // 예약된 메시지
              v.notifications[i]['request'] = `${v.notifications[i].code}-${v.notifications[i].subject}`;
              break;
            case -1: // 오프라인이거나 채널에 없을 때 알림 받음
              // 모든 채팅에 대한건지, 1:1에 한정인지 검토 필요
              console.log('채널에 없을 때 받은 메시지란..: ', v.notifications[i]);
              let targetType: number;
              if (v.notifications[i]['content'] && v.notifications[i]['content']['username'])
                targetType = 2;
              // 요청 타입을 구분하여 자동반응처리
              switch (targetType) {
                case 2:
                  this.servers[_is_official][_target].socket.joinChat(
                    v.notifications[i]['sender_id'], targetType, v.notifications[i]['persistent'], false,
                  ).then(c => {
                    c['redirect'] = {
                      id: v.notifications[i]['sender_id'],
                      type: targetType,
                      persistence: v.notifications[i]['persistent'],
                    };
                    this.add_channels(c, _is_official, _target);
                    this.servers[_is_official][_target].client.deleteNotifications(
                      this.servers[_is_official][_target].session, [v.notifications[i]['id']]).then(b => {
                        if (b) this.update_notifications(_is_official, _target);
                        else console.warn('알림 지우기 실패: ', b);
                      });
                  });
                  break;
                default:
                  console.warn('예상하지 못한 알림 행동처리: ', v, targetType);
                  v.notifications[i]['request'] = `${v.notifications[i].code}-${v.notifications[i].subject}`;
                  break;
              }
              break;
            case -2: // 친구 요청 받음
              v.notifications[i]['request'] = `${v.notifications[i].code}-${v.notifications[i].subject}`;
              break;
            case -3: // 상대방이 친구 요청 수락
              v.notifications[i]['request'] = `${v.notifications[i].code}-${v.notifications[i].subject}`;
              break;
            case -4: // 상대방이 그룹 참가 수락
              v.notifications[i]['request'] = `${v.notifications[i].code}-${v.notifications[i].subject}`;
              break;
            case -5: // 그룹 참가 요청 받음
              let group_info = this.groups[_is_official][_target][v.notifications[i].content['group_id']];
              if (group_info) {
                v.notifications[i]['request'] = `그룹참가 요청: ${group_info['name']}`;
              } else {
                is_removed = true;
                this.servers[_is_official][_target].client.deleteNotifications(
                  this.servers[_is_official][_target].session, [v.notifications[i].id]
                ).then(v => {
                  if (v) this.update_notifications(_is_official, _target);
                  else console.warn('알림 지우기 실패: ', v);
                });
              }
              break;
            case -6: // 친구가 다른 게임에 참여
              v.notifications[i]['request'] = `${v.notifications[i].code}-${v.notifications[i].subject}`;
              break;
            case -7: // 서버에서 단일 세션 연결 허용시 끊어진 것에 대해
              v.notifications[i]['request'] = `${v.notifications[i].code}-${v.notifications[i].subject}`;
              break;
            default:
              console.warn('준비되지 않은 요청 내용: ', v.notifications[i]);
              v.notifications[i]['request'] = `${v.notifications[i].code}-${v.notifications[i].subject}`;
              break;
          }
          if (is_removed) continue;
          if (!this.noti_origin[_is_official]) this.noti_origin[_is_official] = {};
          if (!this.noti_origin[_is_official][_target]) this.noti_origin[_is_official][_target] = {};
          this.noti_origin[_is_official][_target][v.notifications[i].id] = v.notifications[i];
        }
        this.rearrange_notifications();
      });
  }

  /** 그룹별 알림을 시간순으로 정렬함 */
  rearrange_notifications() {
    this.notifications.length = 0;
    let isOfficial = Object.keys(this.noti_origin);
    isOfficial.forEach(_is_official => {
      let Target = Object.keys(this.noti_origin[_is_official]);
      Target.forEach(_target => {
        let NotificationId = Object.keys(this.noti_origin[_is_official][_target]);
        NotificationId.forEach(_noti_id => {
          this.notifications.push(this.noti_origin[_is_official][_target][_noti_id]);
        });
      });
    });
    this.notifications.sort((a, b) => {
      if (a.create_time < b.create_time) return 1;
      if (a.create_time > b.create_time) return -1;
      return 0;
    });
  }

  /** 등록된 그룹 아이디들, 서버에 저장되어있고 동기화시켜야합니다
   * groups[isOfficial][target][group_id] = { ...info }
   */
  groups: any = {
    'official': {},
    'unofficial': {},
  }

  /** 등록된 채널들 관리  
   * channels_orig[isOfficial][target]***[group_id or null]***[channels] = [ ...info ]
   */
  channels_orig = {
    'official': {},
    'unofficial': {},
  };

  /** 리스트로 정리된 채널, 채널 자체는 channels_orig에 보관됩니다  
   */
  channels: any[] = [];

  /** 채널 추가 */
  add_channels(channel_info: Channel, _is_official: string, _target: string) {
    if (!this.channels_orig[_is_official][_target])
      this.channels_orig[_is_official][_target] = {};
    if (!this.channels_orig[_is_official][_target])
      this.channels_orig[_is_official][_target] = {};
    if (this.channels_orig[_is_official][_target][channel_info.id] === undefined)
      this.channels_orig[_is_official][_target][channel_info.id] = channel_info;
    this.rearrange_channels();
  }

  /** 채널 삭제 */
  remove_channels(channel_id: string, _is_official: string, _target: string) {
    console.log('채널 삭제하기: ', channel_id, _is_official, _target);
    this.rearrange_channels();
  }

  /** 채팅 기록 가져오기 */
  load_channel_list() {
    this.indexed.loadTextFromUserPath('servers/channels.json', (e, v) => {
      if (e && v) {
        this.channels_orig = JSON.parse(v);
        let isOfficial = Object.keys(this.channels_orig);
        for (let i = 0, j = isOfficial.length; i < j; i++) {
          let Target = Object.keys(this.channels_orig[isOfficial[i]]);
          for (let k = 0, l = Target.length; k < l; k++) {
            let channel_ids = Object.keys(this.channels_orig[isOfficial[i]][Target[k]]);
            for (let m = 0, n = channel_ids.length; m < n; i++)
              delete this.channels_orig[isOfficial[i]][Target[k]][channel_ids[m]]['status'];
          }
        }
        this.rearrange_channels();
      }
    });
  }

  /** 세션 재접속 시 기존 정보를 이용하여 채팅방에 다시 로그인함 */
  redirect_channel(_is_official: string, _target: string) {
    if (this.channels_orig[_is_official] && this.channels_orig[_is_official][_target]) {
      let channel_ids = Object.keys(this.channels_orig[_is_official][_target]);
      for (let k = 0, l = channel_ids.length; k < l; k++) {
        this.servers[_is_official][_target].socket.joinChat(
          this.channels_orig[_is_official][_target][channel_ids[k]]['redirect']['id'],
          this.channels_orig[_is_official][_target][channel_ids[k]]['redirect']['type'],
          this.channels_orig[_is_official][_target][channel_ids[k]]['redirect']['persistence'],
          false
        );
        this.servers[_is_official][_target].client.listChannelMessages(
          this.servers[_is_official][_target].session, channel_ids[k], 1, false)
          .then(v => {
            this.channels_orig[_is_official][_target][channel_ids[k]]['last_comment'] = v.messages[0].content['msg'];
          });
      }
      this.rearrange_channels();
    }
  }

  /** 채널 리스트 정리 */
  rearrange_channels() {
    let result = [];
    let isOfficial = Object.keys(this.channels_orig);
    for (let i = 0, j = isOfficial.length; i < j; i++) {
      let Targets = Object.keys(this.channels_orig[isOfficial[i]]);
      for (let k = 0, l = Targets.length; k < l; k++) {
        let ChannelIds = Object.keys(this.channels_orig[isOfficial[i]][Targets[k]]);
        for (let o = 0, p = ChannelIds.length; o < p; o++) {
          let channel_info = this.channels_orig[isOfficial[i]][Targets[k]][ChannelIds[o]];
          channel_info['info'] = {
            isOfficial: isOfficial[i],
            target: Targets[k],
          }
          result.push(channel_info);
        }
      }
    }
    this.channels = result;
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.channels_orig), 'servers/channels.json');
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
          if (v['canvas'].toDataURL().length > SIZE_LIMIT) {
            let rect_ratio = v.height / v.width * 1.05;
            let ratio = p.pow(SIZE_LIMIT / v['canvas'].toDataURL().length, rect_ratio);
            v.resize(v.width * ratio, v.height * ratio);
          }
          _CallBack(v);
          p.remove();
        }, _e => {
          this.p5toast.show({
            text: '유효한 이미지가 아닙니다.',
          });
          p.remove();
        });
      }
    });
  }

  /** 연결된 서버들에 그룹 진입 요청 시도 */
  try_add_group(_info: any) {
    let online_clients = this.get_all_server();
    for (let i = 0, j = online_clients.length; i < j; i++)
      online_clients[i].client.joinGroup(online_clients[i].session, _info.id)
        .then(_v => {
          if (!_v) {
            console.warn('그룹 join 실패... 벤 당했을 때인듯? 향후에 검토 필');
            return;
          }
          online_clients[i].client.listGroups(
            online_clients[i].session, _info['title']
          ).then(v => {
            for (let i = 0, j = v.groups.length; i < j; i++)
              if (v.groups[i].id == _info['id']) {
                online_clients[i].client.readStorageObjects(online_clients[i].session, {
                  object_ids: [{
                    collection: 'group_public',
                    key: `group_${v.groups[i].id}`,
                    user_id: v.groups[i].creator_id,
                  }]
                }).then(img => {
                  let pending_group = {
                    server: undefined,
                    id: v.groups[i].id,
                    name: v.groups[i].name,
                    description: v.groups[i].description,
                    max_count: v.groups[i].max_count,
                    lang_tag: v.groups[i].lang_tag,
                    open: v.groups[i].open,
                    creator_id: v.groups[i].creator_id,
                    status: 'pending',
                  }
                  if (img.objects.length)
                    pending_group['img'] = img.objects[0].value['img'];
                  this.save_group_list(pending_group, online_clients[i].info.isOfficial, online_clients[i].info.target);
                });
                break;
              }
          });
        });
  }

  /** 그룹 리스트 로컬에 저장하기 */
  save_group_list(_group: any, _is_official: string, _target: string, _CallBack = () => { }) {
    let _group_info = { ..._group };
    delete _group_info['server'];
    let group_img = _group['img'];
    delete _group_info['img'];
    if (!this.groups[_is_official][_target]) this.groups[_is_official][_target] = {};
    this.groups[_is_official][_target][_group_info.id] = _group_info;
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.groups), 'servers/groups.json');
    this.indexed.saveTextFileToUserPath(group_img, `servers/${_is_official}/${_target}/groups/${_group.id}.img`);
    if (_group.onwer == this.servers[_is_official][_target].session.user_id && _group.img)
      this.servers[_is_official][_target].client.writeStorageObjects(
        this.servers[_is_official][_target].session, [{
          collection: 'group_public',
          key: `group_${_group.id}`,
          value: { img: _group.img },
          permission_read: 2,
          permission_write: 1,
        }]
      );
    _CallBack();
  }

  /** 그룹 리스트 로컬/리모트에서 삭제하기 (방장일 경우) */
  remove_group_list(info: any, _is_official: string, _target: string) {
    // 내가 방장이면 해산처리
    if (info['creator_id'] == this.servers[_is_official][_target].session.user_id)
      this.servers[_is_official][_target].client.deleteGroup(
        this.servers[_is_official][_target].session, info['id'],
      ).then(v => {
        if (v) { // 서버에서 정상삭제하였을 때
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
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.groups), 'servers/groups.json');
    this.indexed.removeFileFromUserPath(`servers/${_is_official}/${_target}/groups/${info.id}.img`);
  }

  /** 자신이 참여한 그룹 리모트에서 가져오기 */
  get_group_list(_is_official: string, _target: string) {
    if (!this.groups[_is_official]) this.groups[_is_official] = {};
    if (!this.groups[_is_official][_target]) this.groups[_is_official][_target] = {};
    this.servers[_is_official][_target].client.listUserGroups(
      this.servers[_is_official][_target].session,
      this.servers[_is_official][_target].session.user_id)
      .then(v => {
        for (let i = 0, j = v.user_groups.length; i < j; i++) {
          this.groups[_is_official][_target][v.user_groups[i].group.id]
            = { ...this.groups[_is_official][_target][v.user_groups[i].group.id], ...v.user_groups[i].group };
        }
        this.indexed.saveTextFileToUserPath(JSON.stringify(this.groups), 'servers/groups.json');
      });
  }

  /** 그룹 서버 및 설정-그룹서버의 상태 조정 */
  set_group_statusBar(_status: 'offline' | 'missing' | 'pending' | 'online' | 'certified', _is_official: string, _target: string) {
    this.statusBar.groupServer[_is_official][_target] = _status;
    this.catch_group_server_header(_status);
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
          switch (v.code) {
            case 0: // 예약된 알림
              break;
            case -2: // 친구 요청 받음
              break;
            case -1: // 오프라인이거나 채널에 없을 때 알림 받음
              console.log('채널에 없을 때 받은 메시지란 ...: ', v);
              let targetType: number;
              if (v['content']['username'])
                targetType = 2;
              // 요청 타입을 구분하여 자동반응처리
              switch (targetType) {
                case 2:
                  socket.joinChat(
                    v['sender_id'], targetType, v['persistent'], false,
                  ).then(c => {
                    c['redirect'] = {
                      id: v['sender_id'],
                      type: targetType,
                      persistence: v['persistent'],
                    };
                    this.add_channels(c, _is_official, _target);
                    this.servers[_is_official][_target].client.deleteNotifications(
                      this.servers[_is_official][_target].session, [v['id']]).then(v => {
                        if (v) this.update_notifications(_is_official, _target);
                        else console.warn('알림 업데이트 실패: ', v);
                      });
                  });
                  break;
                default:
                  console.warn('예상하지 못한 알림 행동처리: ', v);
                  break;
              }
              break;
            case -3: // 상대방이 친구 요청 수락
            case -4: // 상대방이 그룹 참가 수락
              this.update_notifications(_is_official, _target);
              break;
            case -5: // 그룹 참가 요청 받음
              console.warn('안드로이드에서 테스트 필요');
              let group_detail = this.groups[_is_official][_target][v.content['group_id']];
              group_detail['server'] = this.servers[_is_official][_target].info;
              this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/groups/${group_detail['id']}.img`, (e, v) => {
                if (e && v) group_detail['img'] = v;
              });
              this.update_notifications(_is_official, _target);
              // 이미 보는 화면이라면 업데이트하기
              if (this.socket_reactive[v.code].info.id == v.content['group_id'])
                this.socket_reactive[v.code].ngOnInit();
              this.noti.SetListener(`check${v.code}`, (_v: any) => {
                if (this.socket_reactive[v.code]) return;
                this.noti.ClearNoti(_v['id']);
                this.noti.RemoveListener(`check${v.code}`);
                this.modalCtrl.create({
                  component: GroupDetailPage,
                  componentProps: { info: group_detail },
                }).then(v => v.present());
              });
              this.noti.PushLocal({
                id: v.code,
                title: `${group_detail['title']} 그룹에 참가 요청`,
                actions_ln: [{
                  id: `check${v.code}`,
                  title: '검토',
                }],
                icon: 'diychat',
                iconColor_ln: '271e38',
              }, undefined, (_ev: any) => {
                if (this.socket_reactive[v.code].info.id == v.content['group_id']) return;
                this.modalCtrl.create({
                  component: GroupDetailPage,
                  componentProps: { info: group_detail },
                }).then(v => v.present());
              });
              break;
            case -6: // 친구가 다른 게임에 참여
              break;
            case -7: // 서버에서 단일 세션 연결 허용시 끊어진 것에 대해
              break;
            default:
              console.warn('확인되지 않은 실시간 알림_nakama_noti: ', v);
              break;
          }
        }
        socket.onchannelpresence = (p) => {
          console.log('onchannelpresence: ', p);
          console.warn('다른 대화타입에서 검토 필요: 그룹, 룸');
          if (p.joins !== undefined) {
            console.warn('상대방 진입에 대한 검토 필요: 전체 중 몇명 들어왔는지');
            this.channels_orig[_is_official][_target][p.channel_id]['status'] = 'online';
          } else if (p.leaves !== undefined) {
            console.warn('상대방 떠남에 대한 검토 필요: 전체 중 몇명 빠졌는지');
            this.channels_orig[_is_official][_target][p.channel_id]['status'] = 'pending';
          }
        }
        socket.onchannelmessage = (c) => {
          console.log('onchamsg: ', c);
          this.channels_orig[_is_official][_target][c.channel_id]['last_comment'] = c.content['msg'];
          this.rearrange_channels();
        }
        socket.ondisconnect = (_e) => {
          this.p5toast.show({
            text: `그룹서버 연결 끊어짐: ${this.servers[_is_official][_target].info.name}`,
          });
          this.set_group_statusBar('missing', _is_official, _target);
        }
      });
  }
}
