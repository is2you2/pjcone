// SPDX-FileCopyrightText: © 2024 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {

  constructor(
    public statusBar: StatusManageService,
    public nakama: NakamaService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private navCtrl: NavController,
  ) { }

  ngOnInit() { }

  add_post() {
    console.log('새 포스트 작성');
  }

  ionViewDidEnter() {
    this.try_add_shortcut();
  }

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.AddShortcut();
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
        console.log('숫자에 따른 포스트 상세 열기');
        // if (this.nakama.channels.length > index)
        //   this.go_to_chatroom(this.nakama.channels[index]);
        // else this.add_new_group();
      };
    }
    if (this.global.p5key && this.global.p5key['KeyShortCut']
      && !this.global.p5key['KeyShortCut']['AddAct'])
      this.global.p5key['KeyShortCut']['AddAct'] = () => {
        this.add_post();
      };
  }

  go_to_page(_page: string) {
    this.navCtrl.navigateForward(`portal/settings/${_page}`);
    this.nakama.removeBanner();
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Digit'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
  }
}
