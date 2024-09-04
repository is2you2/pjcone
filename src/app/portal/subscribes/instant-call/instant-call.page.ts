import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { IonSelect, NavController } from '@ionic/angular';
import * as p5 from 'p5';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
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
    public global: GlobalActService,
    public lang: LanguageSettingService,
    public webrtc: WebrtcService,
    private title: Title,
    private nakama: NakamaService,
    private router: Router,
    private route: ActivatedRoute,
    private p5toast: P5ToastService,
    private navCtrl: NavController,
  ) { }

  QRCodeAsString: string;
  p5canvas: p5;
  ServerList: any;
  /** WebRTC 대상 포트 */
  Port: number;
  /** WebRTC 사용자 정보 */
  Username: string;
  Password: string;
  /** 웹소켓 서버 채널 ID */
  ChannelId: string;
  InstantCallWSClient: WebSocket;
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
        this.LinkToServer(true);
      }
    });
  }

  UserInputCustomAddress = '';
  NeedInputCustomAddress = false;
  /** 웹소켓 서버에 연결한 후 다른 사용자를 기다림 */
  WaitingConnect = false;

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
    let sep_protocol = this.UserInputCustomAddress.split('://');
    let address_only = sep_protocol.pop();
    let protocol = sep_protocol.pop();
    if (!protocol) protocol = this.global.checkProtocolFromAddress(address_only) ? 'wss' : 'ws';
    this.InstantCallWSClient = new WebSocket(`${protocol}://${address_only}:12013`);
    /** 웹소켓에서 사용하는 내 아이디 기억 */
    let uuid: string;
    this.InstantCallWSClient.onopen = async () => {
      this.WaitingConnect = true;
      this.p5toast.show({
        text: this.lang.text['InstantCall']['Waiting'],
      });
      if (this.ChannelId) { // 준비된 채널로 진입
        this.InstantCallWSClient.send(JSON.stringify({
          type: 'join',
          channel: this.ChannelId,
        }));
        await new Promise((done) => setTimeout(done, 40));
        this.webrtc.initialize('audio')
          .then(() => {
            this.webrtc.HangUpCallBack = () => {
              this.InstantCallWSClient.close();
            }
            this.ShowWaiting();
            this.webrtc.CreateOffer();
            this.InstantCallWSClient.send(JSON.stringify({
              type: 'init_req',
            }));
          });
      } else // 새 채널 생성하기
        this.InstantCallWSClient.send(JSON.stringify({
          type: 'init',
        }));
    }
    this.InstantCallWSClient.onmessage = (ev: any) => {
      let json = JSON.parse(ev['data']);
      /** 서버측에서 나의 uuid 검토하여 받기 */
      // 내가 보낸 하울링 메시지 무시
      if (uuid === undefined) {
        uuid = json['uid'];
      } else if (uuid == json['uid']) return;
      switch (json.type) {
        case 'leave':
          this.InstantCallWSClient.close();
          break;
        // 채널 아이디 생성 후 수신
        case 'init_id':
          this.InstantCallWSClient.send(JSON.stringify({
            type: 'join',
            channel: json.id,
          }));
          this.ChannelId = json.id;
          this.QRCodeAsString = `${SERVER_PATH_ROOT}?instc=${this.UserInputCustomAddress},${this.ChannelId},${this.Port || ''},${this.Username || ''},${this.Password || ''}`;
          break;
        case 'init_req':
          this.webrtc.initialize('audio')
            .then(async () => {
              this.webrtc.HangUpCallBack = () => {
                if (this.InstantCallWSClient) this.InstantCallWSClient.close();
              }
              this.ShowWaiting();
              this.webrtc.CreateOffer();
              await new Promise((done) => setTimeout(done, 40));
              this.InstantCallWSClient.send(JSON.stringify({
                type: 'socket_react',
                channel: this.ChannelId,
                act: 'WEBRTC_INIT_REQ_SIGNAL',
              }));
            });
          break;
        case 'socket_react': // nakama.socket_react
          switch (json['act']) {
            case 'WEBRTC_REPLY_INIT_SIGNAL':
              this.nakama.socket_reactive[json['act']](json['data_str']);
              if (json['data_str'] == 'EOL')
                this.webrtc.CreateAnswer({
                  client: this.InstantCallWSClient,
                  channel: this.ChannelId,
                });
              break;
            case 'WEBRTC_ICE_CANDIDATES':
              this.nakama.socket_reactive[json['act']](json['data_str'], {
                client: this.InstantCallWSClient,
                channel: this.ChannelId,
              });
              this.InstantCallWSClient.send(JSON.stringify({
                type: 'init_end',
                channel: this.ChannelId,
              }));
              if (this.p5canvas) this.p5canvas['InitEnd']();
              break;
            case 'WEBRTC_INIT_REQ_SIGNAL':
              this.nakama.socket_reactive[json['act']]({
                client: this.InstantCallWSClient,
                channel: this.ChannelId,
              });
              break;
            case 'WEBRTC_RECEIVE_ANSWER':
              this.nakama.socket_reactive[json['act']](json['data_str'], {
                client: this.InstantCallWSClient,
                channel: this.ChannelId,
              });
              break;
          }
          break;
        case 'init_end':
          if (this.p5canvas) this.p5canvas['InitEnd']();
          break;
      }
    }
    this.InstantCallWSClient.onerror = (e: any) => {
      console.error('즉석 통화 웹소켓 오류: ', e);
      this.InstantCallWSClient.close();
    }
    this.InstantCallWSClient.onclose = () => {
      this.p5toast.show({
        text: this.lang.text['InstantCall']['CallEnd'],
      });
      this.WaitingConnect = false;
      this.InstantCallWSClient.onopen = null;
      this.InstantCallWSClient.onclose = null;
      this.InstantCallWSClient.onmessage = null;
      this.InstantCallWSClient.onerror = null;
      this.InstantCallWSClient = undefined;
      this.webrtc.close_webrtc(false);
      if (!this.PageOut) this.navCtrl.pop();
    }
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_qr_address(target_string = this.QRCodeAsString) {
    this.global.WriteValueToClipboard('text/plain', target_string);
  }

  /** 웹소켓 서버에 연결된 경우 배경에 연결중임을 표현 */
  ShowWaiting() {
    this.QRCodeAsString = undefined;
    if (this.p5canvas) return;
    this.p5canvas = new p5((p: p5) => {
      let canvasDiv = document.getElementById('InstantCallCanvasDiv');
      p.setup = () => {
        p['InitEnd'] = () => {
          console.log('p5 사라지기 애니메이션');
          p.remove();
        }
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

  /** 이미 페이지를 벗어났다면 통화종료시 페이지 이전을 행동하지 않음 */
  PageOut = false;
  ionViewWillEnter() {
    this.PageOut = false;
    if (this.p5canvas) this.p5canvas.windowResized();
    this.global.StoreShortCutAct('instant-call');
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    };
  }

  ionViewWillLeave() {
    this.PageOut = true;
    delete this.global.p5key['KeyShortCut']['Escape'];
    this.global.RestoreShortCutAct('instant-call');
  }

  ngOnDestroy(): void {
    if (this.p5canvas) this.p5canvas.remove();
    if (this.InstantCallWSClient) this.InstantCallWSClient.close();
    this.route.queryParams['unsubscribe']();
  }
}
