import { Component, OnInit, ViewChild } from '@angular/core';
import { IonModal, IonRadioGroup, ModalController, NavParams } from '@ionic/angular';
import { LanguageSettingService } from '../language-setting.service';
import { IndexedDBService } from '../indexed-db.service';

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
  ) { }

  InOut = [];
  VideoInputs = [];
  AudioInputs = [];
  AudioOutputs = [];

  @ViewChild('VideoIn') VideoInput: IonRadioGroup;
  @ViewChild('AudioIn') AudioInput: IonRadioGroup;
  @ViewChild('AudioOut') AudioOutput: IonRadioGroup;

  ServerInfos = [];

  userInput = {
    urls: [''],
    username: '',
    credential: '',
  }
  UserInputUrlsLength = [0];

  ngOnInit() {
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

  @ViewChild(IonModal) RegisterServer: IonModal;

  async SaveServer() {
    this.ServerInfos.push(this.userInput);
    this.userInput = {
      urls: [''],
      username: '',
      credential: '',
    }
    this.UserInputUrlsLength.length = 0;
    this.UserInputUrlsLength.push(0);
    await this.indexed.saveTextFileToUserPath(JSON.stringify(this.ServerInfos), 'servers/webrtc_server.json');
    this.RegisterServer.dismiss();
  }

  async RemoveServer(index: number) {
    this.ServerInfos.splice(index, 1);
    await this.indexed.saveTextFileToUserPath(JSON.stringify(this.ServerInfos), 'servers/webrtc_server.json');
  }
}
