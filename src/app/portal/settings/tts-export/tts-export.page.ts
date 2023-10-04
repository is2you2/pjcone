import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

@Component({
  selector: 'app-tts-export',
  templateUrl: './tts-export.page.html',
  styleUrls: ['./tts-export.page.scss'],
})
export class TtsExportPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
  ) { }

  userInput = '';

  ngOnInit() { }

  async ReadThis() {
    try {
      await TextToSpeech.speak({
        text: this.userInput,
        lang: this.lang.lang,
      });
    } catch (e) { }
  }

}
