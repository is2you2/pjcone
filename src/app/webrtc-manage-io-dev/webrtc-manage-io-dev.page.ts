import { Component, OnInit, ViewChild } from '@angular/core';
import { IonRadioGroup, ModalController, NavParams } from '@ionic/angular';
import { LanguageSettingService } from '../language-setting.service';

@Component({
  selector: 'app-webrtc-manage-io-dev',
  templateUrl: './webrtc-manage-io-dev.page.html',
  styleUrls: ['./webrtc-manage-io-dev.page.scss'],
})
export class WebrtcManageIoDevPage implements OnInit {

  constructor(
    private navParams: NavParams,
    private modalCtrl: ModalController,
    public lang: LanguageSettingService,
  ) { }

  VideoInputs = [];
  AudioInputs = [];
  AudioOutputs = [];

  @ViewChild('VideoIn') VideoInput: IonRadioGroup;
  @ViewChild('AudioIn') AudioInput: IonRadioGroup;
  @ViewChild('AudioOut') AudioOutput: IonRadioGroup;


  ngOnInit() {
    let io = this.navParams.get('list');
    for (let i = 0, j = io.length; i < j; i++) {
      if (io[i].kind.indexOf('videoinput') >= 0)
        this.VideoInputs.push(io[i]);
      if (io[i].kind.indexOf('audioinput') >= 0)
        this.AudioInputs.push(io[i]);
      if (io[i].kind.indexOf('audiooutput') >= 0)
        this.AudioOutputs.push(io[i]);
    }
  }

  saveSetup() {
    let result = {};
    if (this.VideoInput && this.VideoInput.value)
      result['videoinput'] = this.VideoInputs[this.VideoInput.value];
    if (this.AudioInput && this.AudioInput.value)
      result['audioinput'] = this.AudioInputs[this.AudioInput.value];
    if (this.AudioOutput && this.AudioOutput.value)
      result['audiooutput'] = this.AudioOutputs[this.AudioOutput.value];
    this.modalCtrl.dismiss(result);
  }
}
