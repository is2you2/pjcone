import { Component, OnInit, ViewChild } from '@angular/core';
import { IonModal, IonRadioGroup, ModalController, NavParams } from '@ionic/angular';
import { LanguageSettingService } from '../language-setting.service';
import { IndexedDBService } from '../indexed-db.service';
import { GlobalActService } from '../global-act.service';
import { SERVER_PATH_ROOT } from '../app.component';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import clipboard from 'clipboardy';
import { P5ToastService } from '../p5-toast.service';
import { NakamaService } from '../nakama.service';

@Component({
  selector: 'app-webrtc-manage-io-dev',
  templateUrl: './webrtc-manage-io-dev.page.html',
  styleUrls: ['./webrtc-manage-io-dev.page.scss'],
})
export class WebrtcManageIoDevPage implements OnInit {

  constructor(
    private navParams: NavParams,
    public modalCtrl: ModalController,
    public lang: LanguageSettingService,
    private indexed: IndexedDBService,
    private global: GlobalActService,
    private mClipboard: Clipboard,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
  ) { }

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

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.replaceState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.modalCtrl.dismiss();
    };
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    this.InOut = this.navParams.get('list') || [];
    for (let i = 0, j = this.InOut.length; i < j; i++) {
      if (this.InOut[i].kind.indexOf('videoinput') >= 0)
        this.VideoInputs.push(this.InOut[i]);
      if (this.InOut[i].kind.indexOf('audioinput') >= 0)
        this.AudioInputs.push(this.InOut[i]);
      if (this.InOut[i].kind.indexOf('audiooutput') >= 0)
        this.AudioOutputs.push(this.InOut[i]);
    }
  }

  async ionViewWillEnter() {
    try {
      let list = await this.indexed.loadTextFromUserPath('servers/webrtc_server.json');
      this.ServerInfos = JSON.parse(list);
      for (let i = 0, j = this.ServerInfos.length; i < j; i++) {
        let address = `${SERVER_PATH_ROOT}pjcone_pwa/?rtcserver=[${this.ServerInfos[i].urls}],${this.ServerInfos[i].username},${this.ServerInfos[i].credential}`;
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
    this.global.p5key['KeyShortCut']['AddAct'] = () => {
      this.OpenNewWebRTCServerForm();
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
    this.modalCtrl.dismiss(result);
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

  OpenNewWebRTCServerForm() {
    this.RegisterServer.present();
  }

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
    await this.nakama.SaveWebRTCServer(this.userInput);
    let address = `${SERVER_PATH_ROOT}pjcone_pwa/?rtcserver=[${this.userInput.urls}],${this.userInput.username},${this.userInput.credential}`;
    let QRCode = this.global.readasQRCodeFromString(address);
    this.QRCodes.push(QRCode);
    this.ServerInfos.push(this.userInput);
    this.userInput = {
      urls: [''],
      username: '',
      credential: '',
    }
    this.UserInputUrlsLength.length = 0;
    this.UserInputUrlsLength.push(0);
    this.RegisterServer.dismiss();
  }

  copy_info(index: number) {
    let address = `${SERVER_PATH_ROOT}pjcone_pwa/?rtcserver=[${this.ServerInfos[index].urls}],${this.ServerInfos[index].username},${this.ServerInfos[index].credential}`;
    this.mClipboard.copy(address)
      .catch(_e => {
        clipboard.write(address);
        this.p5toast.show({
          text: `${this.lang.text['GlobalAct']['PCClipboard']}: ${address}`,
        });
      });
  }

  async RemoveServer(index: number) {
    this.ServerInfos.splice(index, 1);
    await this.indexed.saveTextFileToUserPath(JSON.stringify(this.ServerInfos), 'servers/webrtc_server.json');
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['AddAct'];
  }
}
