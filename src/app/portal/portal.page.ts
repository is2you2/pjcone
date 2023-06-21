// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { LanguageSettingService } from '../language-setting.service';
import { NakamaService } from '../nakama.service';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  constructor(
    private nav: NavController,
    public lang: LanguageSettingService,
    public nakama: NakamaService,
  ) { }

  ngOnInit() { }

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
