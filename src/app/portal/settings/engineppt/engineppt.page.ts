import { Component, OnInit } from '@angular/core';
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { ToolServerService } from 'src/app/tool-server.service';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { LoadingController, ModalController, NavController } from '@ionic/angular';
import { StatusManageService } from 'src/app/status-manage.service';
import { LocalNotiService } from 'src/app/local-noti.service';

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
    private modalCtrl: ModalController,
    public statusBar: StatusManageService,
    private navCtrl: NavController,
    private noti: LocalNotiService,
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

  ngOnInit() {
    this.engine_ppt_file_sel = `engine_ppt_file_sel_${new Date().getTime()}`;
    this.engine_ppt_mobile_sel = `engine_ppt_mobile_sel_${new Date().getTime()}`;
  }

  ionViewWillEnter() {
    this.prerequisite_check();
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
        canvas.parent(parent);
        canvas.drop(async (file: any) => {
          this.StartPresentation(file.name, file.data);
        });
      }
    });
  }

  engine_ppt_file_sel = '';
  buttonClickLinkInputFile() {
    document.getElementById(this.engine_ppt_file_sel).click();
  }
  async inputpckselected(ev: any) {
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.StartPresentation(ev.target.files[0].name, base64);
  }

  async StartPresentation(filename: string, base64: any) {
    let file_ext = filename.substring(filename.lastIndexOf('.') + 1);
    if (file_ext != 'pck') {
      this.p5toast.show({
        text: this.lang.text['EngineWorksPPT']['FileExtPck'],
      });
      return;
    }
    await this.indexed.saveFileToUserPath(base64, 'engineppt/presentation_this.pck');
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
          if (this.modalCtrl['injector']['source'] != 'EnginepptPageModule')
            this.modalCtrl.dismiss();
          else this.navCtrl.back();
        }
      });
    }, 0);
  }

  load_info_text() {
    this.p5canvas = new p5((p: p5) => {
      p.loadStrings(`assets/data/infos/${this.lang.lang}/engine_remote.txt`, (v: string[]) => {
        this.RemoteDesc = v.join('\n');
      });
    });
  }

  /** 모바일에서 PC로 발송 전, base64 쪼개기 상태로 가지고 있음 */
  SelectedFile: string[] = [];

  StartRemoteContrServer() {
    this.toolServer.initialize('engineppt', 12021, () => {
      this.toolServer.list['engineppt'].OnConnected['show_noti'] = () => {
        this.noti.PushLocal({
          id: 13,
          title: this.lang.text['EngineWorksPPT']['ClientConnected'],
          body: this.lang.text['EngineWorksPPT']['UsePPTRemote'],
          group_ln: 'engineppt',
          smallIcon_ln: 'engineppt',
          iconColor_ln: '478cbf',
          autoCancel_ln: true,
        }, 'engineppt');
      }
      this.toolServer.list['engineppt'].OnDisconnected['remove_noti'] = () => {
        this.noti.ClearNoti(13);
      }
      this.toolServer.list['engineppt'].OnDisconnected['showDisconnected'] = () => {
        if (this.Status == 'OnPresentation')
          this.p5toast.show({
            text: this.lang.text['EngineWorksPPT']['Disconnected'],
          });
      }
    }, (json: any) => {
      console.log('수신받은 메시지는: ', json);
      switch (json.act) {
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
          let test = await new Promise(async (d, e) => {
            let base64 = ''; // 휴대폰으로부터 파일을 원격받기 할 경우
            let download_file = await this.loadingCtrl.create({ message: this.lang.text['EngineWorksPPT']['ReceivingFile'] });
            this.TempWs = new WebSocket(`ws://${addresses[i]}:12021`);
            this.TempWs.onopen = (_ev) => {
              d(addresses[i]);
            }
            this.TempWs.onmessage = (ev) => {
              let json = JSON.parse(ev.data);
              switch (json['act']) {
                case 'init': // 모바일에서 파일을 보내려 합니다
                  download_file.present();
                  this.TempWs.send(JSON.stringify({ act: 'react' }));
                  break;
                case 'part': // 이전 정보를 정상적으로 전달받았습니다
                  base64 += json['data'];
                  this.TempWs.send(JSON.stringify({ act: 'react' }));
                  break;
                case 'eof': // 파일 전송을 종료합니다
                  this.indexed.saveFileToUserPath(base64, 'engineppt/presentation_this.pck', (_) => {
                    download_file.dismiss();
                    this.CreateEnginePPT();
                  });
                  break;
                default:
                  console.log('예상하지 않은 서버 수신값: ', json);
                  break;
              }
            }
            this.TempWs.onclose = (_ev) => {
              this.LinkedAddress = '';
              download_file.dismiss();
              if (this.Status != 'OnPresentation')
                this.p5toast.show({
                  text: this.lang.text['EngineWorksPPT']['Disconnected'],
                });
              e('onclose');
            }
          });
          result = test;
          break;
        } catch (e) {
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
          if (send_ok) {
            this.toolServer.send_to('engineppt', JSON.stringify({ ...etc_stack }));
            let keys = Object.keys(etc_stack);
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
      p.draw = () => {
        if (this.global.godot_window['set_horizontal_rot'])
          this.global.godot_window['set_horizontal_rot'](p.rotationZ);
        if (this.global.godot_window['set_vertical_rot'])
          this.global.godot_window['set_vertical_rot'](p.rotationX);
      }
    });
  }

  go_back() {
    if (this.modalCtrl['injector']['source'] != 'EnginepptPageModule')
      this.modalCtrl.dismiss();
  }

  ionViewWillLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    this.toolServer.stop('engineppt');
    this.indexed.removeFileFromUserPath('engineppt/presentation_this.pck');
    if (this.TempWs)
      this.TempWs.close();
    if (this.p5canvas)
      this.p5canvas.remove();
    if (this.p5gyro)
      this.p5gyro.remove();
    this.noti.ClearNoti(13);
  }

}
