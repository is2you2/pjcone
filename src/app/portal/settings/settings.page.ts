// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { isPlatform, SERVER_PATH_ROOT } from 'src/app/app.component';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { MinimalChatPage } from '../../minimal-chat/minimal-chat.page';
import { LocalNotiService } from '../../local-noti.service';
import { UserFsDirPage } from 'src/app/user-fs-dir/user-fs-dir.page';
import { AddTodoMenuPage } from '../main/add-todo-menu/add-todo-menu.page';
import { GlobalActService } from 'src/app/global-act.service';

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
    private bgmode: BackgroundMode,
    public lang: LanguageSettingService,
    public noti: LocalNotiService,
    private app: GlobalActService,
  ) { }
  /** 사설 서버 생성 가능 여부: 메뉴 disabled */
  cant_dedicated = false;

  EventListenerAct = (ev: any) => {
    ev.detail.register(10, (processNextHandler) => {
      this.go_back();
      processNextHandler();
    });
  }

  ngOnInit() {
    this.nakama.removeBanner();
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
      if (e && v) this.nakama.users.self['img'] = v.replace(/"|=|\\/g, '');
    });
    this.isBatteryOptimizationsShowed = Boolean(localStorage.getItem('ShowDisableBatteryOptimizations'));
    this.AD_Div = document.getElementById('advertise');
    this.checkAdsInfo();
    this.check_if_admin();
    this.nakama.on_socket_disconnected['settings_admin_check'] = () => {
      this.check_if_admin();
    }
  }

  /** 관리자로 등록된 서버들 */
  as_admin = [];

  check_if_admin() {
    this.as_admin = this.nakama.get_all_server_info(true, true);
    for (let i = this.as_admin.length - 1; i >= 0; i--)
      if (!this.as_admin[i].is_admin)
        this.as_admin.splice(i, 1);
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
      } else "광고가 없는 것으로 단정합니다";
    } catch (e) { // 로컬 정보 기반으로 광고
      console.log(e);
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

  self = {};
  /** 프로필 썸네일 */
  profile_filter: string;
  ionViewWillEnter() {
    if (this.nakama.users.self['online'])
      this.profile_filter = "filter: grayscale(0) contrast(1);";
    else this.profile_filter = "filter: grayscale(.9) contrast(1.4);";
    document.addEventListener('ionBackButton', this.EventListenerAct);
    this.check_if_admin();
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

  open_inapp_explorer() {
    this.modalCtrl.create({
      component: UserFsDirPage,
    }).then(v => v.present());
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
    });
  }

  ionViewWillLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
  }

  go_back() {
    delete this.nakama.users.self['img'];
    delete this.nakama.on_socket_disconnected['settings_admin_check'];
    clearTimeout(this.refreshAds);
    this.app.CreateGodotIFrame('godot-todo', {
      local_url: 'assets/data/godot/todo.pck',
      title: 'Todo',
      add_todo_menu: (_data: string) => {
        this.modalCtrl.create({
          component: AddTodoMenuPage,
          componentProps: {
            godot: this.app.godot_window,
            data: _data,
          },
        }).then(v => v.present());
      }
    });
  }
}
