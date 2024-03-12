// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { iosTransitionAnimation, LoadingController, ModalController, NavController } from '@ionic/angular';
import { isNativefier, isPlatform, SERVER_PATH_ROOT } from 'src/app/app.component';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { LocalNotiService } from '../../local-noti.service';
import { GlobalActService } from 'src/app/global-act.service';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WebrtcManageIoDevPage } from 'src/app/webrtc-manage-io-dev/webrtc-manage-io-dev.page';
import { QrSharePage } from './qr-share/qr-share.page';

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
  ) { }
  /** 사설 서버 생성 가능 여부: 메뉴 disabled */
  cant_dedicated = false;
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

  self = {};
  /** 프로필 썸네일 */
  profile_filter: string;
  ionViewWillEnter() {
    if (this.statusBar.settings['groupServer'] == 'online')
      this.profile_filter = "filter: grayscale(0) contrast(1);";
    else this.profile_filter = "filter: grayscale(.9) contrast(1.4);";
    this.check_if_admin();
  }
  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.nav.pop();
    }
    let LinkButton = [];
    LinkButton.push(() => this.go_to_page('noti-alert'));
    LinkButton.push(() => this.go_to_qr_share());
    LinkButton.push(() => this.open_inapp_explorer());
    LinkButton.push(() => this.go_to_page('weblink-gen'));
    LinkButton.push(() => this.go_to_webrtc_manager());
    LinkButton.push(() => this.download_serverfile());
    if (this.as_admin.length)
      LinkButton.push(() => this.go_to_page('admin-tools'));
    LinkButton.push(() => this.go_to_page('creator'));
    if (this.lang.lang != 'ko')
      LinkButton.push(() => this.go_to_page('translator'));
    LinkButton.push(() => this.LangClicked());
    LinkButton.push(() => this.go_to_page('licenses'));
    if (this.cant_dedicated)
      LinkButton.push(() => this.open_playstore());
    // 환경에 맞춰 단축키 구성
    this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
      // 설정 메뉴 정렬처리
      if (LinkButton[index])
        LinkButton[index]();
    }
  }

  /** 채팅방 이중진입 방지용 */
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
      delete this.global.p5key['KeyShortCut']['Escape'];
      delete this.global.p5key['KeyShortCut']['Digit'];
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
      delete this.global.p5key['KeyShortCut']['Escape'];
      delete this.global.p5key['KeyShortCut']['Digit'];
      v.onDidDismiss().then(() => {
        this.ionViewDidEnter();
      });
      v.present()
    });
  }

  open_playstore() {
    window.open('https://play.google.com/store/apps/details?id=org.pjcone.portal', '_system');
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    delete this.global.p5key['KeyShortCut']['Digit'];
  }

  ngOnDestroy(): void {
    delete this.nakama.on_socket_disconnected['settings_admin_check'];
    clearTimeout(this.refreshAds);
  }
}
