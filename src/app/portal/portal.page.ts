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
    this.create_p5sensor();
    if (this.CacheKeyShortCut)
      this.global.p5key['KeyShortCut'] = this.CacheKeyShortCut;
    this.try_add_shortcut();
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

  p5sensor: p5;
  create_p5sensor() {
    if (!this.p5sensor && this.TodoIcon == 'checkbox') {
      this.p5sensor = new p5((p: p5) => {
        p.setup = () => {
          p.noCanvas();
        }
        p.draw = () => {
          if (this.global.godot_window['acc_input'])
            this.global.godot_window['acc_input'](p.accelerationX, p.accelerationY);
        }
      });
    }
  }

  remove_p5sensor() {
    if (this.p5sensor) {
      this.p5sensor.remove();
      this.p5sensor = null;
    }
  }

  /** 하단 탭을 눌러 알림 확인함 처리 */
  subscribe_button() {
    this.nakama.has_new_channel_msg = false;
    this.SubscribesIcon = 'chatbubbles';
    this.TodoIcon = 'checkbox-outline';
    this.remove_p5sensor();
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
    this.create_p5sensor();
  }

  CacheKeyShortCut: any;
  ionViewWillLeave() {
    this.CacheKeyShortCut = this.global.p5key['KeyShortCut'];
    this.global.p5key['KeyShortCut'] = {};
  }

  ionViewDidLeave() {
    this.remove_p5sensor();
  }
}
