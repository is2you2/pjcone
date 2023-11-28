// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { IonTabs, iosTransitionAnimation, NavController } from '@ionic/angular';
import { NakamaService } from '../nakama.service';
import * as p5 from 'p5';
import { GlobalActService } from '../global-act.service';
import { IndexedDBService } from '../indexed-db.service';

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
  ) { }

  ngOnInit() {
    this.nakama.act_callback_link['portal_tab_subscribes'] = () => {
      this.ionTabs.select('subscribes');
      this.subscribe_button();
    }
  }

  ionViewDidEnter() {
    if (this.CacheKeyShortCut)
      this.global.p5key['KeyShortCut'] = this.CacheKeyShortCut;
    this.try_add_shortcut();
    this.nakama.resumeBanner();
    if (this.global.p5todo && this.global.p5todo['PlayCanvas'] && this.TodoIcon == 'checkbox')
      this.global.p5todo['PlayCanvas']();
  }

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.global.p5key['KeyShortCut']['BottomTab'] = (char: string) => {
        switch (char) {
          case 'Q':
            this.ionTabs.select('subscribes');
            this.subscribe_button();
            break;
          case 'W':
            this.ionTabs.select('main');
            this.bottom_tab_selected();
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
    this.nav.navigateForward('settings', {
      animation: iosTransitionAnimation,
    });
  }

  SubscribesIcon = 'chatbubbles-outline';
  TodoIcon = 'checkbox';

  bottom_tab_selected() {
    this.SubscribesIcon = 'chatbubbles-outline';
    this.TodoIcon = 'checkbox';
  }

  CacheKeyShortCut: any;
  ionViewWillLeave() {
    this.CacheKeyShortCut = this.global.p5key['KeyShortCut'];
    this.global.p5key['KeyShortCut'] = {};
    this.global.p5todo['StopCanvas']();
  }
}
