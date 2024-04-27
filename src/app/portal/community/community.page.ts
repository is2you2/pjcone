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
import { OthersProfilePage } from 'src/app/others-profile/others-profile.page';

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

  ngOnInit() {
    this.nakama.is_post_lock = true;
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

  /** 더 불러올 게시물이 있는지 여부 */
  is_loadable = true;
  /** 하단에 약간의 공간 보여주기 */
  is_auto_load_end = false;
  async ionViewDidEnter() {
    this.is_loadable = true;
    await this.nakama.load_posts_counter();
    this.nakama.has_new_post = false;
    await this.load_post_cycles();
    this.is_auto_load_end = true;
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
    }, 100);
  }

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.AddShortcut();
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 게시물 정보 하나씩 불러오기  
   * 게시물 카운터가 정보를 불러오지 못하면 다시 불러오기 시도, 카운터가 0 이하라면 더이상 재시도하지 않음
   */
  async load_posts() {
    let has_counter = false;
    let isOfficial = Object.keys(this.nakama.post_counter);
    for (let i = 0, j = isOfficial.length; i < j; i++) {
      let target = Object.keys(this.nakama.post_counter[isOfficial[i]]);
      for (let k = 0, l = target.length; k < l; k++) {
        let user_id = Object.keys(this.nakama.post_counter[isOfficial[i]][target[k]]);
        for (let m = 0, n = user_id.length; m < n; m++) {
          let counter = this.nakama.post_counter[isOfficial[i]][target[k]][user_id[m]];
          await this.load_post_step_by_step(counter, isOfficial[i], target[k], user_id[m]);
          if (!has_counter && this.nakama.post_counter[isOfficial[i]][target[k]][user_id[m]] >= 0) has_counter = true;
        }
      }
    }
    this.is_loadable = has_counter;
    this.nakama.rearrange_posts();
  }

  /** 로컬 정보를 하나씩 업데이트 */
  async load_post_step_by_step(index: number, isOfficial: string, target: string, user_id: string) {
    if (index < 0) return;
    let loaded = await this.nakama.load_local_post_with_id(`LocalPost_${index}`, isOfficial, target, user_id);
    if (!loaded && user_id != 'me') try { // 로컬에서 불러오기를 실패했다면 서버에서 불러오기를 시도 (서버 게시물만)
      loaded = await this.load_server_post_with_id(`ServerPost_${index}`, isOfficial, target, user_id);
    } catch (e) { }
    this.nakama.post_counter[isOfficial][target][user_id]--;
    if (!loaded) await this.load_post_step_by_step(this.nakama.post_counter[isOfficial][target][user_id], isOfficial, target, user_id);
  }

  /** 아이디로 서버 포스트 불러오기 */
  async load_server_post_with_id(post_id: string, isOfficial: string, target: string, user_id: string): Promise<boolean> {
    try {
      let info = {
        path: `servers/${isOfficial}/${target}/posts/${user_id}/${post_id}/info.json`,
        type: 'text/plain',
      }
      let res = await this.nakama.sync_load_file(info, isOfficial, target, 'server_post', user_id, post_id, false);
      let text = await res.value.text();
      let json = JSON.parse(text);
      json['server'] = {
        name: this.nakama.servers[isOfficial][target].info.name,
        isOfficial: isOfficial,
        target: target,
      }
      if (json['mainImage']) {
        if (json['mainImage']['url']) {
          json['mainImage']['thumbnail'] = json['mainImage']['url'];
        } else { // URL 주소가 아니라면 이미지 직접 불러오기
          let info = {
            path: `servers/${isOfficial}/${target}/posts/${user_id}/${post_id}/mainImage.png`,
            type: 'image/png',
          }
          let blob = (await this.nakama.sync_load_file(info, isOfficial, target, 'server_post', user_id, `${post_id}_mainImage`, false)).value;
          json['mainImage']['blob'] = blob;
          let FileURL = URL.createObjectURL(blob);
          json['mainImage']['thumbnail'] = FileURL;
          setTimeout(() => {
            URL.revokeObjectURL(FileURL);
          }, 100);
        }
      }
      if (!this.nakama.posts_orig[isOfficial][target])
        this.nakama.posts_orig[isOfficial][target] = {};
      if (!this.nakama.posts_orig[isOfficial][target][user_id])
        this.nakama.posts_orig[isOfficial][target][user_id] = {};
      this.nakama.posts_orig[isOfficial][target][user_id][post_id] = json;
      // 로컬에서 불러왔다면 원격에 남은 정보인지 검토
      if (res.from == 'local') {
        try {
          let RemoteExist = await this.nakama.servers[isOfficial][target].client.readStorageObjects(
            this.nakama.servers[isOfficial][target].session, {
            object_ids: [{
              collection: 'server_post',
              key: post_id,
              user_id: user_id,
            }],
          });
          if (!RemoteExist.objects.length)
            throw 'Not RemoteExist';
        } catch (e) {
          if (e == 'Not RemoteExist') throw 'RemoveSelf';
        }
      }
      return true;
    } catch (e) {
      // 서버에서 삭제된 게시물이라면 로컬에서도 자료를 삭제
      if (e == 'RemoveSelf')
        this.nakama.RemovePost(this.nakama.posts_orig[isOfficial][target][user_id][post_id], true);
      return false;
    }
  }

  /** 사용자 정보를 열람하는 경우 카드 열람 무시 */
  isOpenProfile = false;
  /** 작성자 정보 열기 */
  open_profile(info: any) {
    this.isOpenProfile = true;
    if (info['creator_id'] == 'me') { // 로컬 정보인 경우
      this.modalCtrl.create({
        component: GroupServerPage,
      }).then(v => v.present());
    } else { // 서버인 경우
      let isOfficial = info['server']['isOfficial'];
      let target = info['server']['target'];
      let targetUid = info['creator_id'];
      if (targetUid == this.nakama.servers[isOfficial][target].session.user_id) {
        this.modalCtrl.create({
          component: GroupServerPage,
          componentProps: {
            isOfficial: isOfficial,
            target: target,
          }
        }).then(v => v.present());
      } else {
        this.modalCtrl.create({
          component: OthersProfilePage,
          componentProps: {
            info: { user: this.nakama.load_other_user(targetUid, isOfficial, target) },
            group: {
              server: {
                isOfficial: isOfficial,
                target: target,
              },
            },
          }
        }).then(v => v.present());
      }
    }
    setTimeout(() => {
      this.isOpenProfile = false;
    }, 0);
  }

  /** 게시글 읽기 */
  open_post(info: any, index: number) {
    if (this.isOpenProfile) return;
    this.isOpenProfile = true;
    this.modalCtrl.create({
      component: PostViewerPage,
      componentProps: {
        data: info,
        index: index + 1,
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
          this.open_post(this.nakama.posts[index], index);
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
