// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { IonTabs, iosTransitionAnimation, NavController } from '@ionic/angular';
import { LanguageSettingService } from '../language-setting.service';
import { NakamaService } from '../nakama.service';
import * as p5 from 'p5';
import { GlobalActService } from '../global-act.service';
import { StatusManageService } from '../status-manage.service';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  @ViewChild(IonTabs) ionTabs: IonTabs;

  constructor(
    private nav: NavController,
    public lang: LanguageSettingService,
    public nakama: NakamaService,
    private global: GlobalActService,
    public statusBar: StatusManageService,
  ) { }

  ShowOnlineStatus = true;

  ngOnInit() {
    setTimeout(() => {
      this.ShowOnlineStatus = false;
    }, 8000);
    this.nakama.act_callback_link['portal_tab_subscribes'] = () => {
      this.ionTabs.select('subscribes');
      this.subscribe_button();
    }
  }

  ionViewWillEnter() {
    this.create_p5sensor();
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

  ionViewDidLeave() {
    this.remove_p5sensor();
  }
}
