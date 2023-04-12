// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { AddTodoMenuPage } from './add-todo-menu/add-todo-menu.page';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition, BannerAdPluginEvents, AdMobBannerSize } from '@capacitor-community/admob';
import { SERVER_PATH_ROOT } from 'src/app/app.component';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private app: GlobalActService,
    public lang: LanguageSettingService,
    private modalCtrl: ModalController,
    private nakama: NakamaService,
  ) { }

  ngOnInit() {
    this.add_admob_banner();
  }

  async add_admob_banner() {
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      this.nakama.appMargin = size.height;
      const app: HTMLElement = document.querySelector('ion-router-outlet');

      if (this.nakama.appMargin === 0)
        app.style.marginBottom = '';
      else if (this.nakama.appMargin > 0)
        app.style.marginBottom = this.nakama.appMargin + 'px';
    });
    const options: BannerAdOptions = {
      adId: 'ca-app-pub-6577630868247944/4829889344',
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
    };
    /** 광고 정보 불러오기 */
    try { // 파일이 없으면 광고를 보여줌, 파일이 있다면 안보여줌
      let res = await fetch(`${SERVER_PATH_ROOT}pjcone_ads/admob.txt`);
      if (!res.ok) "광고가 없다고 생각됩니다";
    } catch (e) { // 로컬 정보 기반으로 광고
      console.log(e);
      AdMob.showBanner(options).then(() => {
        this.nakama.isBannerShowing = true;
      });
    }
  }

  ionViewWillEnter() {
    this.app.CreateGodotIFrame('godot-todo', {
      act: 'godot-todo',
      title: 'Todo',
      /**
       * 해야할 일 추가/수정/열람 메뉴 띄우기
       * @param _data 해당 해야할 일 정보
       */
      add_todo_menu: (_data: string) => {
        this.modalCtrl.create({
          component: AddTodoMenuPage,
          componentProps: {
            godot: this.app.godot.contentWindow || this.app.godot.contentDocument,
            data: _data,
          },
        }).then(v => v.present());
      }
      // 아래 주석 처리된 key들은 고도쪽에서 추가됨
      // add_todo: 새 해야할 일 등록
      // remove_todo: 해야할 일 삭제
    });
  }

  ionViewDidEnter() {
    this.nakama.resumeBanner();
  }
}
