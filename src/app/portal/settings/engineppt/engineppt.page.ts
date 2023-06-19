import { Component, OnInit } from '@angular/core';
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { ToolServerService } from 'src/app/tool-server.service';
import { WscService } from 'src/app/wsc.service';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { LoadingController, ModalController } from '@ionic/angular';

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
  ) { }

  EventListenerAct = (ev: any) => {
    ev.detail.register(140, () => { });
  }

  ToggleHeader = true;
  Status = 'initialize';
  QRCode: any;

  ngOnInit() {
    document.addEventListener('ionBackButton', this.EventListenerAct);
  }

  ionViewWillEnter() {
    this.prerequisite_check();
  }

  /** 선행과제 진행, 플랫폼에 따른 시작 UI */
  prerequisite_check() {
    // 모바일 앱인 경우 리모콘 환경설정 유도
    if (isPlatform == 'Android' || isPlatform == 'iOS') {
      this.Status = 'initApp';
    } else { // 웹인 경우 리모콘 연결 유도
      this.Status = 'initPWA';
      // 보조 서버가 있다면 QR코드 보여주기
      if (this.assistServer.client && this.assistServer.client.readyState == this.assistServer.client.OPEN) {
        this.assistServer.received['req_pid'] = (json: any) => {
          this.QRCode = this.global.readasQRCodeFromId({
            pid: json['pid'],
            type: 'EnginePPTLink',
          });
        }
        this.assistServer.disconnected['remove_tool_link'] = () => {
          this.QRCode = '';
        }
        this.assistServer.received['req_link'] = (json: any) => {
          console.log('연결을 요청합니다: ', json);
        }
        this.assistServer.send(JSON.stringify({ act: 'req_pid' }));
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
    this.p5canvas.remove();
    setTimeout(() => {
      this.global.CreateGodotIFrame('engineppt', {
        local_url: 'assets/data/godot/engineppt.pck',
        title: 'EnginePPT',
      });
    }, 0);
  }

  CreateEngineController() {
    this.Status = 'OnPresentation';
    this.toolServer.initialize('engineppt', 12021, () => {

    }, (json: any) => {

    });
    setTimeout(() => {
      console.log('행동하기');
    }, 0);
  }

  go_back() {
    if (this.modalCtrl['injector']['source'] != 'EnginepptPageModule')
      this.modalCtrl.dismiss();
  }

  ionViewWillLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    this.toolServer.stop('engineppt');
    delete this.assistServer.disconnected['remove_tool_link'];
    if (this.p5canvas)
      this.p5canvas.remove();
  }

}
