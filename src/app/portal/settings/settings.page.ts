// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { Group } from '@heroiclabs/nakama-js';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { isPlatform, SERVER_PATH_ROOT } from 'src/app/app.component';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { WscService } from 'src/app/wsc.service';
import { MinimalChatPage } from '../../minimal-chat/minimal-chat.page';
import { GroupDetailPage } from './group-detail/group-detail.page';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
    private nav: NavController,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
    private indexed: IndexedDBService,
    public client: WscService,
    private bgmode: BackgroundMode,
    public lang: LanguageSettingService,
  ) { }
  /** 사설 서버 생성 가능 여부: 메뉴 disabled */
  cant_dedicated = false;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
      if (e && v) this.nakama.users.self['img'] = v.replace(/"|=|\\/g, '');
    });
    this.isBatteryOptimizationsShowed = Boolean(localStorage.getItem('ShowDisableBatteryOptimizations'));
    this.AD_Div = document.getElementById('advertise');
    this.checkAdsInfo();
  }

  /** 광고 정보 불러오기 */
  async checkAdsInfo() {
    try {
      let res = await fetch(`${SERVER_PATH_ROOT}pjcone_ads/${this.lang.lang}.txt`);
      if (res.ok) {
        let text = await (await res.blob()).text();
        this.indexed.saveTextFileToUserPath(text, 'ads_list.txt');
        let lines: string[] = text.split('\n');
        this.listAvailableAds(lines);
      } else throw new Error("없는거나 다름없지");
    } catch (e) { // 로컬 정보 기반으로 광고
      this.indexed.loadTextFromUserPath('ads_list.txt', (e, v) => {
        if (e && v) this.listAvailableAds(v.split('\n'));
      });
    }
  }

  /** 사용가능한 광고 리스트 추리기 */
  availables = [];
  /** 광고 판넬 구성하기 */
  listAvailableAds(lines: string[]) {
    let currentTime = new Date().getTime();
    // 양식: 시작시간,끝시간,사이트주소
    this.availables.length = 0;
    let NotYet: number;
    for (let i = 0, j = lines.length; i < j; i++) {
      let sep = lines[i].split(',');
      if (Number(sep[0]) < currentTime) {
        if (currentTime < Number(sep[1]))
          this.availables.push([Number(sep[0]), Number(sep[1]), sep[2]]);
      } else { // 아직 도래하지 않은 광고리스트
        if (!NotYet) NotYet = Number(sep[0]);
        else if (Number(sep[0]) < NotYet)
          NotYet = Number(sep[0]);
      }
    }
    let children = this.AD_Div.childNodes;
    this.isAdHiding = true;
    children.forEach(child => {
      child.remove();
    });
    if (this.availables.length)
      this.displayRandomAds();
    else if (NotYet) {
      this.refreshAds = setTimeout(() => {
        this.indexed.loadTextFromUserPath('ads_list.txt', (e, v) => {
          if (e && v) this.listAvailableAds(v.split('\n'));
        });
      }, NotYet - new Date().getTime());
    }
  }

  /** 광고 게시 여부 */
  isAdHiding = true;
  /** 새로고침 관리 */
  refreshAds: any;
  AD_Div: HTMLElement;
  displayRandomAds() {
    let randomIndex = Math.floor(Math.random() * this.availables.length);
    let currentAd = this.availables[randomIndex];
    this.refreshAds = setTimeout(() => {
      this.indexed.loadTextFromUserPath('ads_list.txt', (e, v) => {
        if (e && v) this.listAvailableAds(v.split('\n'));
      });
    }, currentAd[1] - new Date().getTime());
    let AdFrame = document.createElement('iframe');
    AdFrame.id = 'AdFrame';
    AdFrame.setAttribute("src", currentAd[2]);
    AdFrame.setAttribute("frameborder", "0");
    AdFrame.setAttribute('class', 'full_screen');
    this.isAdHiding = false;
    this.AD_Div.appendChild(AdFrame);
  }

  /** 웹 사이트 주소 열기 */
  open_link(_link: string) {
    window.open(_link, '_system')
  }

  isBatteryOptimizationsShowed = false;
  setDisableBatteryOptimizations() {
    this.bgmode.disableBatteryOptimizations();
    this.isBatteryOptimizationsShowed = true;
    localStorage.setItem('ShowDisableBatteryOptimizations', 'true');
  }

  /** 표시되는 그룹 리스트 */
  groups: Group[] = [];
  self = {};
  /** 프로필 썸네일 */
  profile_filter: string;
  ionViewWillEnter() {
    this.nakama.socket_reactive['settings'] = this;
    if (this.nakama.users.self['online'])
      this.profile_filter = "filter: grayscale(0) contrast(1);";
    else this.profile_filter = "filter: grayscale(.9) contrast(1.4);";
    this.load_groups();
  }
  /** 저장된 그룹 업데이트하여 반영 */
  load_groups() {
    let tmp_groups = this.nakama.rearrange_group_list();
    tmp_groups.forEach(async group => {
      let _is_official = group['server']['isOfficial'];
      let _target = group['server']['target'];
      // 온라인이라면 서버정보로 덮어쓰기
      if (this.statusBar.groupServer[_is_official][_target] == 'online') {
        if (this.nakama.groups[_is_official][_target][group.id]['status'] != 'missing')
          await this.nakama.servers[_is_official][_target].client.listGroupUsers(
            this.nakama.servers[_is_official][_target].session, group['id']
          ).then(v => { // 삭제된 그룹 여부 검토
            if (!v.group_users.length) { // 그룹 비활성중
              this.nakama.groups[_is_official][_target][group.id]['status'] = 'missing';
              this.nakama.channels_orig[_is_official][_target][group['channel_id']]['status'] = 'missing';
              this.nakama.save_channels_with_less_info();
            } else { // 그룹 활성중
              let am_i_lost = true;
              for (let i = 0, j = v.group_users.length; i < j; i++)
                if (v.group_users[i].user.id == this.nakama.servers[_is_official][_target].session.user_id) {
                  switch (v.group_users[i].state) {
                    case 0: // superadmin
                    case 1: // admin
                    case 2: // member
                      this.nakama.groups[_is_official][_target][group.id]['status'] = 'online';
                      break;
                    case 3: // request
                      this.nakama.groups[_is_official][_target][group.id]['status'] = 'pending';
                      break;
                    default:
                      console.warn('이해할 수 없는 코드 반환: ', v.group_users[i].state);
                      this.nakama.groups[_is_official][_target][group.id]['status'] = 'missing';
                      break;
                  }
                  am_i_lost = false;
                  v.group_users[i]['is_me'] = true;
                  break;
                }
              if (am_i_lost) { // 그룹은 있으나 구성원은 아님
                this.nakama.groups[_is_official][_target][group.id]['status'] = 'missing';
                if (group['channel_id']) // 그룹 수락이 안되어있는 경우
                  this.nakama.channels_orig[_is_official][_target][group['channel_id']]['status'] = 'missing';
                this.nakama.save_channels_with_less_info();
              }
            }
            if (v.group_users.length)
              group['users'] = v.group_users;
            v.group_users.forEach(async User => {
              if (User['is_me'])
                User['user'] = this.nakama.users.self;
              else {
                if (this.nakama.load_other_user(User['user'].id, _is_official, _target)['avatar_url'] != User['user'].avatar_url
                  || !this.nakama.load_other_user(User['user'].id, _is_official, _target)['img'])
                  await this.nakama.servers[_is_official][_target].client.readStorageObjects(
                    this.nakama.servers[_is_official][_target].session, {
                    object_ids: [{
                      collection: 'user_public',
                      key: 'profile_image',
                      user_id: User['user']['id'],
                    }],
                  }).then(v => {
                    if (v.objects.length)
                      User['user']['img'] = v.objects[0].value['img'];
                    this.nakama.save_other_user(User['user'], _is_official, _target);
                  });
                else this.nakama.save_other_user(User['user'], _is_official, _target);
              }
            });
            this.nakama.save_groups_with_less_info();
          });
      }
    });
    this.groups = tmp_groups;
  }
  /** 채팅방 이중진입 방지용 */
  will_enter = false;
  /** 사설 서버 주소, 없으면 공식서버 랜덤채팅 */
  chat_address: string;
  /** 페이지 이동 제한 (중복 행동 방지용) */
  lock_modal_open = false;
  /** 최소한의 기능을 가진 채팅 시작하기 */
  start_minimalchat(_address?: string) {
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      if (this.will_enter) return;
      if (this.statusBar.settings[_address ? 'dedicated_groupchat' : 'community_ranchat'] != 'online'
        && this.statusBar.settings[_address ? 'dedicated_groupchat' : 'community_ranchat'] != 'certified')
        this.statusBar.settings[_address ? 'dedicated_groupchat' : 'community_ranchat'] = 'pending';
      this.will_enter = true;
      setTimeout(() => {
        this.will_enter = false;
      }, 500);
      this.modalCtrl.create({
        component: MinimalChatPage,
        componentProps: {
          address: _address,
          name: this.nakama.users.self['display_name'],
        },
      }).then(v => {
        v.present();
        this.lock_modal_open = false;
      });
    }
  }

  /** 만들어진 그룹을 관리 */
  go_to_group_detail(i: number) {
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      delete this.nakama.socket_reactive['settings'];
      this.modalCtrl.create({
        component: GroupDetailPage,
        componentProps: {
          info: this.groups[i],
        },
      }).then(v => {
        v.onWillDismiss().then(() => {
          this.nakama.socket_reactive['settings'] = this;
          this.load_groups();
        });
        v.present();
        this.lock_modal_open = false;
      });
    }
  }

  @ViewChild('LangSel') LangSel: any;
  LangClicked() {
    this.LangSel.open();
  }
  /** 언어 변경됨 */
  LanguageChanged(ev: any) {
    this.lang.lang = ev.detail.value;
    this.lang.load_selected_lang();
  }

  go_to_page(_page: string) {
    this.nav.navigateForward(`settings/${_page}`, {
      animation: iosTransitionAnimation,
    })
  }

  ionViewWillLeave() {
    delete this.nakama.socket_reactive['settings'];
  }

  go_back() {
    let AllUsers = this.nakama.rearrange_all_user();
    AllUsers.forEach(user => {
      delete user['img'];
    });
    let channels = this.nakama.rearrange_channels();
    channels.forEach(channel => {
      if (channel['redirect']['type'] == 2)
        this.indexed.loadTextFromUserPath(`servers/${channel['server']['isOfficial']}/${channel['server']['target']}/users/${channel['redirect']['id']}/profile.img`, (e, v) => {
          if (e && v) this.nakama.load_other_user(channel['redirect']['id'], channel['server']['isOfficial'], channel['server']['target'])['img'] = v.replace(/"|=|\\/g, '');
        });
    });
    delete this.nakama.users.self['img'];
    clearTimeout(this.refreshAds);
  }
}
