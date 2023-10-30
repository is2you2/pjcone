import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { GlobalActService } from 'src/app/global-act.service';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-tts-export',
  templateUrl: './tts-export.page.html',
  styleUrls: ['./tts-export.page.scss'],
})
export class TtsExportPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private navCtrl: NavController,
  ) { }

  userInput = '';
  userInput_placeholder = '';

  ngOnInit() { }

  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  async ReadThis() {
    if (this.userInput)
      this.userInput_placeholder = this.userInput;
    this.userInput = '';
    try {
      await TextToSpeech.speak({
        text: this.userInput_placeholder,
        lang: this.lang.lang,
      });
    } catch (e) { }
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
  }

}
