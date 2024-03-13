// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonAccordionGroup, iosTransitionAnimation, LoadingController, ModalController, NavController } from '@ionic/angular';
import { isNativefier, isPlatform, SERVER_PATH_ROOT } from 'src/app/app.component';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { MinimalChatPage } from '../../minimal-chat/minimal-chat.page';
import { LocalNotiService } from '../../local-noti.service';
import { GlobalActService } from 'src/app/global-act.service';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WebrtcManageIoDevPage } from 'src/app/webrtc-manage-io-dev/webrtc-manage-io-dev.page';
import { QrSharePage } from './qr-share/qr-share.page';
import { LocalGroupServerService } from 'src/app/local-group-server.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit, OnDestroy {

  constructor(
    private modalCtrl: ModalController,
    private nav: NavController,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    public noti: LocalNotiService,
    private global: GlobalActService,
    private file: File,
    private p5toast: P5ToastService,
    private loadingCtrl: LoadingController,
    public server: LocalGroupServerService,
  ) { }
  /** 사설 서버 생성 가능 여부: 메뉴 disabled */
  cant_dedicated = false;
  can_use_http = false;
  is_nativefier = isNativefier;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.AD_Div = document.getElementById('advertise');
    this.checkAdsInfo();
    this.check_if_admin();
    this.nakama.on_socket_disconnected['settings_admin_check'] = () => {
      this.check_if_admin();
    }
    this.can_use_http = (window.location.protocol == 'http:') || isNativefier;
  }

  /** 관리자로 등록된 서버들 */
  as_admin = [];

  check_if_admin() {
    this.as_admin = this.nakama.get_all_server_info(true, true);
    for (let i = this.as_admin.length - 1; i >= 0; i--)
      if (!this.as_admin[i].is_admin)
        this.as_admin.splice(i, 1);
  }

  /** 최소한의 기능을 가진 채팅 서버 만들기 */
  start_minimalserver() {
    if (this.statusBar.dedicated.official['groupchat'] == 'offline') {
      this.statusBar.settings['dedicatedServer'] = 'pending';
      this.statusBar.dedicated.official['groupchat'] = 'pending';
      this.server.funcs.onStart = () => {
        this.statusBar.settings['dedicatedServer'] = 'online';
        this.statusBar.dedicated.official['groupchat'] = 'online';
        this.start_minimalchat('ws://127.0.0.1');
      }
      this.server.funcs.onFailed = () => {
        this.statusBar.settings['dedicatedServer'] = 'missing';
        this.statusBar.dedicated.official['groupchat'] = 'missing';
        setTimeout(() => {
          this.statusBar.settings['dedicatedServer'] = 'offline';
          this.statusBar.dedicated.official['groupchat'] = 'offline';
        }, 1500);
      }
      this.server.initialize();
    } else {
      this.start_minimalchat('ws://127.0.0.1');
    }
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

  FallbackServerAddress = '';
  @ViewChild('Devkit') Devkit: IonAccordionGroup;

  self = {};
  /** 프로필 썸네일 */
  profile_filter: string;
  ionViewWillEnter() {
    if (this.statusBar.settings['groupServer'] == 'online')
      this.profile_filter = "filter: grayscale(0) contrast(1);";
    else this.profile_filter = "filter: grayscale(.9) contrast(1.4);";
    this.check_if_admin();
    this.FallbackServerAddress = localStorage.getItem('fallback_fs');
    this.Fallback_FS_input_element = document.getElementById('fallback_fs_input').childNodes[0].childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
    this.Fallback_FS_input_element.onfocus = () => {
      delete this.global.p5key['KeyShortCut']['Digit'];
    }
    this.WillLeave = false;
    this.Fallback_FS_input_element.addEventListener('focusout', () => {
      if (!this.WillLeave)
        this.ionViewDidEnter();
    });
  }

  Fallback_FS_input_element: HTMLInputElement;
  /** 대안 파일 서버 주소 입력칸으로 포커싱 */
  focus_to_fallback_fs_input() {
    this.Devkit.value = 'Devkit';
    setTimeout(() => {
      this.Fallback_FS_input_element.focus();
    }, 50);
  }

  fallback_fs_input() {
    if (this.FallbackServerAddress) {
      localStorage.setItem('fallback_fs', this.FallbackServerAddress);
    } else localStorage.removeItem('fallback_fs')
  }

  LinkButton = [];
  ToggleAccordion() {
    if (this.Devkit.value) { // 닫기
      let count_menu = (!this.cant_dedicated && this.can_use_http) ? 5 : 4;
      this.LinkButton.splice(4, count_menu);
      this.Devkit.value = undefined;
    } else { // 열기
      this.Devkit.value = 'Devkit';
      this.LinkButton.splice(4, 0,
        () => this.go_to_page('weblink-gen'),
        () => this.focus_to_fallback_fs_input(),
        () => this.go_to_webrtc_manager()
      );
      if (!this.cant_dedicated && this.can_use_http) {
        this.LinkButton.splice(7, 0,
          () => this.start_minimalserver(),
          () => this.download_serverfile());
      } else this.LinkButton.splice(7, 0, () => this.download_serverfile());
    }
  }

  /** AddKeyShortcut() 으로 사용할 수 있음 */
  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.nav.pop();
    }
    this.LinkButton.length = 0;
    this.LinkButton.push(() => this.go_to_page('noti-alert'));
    this.LinkButton.push(() => this.go_to_qr_share());
    this.LinkButton.push(() => this.open_inapp_explorer());
    this.LinkButton.push(() => this.ToggleAccordion());
    if (this.Devkit.value) {
      this.LinkButton.push(() => this.go_to_page('weblink-gen'));
      this.LinkButton.push(() => this.focus_to_fallback_fs_input());
      this.LinkButton.push(() => this.go_to_webrtc_manager());
      if (!this.cant_dedicated && this.can_use_http)
        this.LinkButton.push(() => this.start_minimalserver());
      this.LinkButton.push(() => this.download_serverfile());
    }
    if (this.as_admin.length)
      this.LinkButton.push(() => this.go_to_page('admin-tools'));
    this.LinkButton.push(() => this.go_to_page('creator'));
    if (this.lang.lang != 'ko')
      this.LinkButton.push(() => this.go_to_page('translator'));
    this.LinkButton.push(() => this.LangClicked());
    this.LinkButton.push(() => this.go_to_page('licenses'));
    if (this.cant_dedicated)
      this.LinkButton.push(() => this.open_playstore());
    // 환경에 맞춰 단축키 구성
    this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
      // 설정 메뉴 정렬처리
      if (this.LinkButton[index])
        this.LinkButton[index]();
    }
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
      }).then(async v => {
        await v.present();
        this.lock_modal_open = false;
      });
    }
  }

  open_inapp_explorer() {
    this.nav.navigateForward('user-fs-dir', {
      animation: iosTransitionAnimation,
    });
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
    this.nav.navigateForward(`portal/settings/${_page}`, {
      animation: iosTransitionAnimation,
    });
  }

  async download_serverfile() {
    if (isPlatform == 'Android' || isPlatform == 'iOS') {
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      let filename = 'nakama.zip';
      let blob = await fetch('assets/data/nakama.zip').then(r => r.blob());
      try {
        await this.file.writeFile(this.file.externalDataDirectory, filename, blob);
        loading.dismiss();
        this.p5toast.show({
          text: this.lang.text['ContentViewer']['fileSaved'],
        });
      } catch (e) {
        console.log('download_serverfile: ', e);
        try {
          await this.file.writeExistingFile(this.file.externalDataDirectory, filename, blob);
          loading.dismiss();
          this.p5toast.show({
            text: this.lang.text['ContentViewer']['fileSaved'],
          });
        } catch (e) {
          console.log('download_serverfile_rewrite: ', e);
          loading.dismiss();
          this.p5toast.show({
            text: this.lang.text['ContentViewer']['fileSaveFailed'],
          });
        }
      }
    } else {
      let link = document.createElement("a");
      link.download = 'nakama.zip';
      link.href = 'assets/data/nakama.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      link.remove();
      this.p5toast.show({
        text: this.lang.text['ContentViewer']['fileSaved'],
      });
    }
  }

  go_to_qr_share() {
    this.modalCtrl.create({
      component: QrSharePage,
      componentProps: {
        NoReturn: true,
      }
    }).then(v => {
      this.RemoveKeyShortCut();
      v.onDidDismiss().then(() => {
        this.ionViewDidEnter();
      });
      v.present()
    });
  }

  go_to_webrtc_manager() {
    this.modalCtrl.create({
      component: WebrtcManageIoDevPage,
    }).then(v => {
      this.RemoveKeyShortCut();
      v.onDidDismiss().then(() => {
        this.ionViewDidEnter();
      });
      v.present()
    });
  }

  open_playstore() {
    window.open('https://play.google.com/store/apps/details?id=org.pjcone.portal', '_system');
  }

  RemoveKeyShortCut() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    delete this.global.p5key['KeyShortCut']['Digit'];
  }

  WillLeave = false;
  ionViewWillLeave() {
    this.WillLeave = true;
    this.RemoveKeyShortCut();
  }

  ngOnDestroy(): void {
    delete this.nakama.on_socket_disconnected['settings_admin_check'];
    clearTimeout(this.refreshAds);
  }
}
