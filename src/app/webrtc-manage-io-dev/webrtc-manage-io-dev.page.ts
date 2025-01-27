import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonModal, IonRadioGroup, NavController } from '@ionic/angular';
import { LanguageSettingService } from '../language-setting.service';
import { IndexedDBService } from '../indexed-db.service';
import { GlobalActService } from '../global-act.service';
import { P5ToastService } from '../p5-toast.service';
import { NakamaService } from '../nakama.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-webrtc-manage-io-dev',
  templateUrl: './webrtc-manage-io-dev.page.html',
  styleUrls: ['./webrtc-manage-io-dev.page.scss'],
})
export class WebrtcManageIoDevPage implements OnInit, OnDestroy {

  constructor(
    public lang: LanguageSettingService,
    private indexed: IndexedDBService,
    private global: GlobalActService,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController,
  ) { }
  ngOnDestroy(): void {
    this.route.queryParams['unsubscribe']();
    if (this.global.PageDismissAct['webrtc-manage']) this.global.PageDismissAct['webrtc-manage']({});
  }

  InOut = [];
  VideoInputs = [];
  AudioInputs = [];
  AudioOutputs = [];

  @ViewChild('VideoIn') VideoInput: IonRadioGroup;
  @ViewChild('AudioIn') AudioInput: IonRadioGroup;
  @ViewChild('AudioOut') AudioOutput: IonRadioGroup;

  ServerInfos = [];
  QRCodes = [];

  userInput = {
    urls: [''],
    username: '',
    credential: '',
  }
  UserInputUrlsLength = [0];

  ngOnInit() {
    this.route.queryParams.subscribe(_p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      this.InOut = navParams.list || [];
      for (let i = 0, j = this.InOut.length; i < j; i++) {
        if (navParams.typein == 'video' && this.InOut[i].kind.indexOf('videoinput') >= 0)
          this.VideoInputs.push(this.InOut[i]);
        if (this.InOut[i].kind.indexOf('audioinput') >= 0)
          this.AudioInputs.push(this.InOut[i]);
        if (this.InOut[i].kind.indexOf('audiooutput') >= 0)
          this.AudioOutputs.push(this.InOut[i]);
      }
    });
  }

  async ionViewWillEnter() {
    try {
      let list = await this.indexed.loadTextFromUserPath('servers/webrtc_server.json');
      this.ServerInfos = JSON.parse(list);
      for (let i = 0, j = this.ServerInfos.length; i < j; i++) {
        let header_address = await this.global.GetHeaderAddress();
        let address = `${header_address}?rtcserver=[${this.ServerInfos[i].urls}],${this.ServerInfos[i].username},${this.ServerInfos[i].credential}`;
        let QRCode = this.global.readasQRCodeFromString(address);
        this.QRCodes[i] = QRCode;
      }
    } catch (e) { }
    try {
      let video_input = localStorage.getItem('VideoInputDev');
      this.VideoInput.value = Number(video_input) || 0;
    } catch (e) { }
    try {
      let audio_input = localStorage.getItem('AudioInputDev');
      this.AudioInput.value = Number(audio_input) || 0;
    } catch (e) { }
  }

  ionViewDidEnter() {
    this.global.p5KeyShortCut['AddAct'] = () => {
      this.OpenNewWebRTCServerForm();
    }
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  saveSetup() {
    let result = {};
    if (this.VideoInput && this.VideoInput.value !== undefined) {
      result['videoinput'] = this.VideoInputs[this.VideoInput.value];
      localStorage.setItem('VideoInputDev', this.VideoInput.value);
    }
    if (this.AudioInput && this.AudioInput.value !== undefined) {
      result['audioinput'] = this.AudioInputs[this.AudioInput.value];
      localStorage.setItem('AudioInputDev', this.AudioInput.value);
    }
    if (this.AudioOutput && this.AudioOutput.value !== undefined)
      result['audiooutput'] = this.AudioOutputs[this.AudioOutput.value];
    if (this.global.PageDismissAct['webrtc-manage']) this.global.PageDismissAct['webrtc-manage']({ data: result });
    this.navCtrl.pop();
  }

  AddServerUrl() {
    this.userInput.urls.push('');
    this.UserInputUrlsLength.push(this.UserInputUrlsLength.length);
  }

  SubtractServerUrl(index: number) {
    this.userInput.urls.splice(index, 1);
    this.UserInputUrlsLength.pop();
  }

  @ViewChild('RegisterNewWebRTCServer') RegisterServer: IonModal;

  /** 새 정보 만들기시 입력 정보 초기화 */
  CreateNewServerInfo() {
    this.userInput = {
      urls: [''],
      username: '',
      credential: '',
    }
    this.UserInputUrlsLength.length = 1;
    this.OpenNewWebRTCServerForm();
  }

  OpenNewWebRTCServerForm() {
    this.global.StoreShortCutAct('webrtc-manage-io');
    this.RegisterServer.onDidDismiss().then(() => {
      this.global.RestoreShortCutAct('webrtc-manage-io');
    });
    this.RegisterServer.present();
  }

  /** 정보 수정시 순번 기억 */
  index: number;
  async SaveServer() {
    this.userInput.urls.filter(v => v);
    for (let i = this.userInput.urls.length - 1; i >= 0; i--)
      if (!this.userInput.urls[i].trim())
        this.userInput.urls.splice(i, 1);
    if (!this.userInput.urls.length) {
      this.p5toast.show({
        text: this.lang.text['WebRTCDevManager']['IgnoreSave'],
      });
      return;
    }
    let isExist = await this.nakama.SaveWebRTCServer(this.userInput);
    let header_address = await this.global.GetHeaderAddress();
    let address = `${header_address}?rtcserver=[${this.userInput.urls}],${this.userInput.username},${this.userInput.credential}`;
    let QRCode = this.global.readasQRCodeFromString(address);
    if (this.index !== undefined)
      this.QRCodes[this.index] = QRCode;
    else this.QRCodes.push(QRCode);
    if (!isExist) this.ServerInfos.push(this.userInput);
    this.userInput = {
      urls: [''],
      username: '',
      credential: '',
    }
    this.UserInputUrlsLength.length = 0;
    this.UserInputUrlsLength.push(0);
    this.index = undefined;
    this.RegisterServer.dismiss();
  }

  async copy_info(index: number) {
    let header_address = await this.global.GetHeaderAddress();
    let address = `${header_address}?rtcserver=[${this.ServerInfos[index].urls}],${this.ServerInfos[index].username},${this.ServerInfos[index].credential}`;
    this.global.WriteValueToClipboard('text/plain', address);
  }

  ModifyServer(index: number) {
    this.index = index;
    this.userInput = this.ServerInfos[index];
    this.UserInputUrlsLength.length = 0;
    for (let i = 0, j = this.userInput.urls.length; i < j; i++)
      this.UserInputUrlsLength.push(i);
    this.OpenNewWebRTCServerForm();
  }

  async RemoveServer(index: number) {
    this.QRCodes.splice(index, 1);
    this.ServerInfos.splice(index, 1);
    await this.indexed.saveTextFileToUserPath(JSON.stringify(this.ServerInfos), 'servers/webrtc_server.json');
  }

  ionViewWillLeave() {
    delete this.global.p5KeyShortCut['AddAct'];
    delete this.global.p5KeyShortCut['Escape'];
  }
}
