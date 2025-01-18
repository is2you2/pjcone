import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { IonModal } from '@ionic/angular/common';
import { P5LoadingService } from 'src/app/p5-loading.service';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    public lang: LanguageSettingService,
    public global: GlobalActService,
    private navCtrl: NavController,
    private indexed: IndexedDBService,
    private alertCtrl: AlertController,
    private p5loading: P5LoadingService,
  ) { }

  SubscribesScrollDiv: HTMLElement;
  ngOnInit() {
    this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
      if (e && v) this.nakama.users.self['img'] = v.replace(/"|=|\\/g, '');
    });
    this.global.PortalBottonTabAct.Subscribes = () => {
      if (this.SubscribesScrollDiv)
        this.SubscribesScrollDiv.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  try_add_shortcut() {
    if (this.global.p5KeyShortCut)
      this.AddShortcut();
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 단축키 생성 */
  AddShortcut() {
    this.global.p5KeyShortCut['Backquote'] = () => {
      this.nakama.open_profile_page();
    }
    this.global.p5KeyShortCut['Digit'] = (index: number) => {
      if (this.nakama.channels.length > index)
        this.go_to_chatroom(this.nakama.channels[index]);
      else this.nakama.add_new_group();
    };
    if (!this.global.p5KeyShortCut['AddAct'])
      this.global.p5KeyShortCut['AddAct'] = () => {
        this.nakama.add_new_group();
      };
  }


  /** 1:1 대화 QR링크 제공페이지 */
  @ViewChild('PersonalChat') PersonalChat: IonModal;
  servers: ServerInfo[] = [];
  isExpanded = false;
  index = 0;
  QRCodeSRC: any;
  InvitationAddress: string;
  user_id: string;
  /** 1:1 대화 QR링크 제공 페이지 열기 */
  OpenOneByOneLink() {
    this.servers = this.nakama.get_all_server_info(true, true);
    if (this.servers.length) {
      this.PersonalChat.present();
      this.select_server(0);
    }
    return false;
  }
  select_server(i: number) {
    this.user_id = this.nakama.servers[this.servers[i].isOfficial][this.servers[i].target].session.user_id;
    let address = `${this.nakama.servers[this.servers[i].isOfficial][this.servers[i].target].info.useSSL ? 'https://' : 'http://'}${this.nakama.servers[this.servers[i].isOfficial][this.servers[i].target].info.address}:${this.nakama.servers[this.servers[i].isOfficial][this.servers[i].target].info.nakama_port || 7350}`;
    this.isExpanded = false;
    this.nakama.GenerateQRCode(this.nakama.servers[this.servers[i].isOfficial][this.servers[i].target].info)
      .then(result => {
        this.InvitationAddress = result;
        this.InvitationAddress += `&open_prv_channel=${this.user_id},${address}`.replace(/ /g, '%20');
        this.QRCodeSRC = this.global.readasQRCodeFromString(this.InvitationAddress);
      });
    let userColor = `${(this.user_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6)}`;
    const r = parseInt(userColor.slice(0, 2), 16);
    const g = parseInt(userColor.slice(2, 4), 16);
    const b = parseInt(userColor.slice(4, 6), 16);
    let color = `${r},${g},${b}`;
    setTimeout(() => {
      document.getElementById('SelfColorBg').style.backgroundImage = `linear-gradient(to top, rgba(${color}, .5), rgba(${color}, 0))`;
    }, 0);
  }

  copy_info(target: string) {
    this.global.WriteValueToClipboard('text/plain', target);
  }

  /** 채널 우클릭 행동 */
  ChannelContextMenu(channel: any) {
    let isOfficial = channel['server'].isOfficial;
    let target = channel['server'].target;
    let targetHeader = channel['title'];
    if (channel['redirect'].type == 2) // 1:1 대화인 경우
      targetHeader = targetHeader || this.lang.text['Profile']['noname_user'];
    else targetHeader = targetHeader || this.lang.text['ChatRoom']['noname_chatroom'];
    switch (channel['redirect'].type) {
      case 3: // 그룹 채널
        if (channel['status'] == 'online' || channel['status'] == 'pending') {
          this.global.ActLikeModal('group-detail', {
            info: this.nakama.groups[isOfficial][target][channel['group_id']],
            server: { isOfficial: isOfficial, target: target },
          });
          break;
        } // 온라인 그룹이 아니라면 1:1 채널과 같게 처리
      case 2: // 1:1 채널
        // 온라인 상태의 1:1 채널이라면
        this.alertCtrl.create({ // 손상 처리된 채널이라면 (그룹, 1:1이 같은 처리를 따름)
          header: targetHeader,
          message: this.lang.text['ChatRoom']['RemoveChannelLogs'],
          buttons: [{
            text: this.lang.text['ChatRoom']['Delete'],
            handler: () => {
              const handerAct = async () => {
                const actId = `subscribes_remove_1:1_${Date.now()}`;
                this.p5loading.update({
                  id: actId,
                });
                let info: any;
                try {
                  info = this.nakama.servers[isOfficial][target].info;
                } catch (e) {
                  // 만약 실패한다면, 삭제된 서버여서 그럴 가능성이 높다
                  console.log('삭제된 서버의 채널 삭제: ', e);
                }
                try {
                  await this.nakama.remove_group_list(this.nakama.groups[isOfficial][target][channel['group_id']], isOfficial, target, true);
                } catch (e) { }
                delete this.nakama.channels_orig[isOfficial][target][channel.id];
                try {
                  await this.nakama.remove_channel_files(isOfficial, target, channel.id, undefined, actId);
                } catch (e) { }
                // 로컬 채널이라고 가정하고 일단 타겟 키를 만듦
                let target_key = `${channel.id}_${this.nakama.users.self['display_name']}`;
                try { // 원격 채널일 경우를 대비해 타겟 키를 바꿔치기 시도
                  target_key = `${channel['info'].id}_${info.session.user_id}`;
                } catch (e) { }
                // 만약 1:1 채널이라면 타겟 조정함
                if (channel.id?.indexOf('4.') == 0)
                  target_key = `${channel['user_id_one'] != this.nakama.servers[isOfficial][target].session.user_id ? channel['user_id_one'] : channel['user_id_two']}_${this.nakama.servers[isOfficial][target].session.user_id}`;
                // 해당 채널과 관련된 파일 일괄 삭제 (cdn / ffs)
                try { // FFS 요청 우선
                  let fallback = localStorage.getItem('fallback_fs');
                  if (!fallback) throw '사용자 지정 서버 없음';
                  let split_fullAddress = fallback.split('://');
                  let address = split_fullAddress.pop().split(':');
                  let protocol = split_fullAddress.pop();
                  if (protocol) {
                    protocol += ':';
                  } else protocol = this.global.checkProtocolFromAddress(address[0]) ? 'https:' : 'http:';
                  let target_address = `${protocol}//${address[0]}:${address[1] || 9002}/`;
                  if (address)
                    await this.global.remove_files_from_storage_with_key(target_address, target_key, {});
                } catch (e) { }
                try { // cdn 삭제 요청, 로컬 채널은 주소 만들다가 알아서 튕김
                  let protocol = info.useSSL ? 'https:' : 'http:';
                  let address = info.address;
                  let target_address = `${[protocol]}//${address}:${info.apache_port || 9002}/`;
                  if (address) {
                    await this.global.remove_files_from_storage_with_key(target_address, target_key,
                      { apache_port: info.apache_port, cdn_port: info.cdn_port });
                  }
                } catch (e) { }
                let list = await this.indexed.GetFileListFromDB(`servers/${isOfficial}/${target}/channels/${channel.id}`);
                for (let i = 0, j = list.length; i < j; i++) {
                  this.p5loading.update({
                    id: actId,
                    message: `${this.lang.text['UserFsDir']['DeleteFile']}: ${targetHeader} (${list[i].split('/').pop()})`,
                    progress: i / j,
                  });
                  try {
                    await this.indexed.removeFileFromUserPath(list[i]);
                  } catch (e) { }
                }
                this.p5loading.remove(actId);
                this.nakama.rearrange_channels();
              }
              handerAct();
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
            handler: () => {
              const handlerAct = async () => {
                const actId = `subscribes_remove_local_${Date.now()}`;
                this.p5loading.update({
                  id: actId,
                });
                delete this.nakama.channels_orig[isOfficial][target][channel.id];
                try { // 그룹 이미지 삭제
                  await this.indexed.removeFileFromUserPath(`servers/${isOfficial}/${target}/groups/${channel.id}.img`);
                } catch (e) {
                  console.log('그룹 이미지 삭제 오류: ', e);
                }
                this.nakama.save_groups_with_less_info();
                // 해당 채널과 관련된 파일 일괄 삭제 (cdn)
                try { // FFS 요청 우선
                  const fallback = localStorage.getItem('fallback_fs');
                  if (!fallback) throw '사용자 지정 서버 없음';
                  const split_fullAddress = fallback.split('://');
                  const address = split_fullAddress.pop().split(':');
                  let protocol = split_fullAddress.pop();
                  if (protocol) {
                    protocol += ':';
                  } else protocol = this.global.checkProtocolFromAddress(address[0]) ? 'https:' : 'http:';
                  let target_address = `${protocol}//${address[0]}:${address[1] || 9002}/`;
                  // 로컬 채널이라고 가정하고 일단 타겟 키를 만듦
                  let target_key = `${channel.id}_${this.nakama.users.self['display_name']}`;
                  try { // 원격 채널일 경우를 대비해 타겟 키를 바꿔치기 시도
                    target_key = `${channel['info'].id}_${this.nakama.servers[isOfficial][target].session.user_id}`
                  } catch (e) { }
                  if (address[0])
                    await this.global.remove_files_from_storage_with_key(target_address, target_key, {});
                } catch (e) { }
                let list = await this.indexed.GetFileListFromDB(`servers/${isOfficial}/${target}/channels/${channel.id}`);
                for (let i = 0, j = list.length; i < j; i++) {
                  this.p5loading.update({
                    id: actId,
                    message: `${this.lang.text['UserFsDir']['DeleteFile']}: ${targetHeader} (${list[i].split('/').pop()})`,
                    progress: i / j,
                  });
                  await this.indexed.removeFileFromUserPath(list[i]);
                }
                this.p5loading.remove(actId);
                this.nakama.rearrange_channels();
              }
              handlerAct();
            },
            cssClass: 'redfont',
          }]
        }).then(v => v.present());
        break;
    }
    return false;
  }

  ionViewDidEnter() {
    if (!this.SubscribesScrollDiv)
      this.SubscribesScrollDiv = document.getElementById('SubscribesScrollDiv');
    this.nakama.subscribe_lock = true;
    this.try_add_shortcut();
  }

  go_to_page(_page: string) {
    this.global.RemoveAllModals(() => {
      this.navCtrl.navigateForward(`portal/settings/${_page}`);
    });
  }

  lock_chatroom = false;
  /** 채팅방으로 이동하기 */
  go_to_chatroom(info: any) {
    if (!this.lock_chatroom) {
      this.lock_chatroom = true;
      this.nakama.go_to_chatroom(info);
      this.lock_chatroom = false;
    }
  }

  /** Nakama 서버 알림 읽기 */
  check_notifications(i: number) {
    let server_info = this.nakama.notifications_rearrange[i]['server'];
    let _is_official = server_info['isOfficial'];
    let _target = server_info['target'];
    this.nakama.check_notifications(this.nakama.notifications_rearrange[i], _is_official, _target);
  }

  ionViewWillLeave() {
    this.nakama.subscribe_lock = false;
    delete this.global.p5KeyShortCut['Backquote'];
    delete this.global.p5KeyShortCut['Digit'];
    delete this.global.p5KeyShortCut['AddAct'];
  }
}
