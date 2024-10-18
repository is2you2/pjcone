import { Component, OnInit } from '@angular/core';
import { NavController, iosTransitionAnimation } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MiniranchatClientService } from 'src/app/miniranchat-client.service';
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
    private navCtrl: NavController,
    private client: MiniranchatClientService,
    public global: GlobalActService,
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

  /** 익명성 그룹 채널에 참가하기 */
  JoinSmallTalk() {
    if (this.statusBar.settings['dedicated_groupchat'] != 'online'
      && this.statusBar.settings['dedicated_groupchat'] != 'certified')
      this.statusBar.settings['dedicated_groupchat'] = 'pending';
    this.client.RejoinGroupChat();
  }

  /** 즉석 통화 페이지로 이동 */
  JoinInstantCall() {
    this.navCtrl.navigateForward('portal/arcade/instant-call', {
      animation: iosTransitionAnimation,
    });
  }
}
