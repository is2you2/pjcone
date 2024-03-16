// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { IonTabs, iosTransitionAnimation, NavController } from '@ionic/angular';
import { NakamaService } from '../nakama.service';
import { GlobalActService } from '../global-act.service';
import { IndexedDBService } from '../indexed-db.service';
import { WebrtcService } from '../webrtc.service';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  @ViewChild(IonTabs) ionTabs: IonTabs;

  constructor(
    private nav: NavController,
    public nakama: NakamaService,
    private global: GlobalActService,
    public indexed: IndexedDBService,
    private _webrtc: WebrtcService,
  ) { }

  ngOnInit() { }

  ionViewDidEnter() {
    if (this.CacheKeyShortCut)
      this.global.p5key['KeyShortCut'] = this.CacheKeyShortCut;
    this.try_add_shortcut();
    this.nakama.resumeBanner();
    if (this.global.p5todo && this.global.p5todo['PlayCanvas'] && this.TodoIcon == 'checkbox')
      this.global.p5todo['PlayCanvas']();
    if (this.nakama.AfterLoginAct.length) { // 빠른 진입 행동 보완
      this.nav.navigateForward('portal/settings/group-server');
      this.nakama.removeBanner();
    }
  }

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.global.p5key['KeyShortCut']['BottomTab'] = (char: string) => {
        switch (char) {
          case 'Q':
            this.bottom_tab_selected();
            this.ionTabs.select('main');
            break;
          case 'W':
            this.subscribe_button();
            this.ionTabs.select('subscribes');
            break;
          case 'E':
            this.setting_button();
            break;
        }
      }
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 하단 탭을 눌러 알림 확인함 처리 */
  subscribe_button() {
    this.nakama.has_new_channel_msg = false;
    this.SubscribesIcon = 'chatbubbles';
    this.TodoIcon = 'checkbox-outline';
  }

  /** 하단 탭을 눌러 설정페이지로 이동 */
  setting_button() {
    this.nakama.removeBanner();
    this.nav.navigateForward('portal/settings', {
      animation: iosTransitionAnimation,
    });
  }

  SubscribesIcon = 'chatbubbles';
  TodoIcon = 'checkbox-outline';

  bottom_tab_selected() {
    this.SubscribesIcon = 'chatbubbles-outline';
    this.TodoIcon = 'checkbox';
  }

  CacheKeyShortCut: any;
  ionViewWillLeave() {
    this.CacheKeyShortCut = this.global.p5key['KeyShortCut'];
    this.global.p5key['KeyShortCut'] = {};
    try {
      this.global.p5todo['StopCanvas']();
    } catch (e) { }
  }
}
