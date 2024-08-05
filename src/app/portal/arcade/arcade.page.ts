import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-arcade',
  templateUrl: './arcade.page.html',
  styleUrls: ['./arcade.page.scss'],
})
export class ArcadePage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
  ) { }

  ngOnInit() { }

}
