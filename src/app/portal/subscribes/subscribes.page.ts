import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { Channel, Notification } from '@heroiclabs/nakama-js';
import { ModalController } from '@ionic/angular';
import { isPlatform, SERVER_PATH_ROOT } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { ToolServerService, UnivToolForm } from 'src/app/tool-server.service';
import { WeblinkService } from 'src/app/weblink.service';
import { WscService } from 'src/app/wsc.service';
import { ChatRoomPage } from './chat-room/chat-room.page';
import { QRelsePage } from './qrelse/qrelse.page';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition, BannerAdPluginEvents, AdMobBannerSize } from '@capacitor-community/admob';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
    private codescan: BarcodeScanner,
    private p5toast: P5ToastService,
    private tools: ToolServerService,
    private weblink: WeblinkService,
    private nakama: NakamaService,
    public statusBar: StatusManageService,
    private wsc: WscService,
    public lang: LanguageSettingService,
  ) { }

  HEADER = 'subscribes';

  cant_scan = false;
  notifications: Notification[] = [];

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_scan = true;
    this.notifications = this.nakama.rearrange_notifications();
    this.nakama.after_notifications_rearrange[this.HEADER] = (list: Notification[]) => {
      this.notifications = list;
    }
    this.add_admob_banner();
  }

  ionViewDidEnter() {
    this.resumeBanner();
  }

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

  isBannerShowing = false;
  appMargin: number;
  async add_admob_banner() {
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      this.appMargin = size.height;
      const app: HTMLElement = document.querySelector('ion-router-outlet');

      if (this.appMargin === 0)
        app.style.marginBottom = '';
      else if (this.appMargin > 0)
        app.style.marginBottom = this.appMargin + 'px';
    });
    const options: BannerAdOptions = {
      adId: 'ca-app-pub-6577630868247944/4829889344',
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
    };
    /** 광고 정보 불러오기 */
    try {
      let res = await fetch(`${SERVER_PATH_ROOT}pjcone_ads/admob.txt`);
      let text = await (await res.blob()).text();
      if (text.indexOf('<html>') < 0) {
      } else throw new Error("없는거나 다름없지");
    } catch (e) { // 로컬 정보 기반으로 광고
      AdMob.showBanner(options).then(() => {
        this.isBannerShowing = true;
      });
    }
  }

  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  scanQRCode() {
    this.codescan.scan({
      disableSuccessBeep: true,
      disableAnimations: true,
      resultDisplayDuration: 0,
    }).then(v => {
      if (!v.cancelled) {
        try { // 양식에 맞게 끝까지 동작한다면 우리 데이터가 맞다
          let json: any[] = JSON.parse(v.text);
          if (this.wsc.client.readyState != this.wsc.client.OPEN) {
            this.p5toast.show({
              text: this.lang.text['Subscribes']['needLinkWithCommServ'],
            });
            return;
          }
          for (let i = 0, j = json.length; i < j; i++)
            switch (json[i].type) {
              case 'link': // 계정 연결처리
                this.weblink.initialize({
                  pid: json[i].value,
                  uuid: this.nakama.uuid,
                });
                break;
              case 'tools': // 도구모음, 단일 대상 서버 생성 액션시
                this.create_tool_server(json[i].value);
                break;
              case 'server': // 그룹 서버 자동등록처리
                this.nakama.add_group_server(json[i].value);
                break;
              case 'group': // 서버 및 그룹 자동 등록처리
                this.nakama.try_add_group(json[i]);
                break;
              default: // 동작 미정 알림(debug)
                throw new Error("지정된 틀 아님");
            }
        } catch (_e) { // 양식에 맞춰 행동할 수 없다면 모르는 데이터다
          console.error('scanQRCode_failed: ', _e);
          this.modalCtrl.create({
            component: QRelsePage,
            componentProps: { result: v },
          }).then(v => v.present());
        }
      }
    }).catch(_e => {
      console.error(_e);
      this.p5toast.show({
        text: this.lang.text['Subscribes']['CameraPermissionDenied'],
        lateable: true,
      });
    });
  }

  /** 도구모음 서버 만들기 */
  create_tool_server(data: UnivToolForm) {
    let PORT: number;
    /** 메시지 받기 행동 구성 */
    let onMessage = (_json: any) => console.warn(`${data.name}_create_tool_server_onMessage: ${_json}`);
    switch (data.name) {
      case 'engineppt':
        PORT = 12021;
        onMessage = (json: any) => {
          console.log('engineppt init test: ', json);
        };
        break;
      default:
        throw new Error(`지정된 툴 정보가 아님: ${data}`);
    }
    this.tools.initialize(data.name, PORT, () => {
      this.tools.check_addresses(data.name, (v: any) => {
        let keys = Object.keys(v);
        let local_addresses = [];
        for (let i = 0, j = keys.length; i < j; i++)
          local_addresses = [...local_addresses, ...v[keys[i]]['ipv4Addresses']];
        this.weblink.initialize({
          from: 'mobile',
          pid: data.client,
          addresses: local_addresses,
        });
      });
    }, onMessage);
  }

  /** 채팅방으로 이동하기 */
  go_to_chatroom(info: any) {
    this.modalCtrl.create({
      component: ChatRoomPage,
      componentProps: {
        info: info,
      },
    }).then(v => {
      this.removeBanner();
      v.onWillDismiss().then(() => {
        this.resumeBanner();
      });
      v.present()
    });
  }

  /** Nakama 서버 알림 읽기 */
  check_notifications(i: number) {
    let server_info = this.notifications[i]['server'];
    let _is_official = server_info['isOfficial'];
    let _target = server_info['target'];
    this.nakama.check_notifications(this.notifications[i], _is_official, _target);
  }

  ionViewWillLeave() {
    delete this.nakama.after_notifications_rearrange[this.HEADER];
    this.removeBanner();
  }
}
