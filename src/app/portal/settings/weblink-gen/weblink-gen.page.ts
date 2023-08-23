import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-weblink-gen',
  templateUrl: './weblink-gen.page.html',
  styleUrls: ['./weblink-gen.page.scss'],
})
export class WeblinkGenPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
  ) { }

  ngOnInit() {
  }

}
