// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { IndexedDBService } from '../indexed-db.service';
import { LanguageSettingService } from '../language-setting.service';
import { NakamaService } from '../nakama.service';
import { ProfilePage } from './settings/profile/profile.page';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  constructor(
    private nav: NavController,
    private indexed: IndexedDBService,
    private modalCtrl: ModalController,
    public lang: LanguageSettingService,
    public nakama: NakamaService,
  ) { }

  ngOnInit() {
    this.indexed.checkIfFileExist('servers/self/profile.json', (b) => {
      if (!b) {  // 프로필 정보 없는 상태
        this.modalCtrl.create({
          component: ProfilePage
        }).then(v => v.present());
      }
    });
  }

  /** 하단 탭을 눌러 알림 확인함 처리 */
  subscribe_button() {
    this.nakama.has_new_channel_msg = false;
  }

  /** 하단 탭을 눌러 설정페이지로 이동 */
  setting_button() {
    this.nakama.removeBanner();
    this.nav.navigateForward('settings', {
      animation: iosTransitionAnimation,
    });
  }
}
