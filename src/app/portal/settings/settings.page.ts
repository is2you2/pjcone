import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonAccordionGroup, iosTransitionAnimation, LoadingController, ModalController, NavController } from '@ionic/angular';
import { isNativefier, isPlatform } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { MinimalChatPage } from '../../minimal-chat/minimal-chat.page';
import { LocalNotiService } from '../../local-noti.service';
import { GlobalActService } from 'src/app/global-act.service';
import { WebrtcManageIoDevPage } from 'src/app/webrtc-manage-io-dev/webrtc-manage-io-dev.page';
import { LocalGroupServerService } from 'src/app/local-group-server.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit, OnDestroy {

  constructor(
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
    public lang: LanguageSettingService,
    public noti: LocalNotiService,
    private global: GlobalActService,
    public server: LocalGroupServerService,
  ) { }
  /** 사설 서버 생성 가능 여부: 메뉴 disabled */
  cant_dedicated = false;
  can_use_http = false;
  is_nativefier = isNativefier;

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.navCtrl.back();
    };
  }

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.check_if_admin();
    this.nakama.on_socket_disconnected['settings_admin_check'] = () => {
      this.check_if_admin();
    }
    this.can_use_http = (window.location.protocol == 'http:') || isNativefier;
  }

  /** 채널 리스트에서 해당 서버이름 보기 토글 */
  toggle_ShowServer() {
    if (this.nakama.showServer)
      localStorage.setItem('showServer', '1');
    else localStorage.removeItem('showServer');
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

  FallbackServerAddress = '';
  @ViewChild('Devkit') Devkit: IonAccordionGroup;

  self = {};
  /** 프로필 썸네일 */
  profile_filter: string;
  ionViewWillEnter() {
    this.InitBrowserBackButtonOverride();
    if (this.statusBar.settings['groupServer'] == 'online')
      this.profile_filter = "filter: grayscale(0) contrast(1);";
    else this.profile_filter = "filter: grayscale(.9) contrast(1.4);";
    this.check_if_admin();
    this.FallbackServerAddress = localStorage.getItem('fallback_fs');
    if (this.cant_dedicated) {
      this.Fallback_FS_input_element = document.getElementById('fallback_fs_input').childNodes[1].childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
      this.Fallback_FS_input_element.onfocus = () => {
        delete this.global.p5key['KeyShortCut']['Digit'];
      }
      this.WillLeave = false;
      this.Fallback_FS_input_element.addEventListener('focusout', () => {
        if (!this.WillLeave)
          this.ionViewDidEnter();
      });
    }
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
      this.LinkButton.splice(5, count_menu);
      this.Devkit.value = undefined;
    } else { // 열기
      this.Devkit.value = 'Devkit';
      if (this.cant_dedicated)
        this.LinkButton.splice(4, 0,
          () => this.go_to_page('weblink-gen'),
          () => this.focus_to_fallback_fs_input(),
          () => this.go_to_webrtc_manager()
        );
      else this.LinkButton.splice(4, 0,
        () => this.go_to_page('weblink-gen'),
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
      this.navCtrl.pop();
    }
    this.LinkButton.length = 0;
    this.LinkButton.push(() => this.go_to_page('noti-alert'));
    this.LinkButton.push(() => {
      this.nakama.showServer = !this.nakama.showServer;
      this.toggle_ShowServer()
    });
    this.LinkButton.push(() => this.open_inapp_explorer());
    this.LinkButton.push(() => this.ToggleAccordion());
    if (this.Devkit.value) {
      this.LinkButton.push(() => this.go_to_page('weblink-gen'));
      if (this.cant_dedicated)
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
      if (this.statusBar.settings['dedicated_groupchat'] != 'online'
        && this.statusBar.settings['dedicated_groupchat'] != 'certified')
        this.statusBar.settings['dedicated_groupchat'] = 'pending';
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
    this.navCtrl.navigateForward('user-fs-dir', {
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
    this.navCtrl.navigateForward(`portal/settings/${_page}`, {
      animation: iosTransitionAnimation,
    });
  }

  async download_serverfile() {
    if (this.lang.lang == 'ko')
      window.open('https://is2you2.github.io/posts/how-to-use-pjcone-server/', '_system');
    else window.open('https://is2you2.github.io/posts/how-to-use-pjcone-server-en/', '_system');
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
  }
}
