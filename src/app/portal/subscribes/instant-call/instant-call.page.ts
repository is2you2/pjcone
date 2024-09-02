import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { IonSelect, NavController } from '@ionic/angular';
import * as p5 from 'p5';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WebrtcService } from 'src/app/webrtc.service';

@Component({
  selector: 'app-instant-call',
  templateUrl: './instant-call.page.html',
  styleUrls: ['./instant-call.page.scss'],
})
export class InstantCallPage implements OnInit, OnDestroy {

  constructor(
    private global: GlobalActService,
    public lang: LanguageSettingService,
    public webrtc: WebrtcService,
    private title: Title,
    private nakama: NakamaService,
    private router: Router,
    private route: ActivatedRoute,
    private p5toast: P5ToastService,
    private navCtrl: NavController,
  ) { }

  QRCode: any;
  p5canvas: p5;
  ServerList: any;
  /** WebRTC 대상 포트 */
  Port: number;
  /** WebRTC 사용자 정보 */
  Username: string;
  Password: string;
  /** 웹소켓 서버 채널 ID */
  ChannelId: string;
  @ViewChild('InstantCallServer') InstantCallServer: IonSelect;
  ngOnInit() {
    this.ServerList = this.nakama.get_all_online_server();
    setTimeout(() => {
      if (this.InstantCallServer) {
        this.InstantCallServer.value = this.ServerList[0] || 'local';
        this.SelectAddressTarget({ detail: { value: this.InstantCallServer.value } });
      } else this.NeedInputCustomAddress = true;
    }, 0);
    this.route.queryParams.subscribe(_p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      if (navParams) {
        this.UserInputCustomAddress = navParams.address;
        this.ChannelId = navParams.channel;
        this.Port = navParams.port;
        this.Username = navParams.username;
        this.Password = navParams.password;
        // this.LinkToServer(true);
      }
    });
  }

  UserInputCustomAddress = '';
  NeedInputCustomAddress = false;

  /** 연결 대상 선택 */
  SelectAddressTarget(ev: any) {
    this.title.setTitle(this.lang.text['InstantCall']['Title']);
    switch (ev.detail.value) {
      case 'local':
        this.UserInputCustomAddress = '';
        this.NeedInputCustomAddress = true;
        break;
      default: // 다른 원격 서버
        let info = ev.detail.value.info;
        this.UserInputCustomAddress = info.address;
        this.NeedInputCustomAddress = false;
        break;
    }
  }

  /** 웹 소켓 서버에 연결하기
   * @param [autoLink=false] 빠른 진입으로 실행되는지 여부
   */
  LinkToServer(autoLink = false) {
    if (autoLink && !this.ChannelId) {
      this.p5toast.show({
        text: '번역필요: 연결 정보가 누락되었습니다.',
      });
      this.navCtrl.pop();
      return;
    }
    this.Port = this.Port || 3478;
    this.Username = this.Username || 'username';
    this.Password = this.Password || 'password';
    console.log('위 정보로 서버에 연결: ', this.UserInputCustomAddress, '/', this.ChannelId);
  }

  /** 웹소켓 서버에 연결된 경우 배경에 연결중임을 표현 */
  ShowWaiting() {
    this.p5canvas = new p5((p: p5) => {
      let canvasDiv = document.getElementById('InstantCallCanvasDiv');
      p.setup = () => {
        p.pixelDensity(1);
        let canvas = p.createCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
        canvas.parent(canvasDiv);
      }
      p.draw = () => {
        p.clear();
        p.ellipse(50, 50, 50, 50);
      }
      p.windowResized = () => {
        p.resizeCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
      }
    });
  }

  ionViewWillEnter() {
    if (this.p5canvas) this.p5canvas.windowResized();
    this.global.StoreShortCutAct('instant-call');
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    };
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    this.global.RestoreShortCutAct('instant-call');
  }

  ngOnDestroy(): void {
    if (this.p5canvas) this.p5canvas.remove();
    this.webrtc.close_webrtc(false);
    this.route.queryParams['unsubscribe']();
  }
}
