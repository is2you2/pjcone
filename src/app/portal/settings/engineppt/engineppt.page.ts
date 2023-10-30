import { Component, OnInit } from '@angular/core';
import { isNativefier, isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { ToolServerService } from 'src/app/tool-server.service';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { LoadingController, NavController } from '@ionic/angular';
import { StatusManageService } from 'src/app/status-manage.service';
import { LocalNotiService } from 'src/app/local-noti.service';
import { WebrtcService } from 'src/app/webrtc.service';

@Component({
  selector: 'app-engineppt',
  templateUrl: './engineppt.page.html',
  styleUrls: ['./engineppt.page.scss'],
})
export class EnginepptPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private toolServer: ToolServerService,
    private indexed: IndexedDBService,
    private p5toast: P5ToastService,
    private loadingCtrl: LoadingController,
    public statusBar: StatusManageService,
    private navCtrl: NavController,
    private noti: LocalNotiService,
    private webrtc: WebrtcService,
  ) { }

  EventListenerAct = (ev: any) => {
    ev.detail.register(150, () => { });
  }

  ToggleHeader = true;
  Status = 'initialize';
  RemoteDesc: string;
  InputAddress = '';
  /** PWA: 컨트롤러로 연결할 주소 */
  LinkedAddress = '';
  isSSLConnect = false;

  ngOnInit() {
    this.engine_ppt_file_sel = `engine_ppt_file_sel_${new Date().getTime()}`;
    this.engine_ppt_mobile_sel = `engine_ppt_mobile_sel_${new Date().getTime()}`;
    this.isSSLConnect = (window.location.protocol == 'https:') && !isNativefier;
  }

  ionViewWillEnter() {
    this.prerequisite_check();
  }

  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  /** 선행과제 진행, 플랫폼에 따른 시작 UI */
  prerequisite_check() {
    this.load_info_text();
    // 모바일 앱인 경우 리모콘 환경설정 유도
    if (isPlatform == 'Android' || isPlatform == 'iOS') {
      this.Status = 'initApp';
      this.StartRemoteContrServer();
    } else { // 웹인 경우 리모콘 연결 유도
      this.Status = 'initPWA';
      if (isPlatform == 'DesktopPWA')
        setTimeout(() => {
          this.CreateDrop();
        }, 50);
    }
  }

  p5canvas: p5;
  CreateDrop() {
    let parent = document.getElementById('p5Drop');
    this.p5canvas = new p5((p: p5) => {
      p.setup = () => {
        let canvas = p.createCanvas(parent.clientWidth, parent.clientHeight);
        p.pixelDensity(1);
        canvas.parent(parent);
        canvas.drop(async (file: any) => {
          this.StartPresentation(file.name, file.file);
        });
      }
      p.mouseMoved = (ev: any) => {
        if (ev['dataTransfer']) {
          parent.style.pointerEvents = 'all';
          parent.style.backgroundColor = '#0008';
        } else {
          parent.style.pointerEvents = 'none';
          parent.style.backgroundColor = 'transparent';
        }
      }
    });
  }

  engine_ppt_file_sel = '';
  buttonClickLinkInputFile() {
    document.getElementById(this.engine_ppt_file_sel).click();
  }
  async inputpckselected(ev: any) {
    this.StartPresentation(ev.target.files[0].name, ev.target.files[0]);
  }

  async StartPresentation(filename: string, blob: Blob) {
    let file_ext = filename.substring(filename.lastIndexOf('.') + 1);
    if (file_ext != 'pck') {
      this.p5toast.show({
        text: this.lang.text['EngineWorksPPT']['FileExtPck'],
      });
      return;
    }
    await this.indexed.saveBlobToUserPath(blob, 'engineppt/presentation_this.pck', undefined, this.indexed.godotDB);
    this.CreateEnginePPT();
  }

  CreateEnginePPT() {
    this.ToggleHeader = false; // 전체화면하기 좋도록 헤더 삭제
    this.Status = 'OnPresentation';
    if (this.p5canvas)
      this.p5canvas.remove();
    setTimeout(() => {
      if (this.TempWs && this.TempWs.readyState == this.TempWs.OPEN)
        this.TempWs.close();
      this.global.CreateGodotIFrame('engineppt', {
        local_url: 'assets/data/godot/engineppt.pck',
        title: 'EnginePPT',
        remoteAddr: this.LinkedAddress,
        p5toast: (msg: string) => {
          this.p5toast.show({
            text: msg,
          });
        },
        dismiss: () => {
          this.navCtrl.pop();
        }
      });
    }, 0);
  }

  load_info_text() {
    this.p5canvas = new p5((p: p5) => {
      p.noCanvas();
      p.loadStrings(`assets/data/infos/${this.lang.lang}/engine_remote.txt`, (v: string[]) => {
        this.RemoteDesc = v.join('\n');
      });
    });
  }

  /** 모바일에서 PC로 발송 전, base64 쪼개기 상태로 가지고 있음 */
  SelectedFile: string[] = [];

  StartRemoteContrServer() {
    this.webrtc.initialize('data');
    this.toolServer.initialize('engineppt', 12021, () => {
      this.toolServer.list['engineppt'].OnConnected['show_noti'] = (ev: any) => {
        this.noti.PushLocal({
          id: 13,
          title: this.lang.text['EngineWorksPPT']['ClientConnected'],
          body: this.lang.text['EngineWorksPPT']['UsePPTRemote'],
          group_ln: 'engineppt',
          smallIcon_ln: 'engineppt',
          iconColor_ln: '478cbf',
          autoCancel_ln: true,
        }, 'engineppt');
        setTimeout(() => {
          this.toolServer.send_to('engineppt', JSON.stringify({ act: 'WEBRTC_INIT_REQ_SIGNAL' }));
        }, 500);
      }
      this.toolServer.list['engineppt'].OnDisconnected['remove_noti'] = async () => {
        this.noti.ClearNoti(13);
      }
      this.toolServer.list['engineppt'].OnDisconnected['showDisconnected'] = () => {
        if (this.Status == 'OnPresentation')
          this.p5toast.show({
            text: this.lang.text['EngineWorksPPT']['Disconnected'],
          });
      }
    }, (json: any) => {
      switch (json.act) {
        case 'WEBRTC_REPLY_INIT_SIGNAL':
          if (json.data == 'EOL') { // 수신 완료
            this.webrtc.createRemoteOfferFromAnswer(JSON.parse(this.webrtc.ReceivedOfferPart));
            this.webrtc.ReceivedOfferPart = '';
            this.webrtc.CreateAnswer();
            setTimeout(() => {
              let data_str = JSON.stringify(this.webrtc.LocalAnswer);
              let part = data_str.match(/(.{1,250})/g);
              for (let i = 0, j = part.length; i < j; i++)
                this.toolServer.send_to('engineppt', JSON.stringify({ act: 'WEBRTC_RECEIVE_ANSWER', data: part[i] }));
              this.toolServer.send_to('engineppt', JSON.stringify({ act: 'WEBRTC_RECEIVE_ANSWER', data: 'EOL' }));
            }, 500);
          } else this.webrtc.ReceivedOfferPart += json.data;
          break;
        case 'WEBRTC_ICE_CANDIDATES':
          this.webrtc.ReceiveIceCandidate(json.data);
          setTimeout(() => {
            for (let i = 0, j = this.webrtc.IceCandidates.length; i < j; i++)
              this.toolServer.send_to('engineppt', JSON.stringify({ act: 'WEBRTC_ICE_CANDIDATES', data: this.webrtc.IceCandidates[i] }));
            this.webrtc.IceCandidates.length = 0;
          }, 800);
          break;
        case 'react': // 정상 수신 반응, 다음 파트 보내기
          let part = this.SelectedFile.shift();
          if (part) { // 보내야할 내용이 더 있다면
            this.toolServer.send_to('engineppt', JSON.stringify({
              'act': 'part',
              'data': part,
            })); // 없으면 파일 끝 알림
          } else this.toolServer.send_to('engineppt', JSON.stringify({ 'act': 'eof' }));
          break;
        case 'exit': // 앱 종료시
          this.Status = 'initApp';
          break;
        default:
          console.log('예상하지 않은 수신값: ', json);
          break;
      }
    });
  }

  ConnectButtonDisabled = false;
  /** PWA 앱에서 모바일에 직접 입력한 주소로 진입시도 */
  async ConnectToAddress() {
    this.InputAddress = this.InputAddress.trim();
    if (!this.InputAddress) {
      this.p5toast.show({
        text: this.lang.text['EngineWorksPPT']['NeedAddress'],
      });
      return;
    }
    this.ConnectButtonDisabled = true;
    try {
      this.LinkedAddress = await this.CatchAvailableAddress([this.InputAddress]);
    } catch (error) {
      this.p5toast.show({
        text: this.lang.text['EngineWorksPPT']['CannotConnect'],
      });
    }
    this.ConnectButtonDisabled = false;
  }

  engine_ppt_mobile_sel = '';
  buttonClickSelectPckFromMobile() {
    document.getElementById(this.engine_ppt_mobile_sel).click();
  }
  async mobilepckselected(ev: any) {
    if (!this.toolServer.list['engineppt']['users']) {
      this.p5toast.show({
        text: this.lang.text['EngineWorksPPT']['NeedLink'],
      });
      return;
    }
    let filename = ev.target.files[0].name;
    let file_ext = filename.substring(filename.lastIndexOf('.') + 1);
    if (file_ext != 'pck') {
      this.p5toast.show({
        text: this.lang.text['EngineWorksPPT']['FileExtPck'],
      });
      return;
    }
    await this.indexed.saveBlobToUserPath(ev.target.files[0], 'tmp_files/engineppt_selected.pck')
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    const PACK_SIZE = 220000;
    let size = Math.ceil(base64.length / PACK_SIZE);
    this.SelectedFile = base64.match(/(.{1,220000})/g);
    this.toolServer.send_to('engineppt', JSON.stringify({
      'act': 'init',
      'size': size,
      'total': base64.length,
    }));
  }

  /** 임시 웹 소켓, 연결을 유지하다가 엔진PPT와 교대함 */
  TempWs: WebSocket;
  /** 연결 가능한 주소를 확인하여 반환하기 */
  CatchAvailableAddress(addresses: string[]): Promise<string> {
    return new Promise(async (done, error) => {
      let result: any;
      for (let i = 0, j = addresses.length; i < j; i++) {
        try {
          let test = await new Promise(async (done, error) => {
            let base64 = ''; // 휴대폰으로부터 파일을 원격받기 할 경우
            let download_file = await this.loadingCtrl.create({ message: this.lang.text['EngineWorksPPT']['ReceivingFile'] });
            this.TempWs = new WebSocket(`ws://${addresses[i]}:12021`);
            this.TempWs.onopen = async (_ev) => {
              await this.webrtc.initialize('data');
              this.webrtc.createDataChannel('engineppt', { ordered: true, maxRetransmits: 0 });
              this.webrtc.dataChannelOnMsgAct['engineppt'] = (msg: string) => {
                if (this.global.godot_window['override_cursor_position'])
                  this.global.godot_window['override_cursor_position'](JSON.parse(msg));
              }
              this.webrtc.CreateOfffer();
              done(addresses[i]);
            }
            this.TempWs.onmessage = (ev) => {
              let json = JSON.parse(ev.data);
              switch (json['act']) {
                case 'WEBRTC_INIT_REQ_SIGNAL':
                  let data_str = JSON.stringify(this.webrtc.LocalOffer);
                  let part = data_str.match(/(.{1,250})/g);
                  for (let i = 0, j = part.length; i < j; i++)
                    this.TempWs.send(JSON.stringify({ act: 'WEBRTC_REPLY_INIT_SIGNAL', data: part[i] }));
                  this.TempWs.send(JSON.stringify({ act: 'WEBRTC_REPLY_INIT_SIGNAL', data: 'EOL' }));
                  break;
                case 'WEBRTC_RECEIVE_ANSWER':
                  if (json.data == 'EOL') { // 수신 완료
                    this.webrtc.ReceiveRemoteAnswer(JSON.parse(this.webrtc.ReceivedAnswerPart));
                    this.webrtc.ReceivedAnswerPart = '';
                    for (let i = 0, j = this.webrtc.IceCandidates.length; i < j; i++)
                      this.TempWs.send(JSON.stringify({ act: 'WEBRTC_ICE_CANDIDATES', data: this.webrtc.IceCandidates[i] }));
                    this.webrtc.IceCandidates.length = 0;
                  } else this.webrtc.ReceivedAnswerPart += json.data;
                  break;
                case 'WEBRTC_ICE_CANDIDATES':
                  this.webrtc.ReceiveIceCandidate(json.data);
                  break;
                case 'init': // 모바일에서 파일을 보내려 합니다
                  download_file.present();
                  this.TempWs.send(JSON.stringify({ act: 'react' }));
                  break;
                case 'part': // 이전 정보를 정상적으로 전달받았습니다
                  base64 += json['data'];
                  this.TempWs.send(JSON.stringify({ act: 'react' }));
                  break;
                case 'eof': // 파일 전송을 종료합니다
                  this.indexed.saveBase64ToUserPath(base64, 'engineppt/presentation_this.pck', (_) => {
                    download_file.dismiss();
                    this.CreateEnginePPT();
                  }, this.indexed.godotDB);
                  break;
                default:
                  console.log('예상하지 않은 서버 수신값: ', json);
                  break;
              }
            }
            this.TempWs.onclose = async (_ev) => {
              this.LinkedAddress = '';
              download_file.dismiss();
              if (this.Status != 'OnPresentation')
                this.p5toast.show({
                  text: this.lang.text['EngineWorksPPT']['Disconnected'],
                });
              error('onclose');
            }
          });
          result = test;
          break;
        } catch (e) {
          console.log('CatchAvailableAddress: ', e);
          this.TempWs.close();
        }
      }
      if (result) {
        this.p5toast.show({
          text: `${this.lang.text['EngineWorksPPT']['ReadyToConnect']}: ${result}`,
        });
        done(result);
      } else {
        this.LinkedAddress = '';
        error('사용할 수 있는 주소 없음');
      }
    });
  }

  CreateEngineController() {
    this.Status = 'OnPresentation';
    this.noti.ClearNoti(13);
    if (this.p5canvas)
      this.p5canvas.remove();
    document.addEventListener('ionBackButton', this.EventListenerAct);
    this.send_device_rotation();
    let send_ok = true; // 보내도 됨
    let etc_stack = {};
    setTimeout(() => {
      this.global.CreateGodotIFrame('engineppt', {
        local_url: 'assets/data/godot/engineppt.pck',
        title: 'EnginePPTContr',
        /** 엔진에서 광선 시뮬레이션 후 나온 위치 결과물 */
        pointer_pos: (etc: string = '') => {
          let etc_json = JSON.parse(etc);
          etc_stack = { ...etc_stack, ...etc_json };
          if (this.webrtc.dataChannel['engineppt']) {
            this.webrtc.send('engineppt', JSON.stringify({ x: etc_json.x, y: etc_json.y }));
            delete etc_stack['x'];
            delete etc_stack['y'];
          }
          let keys = Object.keys(etc_stack);
          if (send_ok && keys.length) {
            this.toolServer.send_to('engineppt', JSON.stringify({ ...etc_stack }));
            keys.forEach(key => delete etc_stack[key]);
            send_ok = false;
            setTimeout(() => {
              send_ok = true;
            }, 60);
          }
        }
        // set_horizontal_rot
        // set_vertical_rot
      });
    }, 0);
  }

  p5gyro: p5;
  send_device_rotation() {
    this.p5gyro = new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
      }
      p.draw = () => {
        if (this.global.godot_window['set_horizontal_rot'])
          this.global.godot_window['set_horizontal_rot'](p.rotationZ);
        if (this.global.godot_window['set_vertical_rot'])
          this.global.godot_window['set_vertical_rot'](p.rotationX);
      }
    });
  }

  ionViewWillLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    this.toolServer.stop('engineppt');
    delete this.global.p5key['KeyShortCut']['Escape'];
    this.indexed.removeFileFromUserPath('engineppt/presentation_this.pck', undefined, this.indexed.godotDB);
    this.indexed.GetFileListFromDB('tmp_files', list => {
      list.forEach(path => this.indexed.removeFileFromUserPath(path, undefined, this.indexed.godotDB));
    }, this.indexed.godotDB);
    if (this.TempWs)
      this.TempWs.close();
    if (this.p5canvas)
      this.p5canvas.remove();
    if (this.p5gyro)
      this.p5gyro.remove();
    this.webrtc.close_webrtc();
    this.noti.ClearNoti(13);
  }

}
