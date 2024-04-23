// SPDX-FileCopyrightText: © 2024 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { GroupServerPage } from '../settings/group-server/group-server.page';
import { PostViewerPage } from './post-viewer/post-viewer.page';

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
    private indexed: IndexedDBService,
    private modalCtrl: ModalController,
  ) { }

  async ngOnInit() {
    this.nakama.is_post_lock = true;
    if (!this.nakama.posts.length)
      await this.load_posts_counter();
    this.nakama.CommunityGoToEditPost = this.add_post;
  }

  add_post(info?: any) {
    this.navCtrl.navigateForward('portal/community/add-post', {
      state: {
        data: info,
        act: true,
      },
    });
  }

  ionViewDidEnter() {
    this.try_add_shortcut();
    // 스크롤이 내려가있다면 새로고침 처리(화면 변화 대응용)
    if (this.ContentDiv && this.ContentScroll)
      if (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 1)
        this.load_post_cycles();
  }

  ContentScroll: HTMLDivElement;
  ContentDiv: HTMLDivElement;
  /** 스크롤이 생성되지 않았다면 계속해서 게시물 업데이트  
   * 또는 스크롤이 최하단인 경우 업데이트
   */
  async load_post_cycles() {
    if (this.is_loadable)
      await this.load_posts();
    setTimeout(() => {
      if (!this.ContentDiv) this.ContentDiv = document.getElementById('CommunityMainContent') as HTMLDivElement;
      if (!this.ContentScroll) {
        this.ContentScroll = document.getElementById('CommunityScrollDiv') as HTMLDivElement;
        this.ContentScroll.onscroll = (_ev: any) => {
          if (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 1)
            this.load_post_cycles();
        }
      }
      if (this.is_loadable && (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 1))
        this.load_post_cycles();
    }, 50);
  }

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.AddShortcut();
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 더 불러올 게시물이 있는지 여부 */
  is_loadable = true;
  /** 사용자별 카운터 필요  
   * counter[isOfficial][target][user_id] = counter;
   */
  counter = {
    local: { target: { me: 0 } },
    official: {},
    unofficial: {},
  }

  /** 게시물 갯수 불러오기 (첫 실행시) */
  async load_posts_counter() {
    // 카운터 정보 업데이트
    let local_counter = Number(await this.indexed.loadTextFromUserPath('servers/local/target/posts/counter.txt')) || 0;
    this.counter.local.target.me = local_counter;
    let servers = this.nakama.get_all_server_info(true, true);
    for (let i = 0, j = servers.length; i < j; i++) {
      if (!this.counter[servers[i].isOfficial][servers[i].target])
        this.counter[servers[i].isOfficial][servers[i].target] = {};
      // 서버 갯수 업데이트
    }
    this.load_post_cycles();
  }

  /** 게시물 정보 하나씩 불러오기  
   * 게시물 카운터가 정보를 불러오지 못하면 다시 불러오기 시도, 카운터가 0 이하라면 더이상 재시도하지 않음
   */
  async load_posts() {
    let has_counter = false;
    let isOfficial = Object.keys(this.counter);
    for (let i = 0, j = isOfficial.length; i < j; i++) {
      let target = Object.keys(this.counter[isOfficial[i]]);
      for (let k = 0, l = target.length; k < l; k++) {
        let user_id = Object.keys(this.counter[isOfficial[i]][target[k]]);
        for (let m = 0, n = user_id.length; m < n; m++) {
          let counter = this.counter[isOfficial[i]][target[k]][user_id[m]];
          if (!has_counter && counter) has_counter = true;
          if (isOfficial[i] == 'local') { // 내 로컬 게시물 불러오기
            await this.load_local_post_step_by_step(counter);
          } else { // 서버 게시물, 다른 사람의 게시물 불러오기
            console.log(`서버 업데이트 행동 없음: ${isOfficial[i]}/${target[k]}/${user_id[m]}`);
            this.load_server_user_post_step_by_step(counter);
          }
        }
      }
    }
    this.is_loadable = has_counter;
    this.nakama.rearrange_posts();
  }

  /** 로컬 정보를 하나씩 업데이트 */
  async load_local_post_step_by_step(index: number) {
    if (index < 0) return;
    let v = await this.indexed.loadTextFromUserPath(`servers/local/target/posts/LocalPost_${index}/info.json`);
    if (v) {
      let json = JSON.parse(v);
      if (json['mainImage']) {
        if (json['mainImage']['url']) {
          json['mainImage']['thumbnail'] = json['mainImage']['url'];
        } else { // URL 주소가 아니라면 이미지 직접 불러오기
          let blob = await this.indexed.loadBlobFromUserPath(json['mainImage']['path'], json['mainImage']['type']);
          json['mainImage']['blob'] = blob;
          let FileURL = URL.createObjectURL(blob);
          json['mainImage']['thumbnail'] = FileURL;
          setTimeout(() => {
            URL.revokeObjectURL(FileURL);
          }, 100);
        }
      }
      this.nakama.posts_orig.local.target.me[json['id']] = json;
      this.counter.local.target.me--;
    } else {
      this.counter.local.target.me--;
      await this.load_local_post_step_by_step(this.counter.local.target.me);
    }
  }

  /** 서버별/사용자벌 게시물 정보 순차적으로 불러오기 */
  load_server_user_post_step_by_step(index: number) {
    if (index < 0) return;
  }

  /** 사용자 정보를 열람하는 경우 카드 열람 무시 */
  isOpenProfile = false;
  /** 작성자 정보 열기 */
  open_profile(info: any) {
    this.isOpenProfile = true;
    if (info['creator_id'] == 'local') { // 로컬 정보인 경우
      this.modalCtrl.create({
        component: GroupServerPage,
      }).then(v => v.present());
    } else { // 서버인 경우
      console.log('서버 작성자 검토: ', info);
    }
    setTimeout(() => {
      this.isOpenProfile = false;
    }, 0);
  }

  /** 게시글 읽기 */
  open_post(info: any) {
    if (this.isOpenProfile) return;
    this.isOpenProfile = true;
    this.modalCtrl.create({
      component: PostViewerPage,
      componentProps: {
        data: info,
      }
    }).then(v => {
      delete this.global.p5key['KeyShortCut']['Digit'];
      delete this.global.p5key['KeyShortCut']['AddAct'];
      v.onDidDismiss().then(v => {
        if (!v.data) this.AddShortcut();
      });
      v.present();
    });
    setTimeout(() => {
      this.isOpenProfile = false;
    }, 0);
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
        if (this.nakama.posts.length > index)
          this.open_post(this.nakama.posts[index]);
        else this.add_post();
      };
    }
    if (this.global.p5key && this.global.p5key['KeyShortCut']
      && !this.global.p5key['KeyShortCut']['AddAct'])
      this.global.p5key['KeyShortCut']['AddAct'] = () => {
        this.add_post();
      };
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Digit'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
    this.nakama.is_post_lock = false;
  }
}
