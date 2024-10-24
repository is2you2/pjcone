import { Component, OnDestroy, OnInit } from '@angular/core';
import { LanguageSettingService } from '../language-setting.service';
import { StatusManageService } from '../status-manage.service';
import { NakamaService } from '../nakama.service';
import { GlobalActService } from '../global-act.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-share-content-to-other',
  templateUrl: './share-content-to-other.page.html',
  styleUrls: ['./share-content-to-other.page.scss'],
})
export class ShareContentToOtherPage implements OnInit, OnDestroy {

  constructor(
    public lang: LanguageSettingService,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
    public global: GlobalActService,
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController,
  ) { }

  ngOnDestroy() {
    delete this.global.p5KeyShortCut['Digit'];
    delete this.global.PageDismissAct['share'];
    this.route.queryParams['unsubscribe']();
    if (this.global.PageDismissAct['share'])
      this.global.PageDismissAct['share']({});
  }

  channels: any[];

  navParams: any;
  /** 이 페이지가 해야할 일을 끝냈음 */
  Done = false;

  ngOnInit() {
    this.route.queryParams.subscribe(async _p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      this.navParams = navParams || {};
      this.channels = this.navParams.channels;
      this.Done = false;
    });
  }

  ionViewWillEnter() {
    this.global.p5KeyShortCut['Digit'] = (index: number) => {
      if (this.nakama.channels.length > index)
        this.go_to_chatroom(this.nakama.channels[index]);
    };
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
    if (this.Done) this.navCtrl.pop();
  }

  go_to_chatroom(channel: any) {
    let FileInfo = this.navParams.file;
    delete FileInfo['db'];
    this.nakama.go_to_chatroom_without_admob_act(channel, FileInfo);
    if (this.global.PageDismissAct['share'])
      this.global.PageDismissAct['share']({ data: true });
    this.navCtrl.pop();
    this.Done = true;
  }

  ionViewWillLeave() {
    delete this.global.p5KeyShortCut['Escape'];
  }
}
