import { Component, OnInit } from '@angular/core';
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { ToolServerService } from 'src/app/tool-server.service';
import { WscService } from 'src/app/wsc.service';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { LoadingController, ModalController, NavParams } from '@ionic/angular';
import { StatusManageService } from 'src/app/status-manage.service';

@Component({
  selector: 'app-engineppt',
  templateUrl: './engineppt.page.html',
  styleUrls: ['./engineppt.page.scss'],
})
export class EnginepptPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private assistServer: WscService,
    private toolServer: ToolServerService,
    private indexed: IndexedDBService,
    private p5toast: P5ToastService,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    private navParams: NavParams,
    public statusBar: StatusManageService,
  ) { }

  EventListenerAct = (ev: any) => {
    ev.detail.register(150, () => { });
  }

  ToggleHeader = true;
  Status = 'initialize';
  QRCode: any;
  RemoteDesc: string;
  InputAddress = '';
  /** PWA: 컨트롤러로 연결할 주소 */
  LinkedAddress = '';

  ngOnInit() { }

  ionViewWillEnter() {
    this.prerequisite_check();
  }

  /** 선행과제 진행, 플랫폼에 따른 시작 UI */
  prerequisite_check() {
    // 모바일 앱인 경우 리모콘 환경설정 유도
    if (isPlatform == 'Android' || isPlatform == 'iOS') {
      this.Status = 'initApp';
      // 보조 서버가 있다면 내 pid 수집
      if (this.assistServer.client && this.assistServer.client.readyState == this.assistServer.client.OPEN) {
        this.assistServer.received['req_link'] = (json: any) => {
          console.log('데이터를 받음: ', json);
        }
      }
      this.load_info_text();
      this.StartRemoteContrServer();
    } else { // 웹인 경우 리모콘 연결 유도
      this.Status = 'initPWA';
      // 보조 서버가 있다면 QR코드 보여주기
      if (this.assistServer.client && this.assistServer.client.readyState == this.assistServer.client.OPEN) {
        this.QRCode = this.global.readasQRCodeFromId({
          pid: this.assistServer.pid,
          type: 'EnginePPTLink',
        });
        this.assistServer.disconnected['remove_tool_link'] = () => {
          this.QRCode = '';
        }
        this.assistServer.received['req_link'] = async (json: any) => {
          try {
            this.LinkedAddress = await this.CatchAvailableAddress(json.addresses);
          } catch (error) {
            this.p5toast.show({
              text: this.lang.text['EngineWorksPPT']['CannotConnect'],
            });
          }
        }
      }
      setTimeout(() => {
        this.CreateDrop();
      }, 0);
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

  buttonClickLinkInputFile() {
    document.getElementById('file_sel').click();
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
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    await this.indexed.saveFileToUserPath(base64, 'engineppt/presentation_this.pck');
    this.CreateEnginePPT();
    setTimeout(() => {
      loading.dismiss();
    }, 1000);
  }

  CreateEnginePPT() {
    this.ToggleHeader = false; // 전체화면하기 좋도록 헤더 삭제
    this.Status = 'OnPresentation';
    if (this.p5canvas)
      this.p5canvas.remove();
    setTimeout(() => {
      this.TempWs.close();
      this.global.CreateGodotIFrame('engineppt', {
        local_url: 'assets/data/godot/engineppt.pck',
        title: 'EnginePPT',
        remoteAddr: this.LinkedAddress,
        p5toast: (msg: string) => {
          this.p5toast.show({
            text: msg,
          });
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

  StartRemoteContrServer() {
    this.toolServer.initialize('engineppt', 12021, () => {
      this.toolServer.list['engineppt'].OnDisconnected['showDisconnected'] = () => {
        if (this.Status == 'OnPresentation')
          this.p5toast.show({
            text: this.lang.text['EngineWorksPPT']['Disconnected'],
          });
      }
      if (this.assistServer.client && this.assistServer.client.readyState == this.assistServer.client.OPEN)
        this.RequestLinkThisDevice();
    }, (json: any) => {
      console.log('수신받은 메시지는: ', json);
      switch (json.act) {
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

  /** 임시 웹 소켓, 연결을 유지하다가 엔진PPT와 교대함 */
  TempWs: WebSocket;
  /** 연결 가능한 주소를 확인하여 반환하기 */
  CatchAvailableAddress(addresses: string[]): Promise<string> {
    return new Promise(async (done, error) => {
      let result: any;
      for (let i = 0, j = addresses.length; i < j; i++) {
        try {
          let test = await new Promise((d, e) => {
            this.TempWs = new WebSocket(`ws://${addresses[i]}:12021`);
            this.TempWs.onopen = (_ev) => {
              d(addresses[i]);
            }
            this.TempWs.onclose = (_ev) => {
              this.LinkedAddress = '';
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
          console.log('test: ', e);
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

  /** 이 모바일 기기로 연결하라고 신호보내기 */
  RequestLinkThisDevice() {
    let json = {
      act: 'req_link',
      pid: this.navParams.get('pid'),
      sender: this.assistServer.pid,
      addresses: this.toolServer.addresses,
    }
    this.assistServer.send(JSON.stringify(json));
  }

  CreateEngineController() {
    this.Status = 'OnPresentation';
    if (this.p5canvas)
      this.p5canvas.remove();
    document.addEventListener('ionBackButton', this.EventListenerAct);
    this.send_device_rotation();
    setTimeout(() => {
      this.global.CreateGodotIFrame('engineppt', {
        local_url: 'assets/data/godot/engineppt.pck',
        title: 'EnginePPTContr',
        /** 엔진에서 광선 시뮬레이션 후 나온 위치 결과물 */
        pointer_pos: (x: number, y: number) => {
          console.log(`testSend_position: (${x}, ${y})`);
          this.toolServer.send_to('engineppt', `testSend_position: (${x}, ${y})`);
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
    delete this.assistServer.received['req_link'];
    delete this.assistServer.disconnected['remove_tool_link'];
    if (this.TempWs)
      this.TempWs.close();
    if (this.p5canvas)
      this.p5canvas.remove();
    if (this.p5gyro)
      this.p5gyro.remove;
  }

}
