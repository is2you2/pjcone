// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition, BannerAdPluginEvents, AdMobBannerSize } from '@capacitor-community/admob';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { WebrtcService } from 'src/app/webrtc.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private global: GlobalActService,
    public lang: LanguageSettingService,
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    private _webrtc: WebrtcService,
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
    try { // 파일이 있으면 보여주고, 없다면 보여주지 않음
      this.nakama.isBannerShowing = false;
      let res = await fetch(`${SERVER_PATH_ROOT}pjcone_ads/admob.txt`);
      if (!res.ok) throw "준비된 광고가 없습니다";
      AdMob.showBanner(options).then(() => {
        this.nakama.isBannerShowing = true;
      });
    } catch (e) { // 로컬 정보 기반으로 광고
      console.log(e);
    }
  }

  async ionViewWillEnter() {
    await this.global.CreateGodotIFrame('todo', {
      local_url: 'assets/data/godot/todo.pck',
      title: 'Todo',
      /**
       * 해야할 일 추가/수정/열람 메뉴 띄우기
       * @param _data 해당 해야할 일 정보
       */
      add_todo_menu: (_data: string) => {
        this.nakama.open_add_todo_page(_data);
      }
      // 아래 주석 처리된 key들은 고도쪽에서 추가됨
      // add_todo: 새 해야할 일 등록
      // remove_todo: 해야할 일 삭제
    }, 'add_todo');
    this.indexed.GetFileListFromDB('acts_local', list => {
      list.forEach(path => this.indexed.removeFileFromUserPath(path, undefined, this.indexed.godotDB));
    }, this.indexed.godotDB);
  }

  ionViewDidEnter() {
    this.nakama.resumeBanner();
    this.global.p5key['KeyShortCut']['AddAct'] = () => {
      this.nakama.open_add_todo_page('');
    }
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['AddAct'];
  }
}
