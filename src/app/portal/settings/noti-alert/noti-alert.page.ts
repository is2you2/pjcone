import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { LocalNotiService } from 'src/app/local-noti.service';

@Component({
  selector: 'app-noti-alert',
  templateUrl: './noti-alert.page.html',
  styleUrls: ['./noti-alert.page.scss'],
})
export class NotiAlertPage implements OnInit {

  constructor(
    public noti: LocalNotiService,
    public lang: LanguageSettingService,
  ) { }

  ngOnInit() { }

  toggle_silent_set(key: string) {
    this.noti.change_silent_settings(key);
  }
}
