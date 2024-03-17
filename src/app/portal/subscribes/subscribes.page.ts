// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { ModalController, NavController } from '@ionic/angular';
import { SERVER_PATH_ROOT, isPlatform } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { AddGroupPage } from '../settings/add-group/add-group.page';
import { QRelsePage } from './qrelse/qrelse.page';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { AdMob, AdMobBannerSize, BannerAdOptions, BannerAdPluginEvents, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private nav: NavController,
    private indexed: IndexedDBService,
  ) { }

  ngOnInit() {
    this.add_admob_banner();
    this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
      if (e && v) this.nakama.users.self['img'] = v.replace(/"|=|\\/g, '');
    });
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
      } else throw "광고가 없는 것으로 단정합니다";
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
    children.forEach(child => {
      child.remove();
    });
    if (this.availables.length)
      this.displayRandomAds();
    else if (NotYet) {
      this.refreshAds = setTimeout(() => {
        this.checkAdsInfo();
      }, NotYet - new Date().getTime());
    }
  }

  /** 광고 게시 여부 */
  isAdHiding = true;
  refreshAds: any;
  AD_Div: HTMLElement;
  displayRandomAds() {
    this.isAdHiding = true;
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

  async add_admob_banner() {
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      this.nakama.appMargin = size.height;
      const app: HTMLElement = document.querySelector('ion-router-outlet');

      if (this.nakama.appMargin === 0)
        app.style.marginBottom = '';
      else if (this.nakama.appMargin > 0)
        app.style.marginBottom = this.nakama.appMargin + 'px';
    });
    const options: BannerAdOptions = {
      adId: 'ca-app-pub-6577630868247944/4829889344',
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
    };
    /** 광고 정보 불러오기 */
    try { // 파일이 있으면 보여주고, 없다면 보여주지 않음
      this.nakama.isBannerShowing = false;
      let res = await fetch(`${SERVER_PATH_ROOT}pjcone_ads/admob.txt`);
      if (!res.ok) throw "준비된 광고가 없습니다";
      AdMob.showBanner(options).then(() => {
        this.nakama.isBannerShowing = true;
      });
    } catch (e) { // 로컬 정보 기반으로 광고
      console.log(e);
    }
  }

  cant_dedicated = false;

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.AddShortcut();
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Backquote'] = () => {
        this.go_to_page('group-server');
      }
      this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
        if (this.nakama.channels.length > index)
          this.go_to_chatroom(this.nakama.channels[index]);
        else this.add_new_group();
      };
    }
    if (this.global.p5key && this.global.p5key['KeyShortCut']
      && !this.global.p5key['KeyShortCut']['AddAct'])
      this.global.p5key['KeyShortCut']['AddAct'] = () => {
        this.add_new_group();
      };
  }

  ionViewWillEnter() {
    this.AD_Div = document.getElementById('advertise');
    this.checkAdsInfo();
  }

  ionViewDidEnter() {
    this.nakama.subscribe_lock = true;
    this.nakama.resumeBanner();
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.try_add_shortcut();
  }

  go_to_page(_page: string) {
    this.nav.navigateForward(`portal/settings/${_page}`);
    this.nakama.removeBanner();
  }

  EventListenerAct = (ev: any) => {
    ev.detail.register(110, (processNextHandler: any) => {
      processNextHandler();
      this.StopScan();
      document.removeEventListener('ionBackButton', this.EventListenerAct);
    });
  }

  StartScan = false;
  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  async scanQRCode() {
    let perm = await BarcodeScanner.checkPermission({ force: true });
    const complete = '온전한 동작 후 종료';
    document.addEventListener('ionBackButton', this.EventListenerAct);
    try {
      if (!perm.granted || this.StartScan) throw '시작 불가상태';
      this.StartScan = true;
      document.querySelector('body').classList.add('scanner-active');
      await BarcodeScanner.hideBackground();
      const result = await BarcodeScanner.startScan();
      if (result.hasContent) {
        try { // 양식에 맞게 끝까지 동작한다면 우리 데이터가 맞다main
          if (result.content.trim().indexOf(`${SERVER_PATH_ROOT}pjcone_pwa/?`) != 0)
            throw '주소 시작이 다름';
          await this.nakama.AddressToQRCodeAct(this.global.CatchGETs(result.content.trim()));
        } catch (e) { // 양식에 맞춰 행동할 수 없다면 모르는 데이터다
          this.modalCtrl.create({
            component: QRelsePage,
            componentProps: { result: result },
          }).then(v => v.present());
        }
      }
      throw complete;
    } catch (e) {
      if (e != complete)
        this.p5toast.show({
          text: this.lang.text['Subscribes']['CameraPermissionDenied'],
        });
      this.StopScan();
    }
    document.removeEventListener('ionBackButton', this.EventListenerAct);
  }

  StopScan() {
    this.StartScan = false;
    document.querySelector('body').classList.remove('scanner-active');
    BarcodeScanner.showBackground();
    BarcodeScanner.stopScan();
  }

  lock_chatroom = false;
  /** 채팅방으로 이동하기 */
  go_to_chatroom(info: any) {
    if (!this.lock_chatroom) {
      this.lock_chatroom = true;
      this.nakama.go_to_chatroom_without_admob_act(info);
      if (info['status'] != 'online' || info['status'] != 'pending')
        delete info['is_new'];
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

  /** 새 그룹 추가하기 */
  add_new_group() {
    this.modalCtrl.create({
      component: AddGroupPage,
    }).then(v => {
      let cache_func = this.global.p5key['KeyShortCut'];
      this.global.p5key['KeyShortCut'] = {};
      v.onDidDismiss().then(() => {
        this.global.p5key['KeyShortCut'] = cache_func;
        this.try_add_shortcut();
      });
      v.present();
    });
  }

  ionViewWillLeave() {
    this.nakama.subscribe_lock = false;
    delete this.global.p5key['KeyShortCut']['Backquote'];
    delete this.global.p5key['KeyShortCut']['Digit'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
    this.StopScan();
  }
}
