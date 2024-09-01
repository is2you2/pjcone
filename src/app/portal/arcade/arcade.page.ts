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

  ngOnInit() { }

  async ionViewWillEnter() {
    let servers = this.nakama.get_all_online_server();
    let TmpList = [];
    for (let i = 0, j = servers.length; i < j; i++) {
      try {
        let v = await servers[i].client.readStorageObjects(
          servers[i].session, {
          object_ids: [{
            collection: 'arcade',
            key: 'url',
          }]
        });
        if (v.objects.length) {
          let TargetURL = v.objects[0].value['data'];
          let res = await fetch(TargetURL);
          console.log('읽어보기 경과: ', res);
        }
      } catch (e) {
        console.log('리스트 불러오기 실패: ', e);
      }
    }
    this.ArcadeList = TmpList;
  }
}
