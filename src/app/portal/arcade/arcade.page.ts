import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';

@Component({
  selector: 'app-arcade',
  templateUrl: './arcade.page.html',
  styleUrls: ['./arcade.page.scss'],
})
export class ArcadePage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
  ) { }

  /** 아케이드 정보 수집 */
  ArcadeList = [];

  ngOnInit() {
    let servers = this.nakama.get_all_online_server();
    for (let i = 0, j = servers.length; i < j; i++) {
      servers[i].client.readStorageObjects(
        servers[i].session, {
        object_ids: [{
          collection: 'arcade',
          key: 'url',
        }]
      }).then(v => {
        if (v.objects.length) {
          console.log('아케이드 주소 수집됨: ', v.objects[0].value['data']);
        }
      });
    }
  }
}
