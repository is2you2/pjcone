import { Component, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';

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
    private alertCtrl: AlertController,
  ) { }

  ngOnInit() {
    this.nakama.is_post_lock = true;
    this.nakama.CommunityGoToEditPost = this.add_post;
  }

  add_post(info?: any) {
    this.global.RemoveAllModals(() => {
      this.navCtrl.navigateForward('portal/community/add-post', {
        state: {
          data: info,
          act: true,
        },
      });
    });
  }

  /** 더 불러올 게시물이 있는지 여부 */
  is_loadable = true;
  /** 하단에 약간의 공간 보여주기 */
  is_auto_load_end = false;
  async ionViewDidEnter() {
    this.try_add_shortcut();
    this.is_loadable = true;
    await this.nakama.load_posts_counter();
    this.nakama.has_new_post = false;
    await this.load_post_cycles();
    this.is_auto_load_end = true;
    // 스크롤이 내려가있다면 새로고침 처리(화면 변화 대응용)
    if (this.ContentDiv && this.ContentScroll)
      if (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 450)
        this.load_post_cycles();
    this.nakama.socket_reactive['try_load_post'] = () => {
      setTimeout(() => {
        if (this.ContentDiv && this.ContentScroll)
          if (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 450)
            this.load_post_cycles();
      }, 0);
    }
  }

  ContentScroll: HTMLDivElement;
  ContentDiv: HTMLDivElement;
  /** 스크롤이 생성되지 않았다면 계속해서 게시물 업데이트  
   * 또는 스크롤이 최하단인 경우 업데이트
   */
  async load_post_cycles() {
    if (this.is_loadable)
      await this.load_posts();
    if (this.is_loadable) // 한번에 두번씩 시도함
      await this.load_posts();
    setTimeout(() => {
      if (!this.ContentDiv) this.ContentDiv = document.getElementById('CommunityMainContent') as HTMLDivElement;
      if (!this.ContentScroll) {
        this.ContentScroll = document.getElementById('CommunityScrollDiv') as HTMLDivElement;
        this.ContentScroll.onscroll = (_ev: any) => {
          if (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 450)
            this.load_post_cycles();
        }
      }
      if (this.is_loadable && (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 450))
        this.load_post_cycles();
    }, 100);
  }

  /** 포스트 우클릭시 행동 */
  PostContextMenu(index: number) {
    try {
      if (this.nakama.posts[index]['server']['local'] ||
        this.nakama.posts[index]['creator_id'] == this.nakama.servers[this.nakama.posts[index]['server']['isOfficial']][this.nakama.posts[index]['server']['target']].session.user_id)
        this.alertCtrl.create({
          header: this.nakama.posts[index]['title'],
          message: this.nakama.posts[index]['content'],
          buttons: [{
            text: this.lang.text['ChatRoom']['EditChat'],
            handler: () => {
              this.nakama.EditPost(this.nakama.posts[index]);
            }
          }, {
            text: this.lang.text['ChatRoom']['Delete'],
            handler: () => {
              this.nakama.RemovePost(this.nakama.posts[index]);
            },
            cssClass: 'redfont',
          }],
        }).then(v => v.present());
    } catch (e) { } // 온라인 상태가 아님
    return false;
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
          let is_me = user_id[m] == 'me';
          try { // 나인지 여부를 사전에 검토
            if (user_id[m] != 'me') is_me = user_id[m] == this.nakama.servers[isOfficial[i]][target[k]].session.user_id;
          } catch (e) { }
          let counter = this.nakama.post_counter[isOfficial[i]][target[k]][user_id[m]];
          await this.load_post_step_by_step(counter, isOfficial[i], target[k], user_id[m], is_me);
          if (!has_counter && this.nakama.post_counter[isOfficial[i]][target[k]][user_id[m]] >= 0) has_counter = true;
        }
      }
    }
    this.is_loadable = has_counter;
    this.nakama.rearrange_posts();
  }

  /** 로컬 정보를 하나씩 업데이트 */
  async load_post_step_by_step(index: number, isOfficial: string, target: string, user_id: string, is_me: boolean) {
    if (index < 0) return;
    let loaded = await this.nakama.load_local_post_with_id(`LocalPost_${index}`, isOfficial, target, user_id);
    if (!loaded && user_id != 'me') try { // 로컬에서 불러오기를 실패했다면 서버에서 불러오기를 시도 (서버 게시물만)
      loaded = await this.nakama.load_server_post_with_id(`ServerPost_${index}`, isOfficial, target, user_id, is_me);
    } catch (e) { }
    this.nakama.post_counter[isOfficial][target][user_id]--;
    if (!loaded) await this.load_post_step_by_step(this.nakama.post_counter[isOfficial][target][user_id], isOfficial, target, user_id, is_me);
  }

  /** 하단 탭 단축키 캐싱된 정보 */
  BottomTabShortcut: any;
  /** 하단 탭 단축키 캐싱 */
  catchBottomTabShortCut() {
    this.BottomTabShortcut = this.global.p5key['KeyShortCut']['BottomTab'];
    delete this.global.p5key['KeyShortCut']['BottomTab'];
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
        if (this.nakama.posts.length > index)
          this.nakama.open_post(this.nakama.posts[index], index);
        else this.add_post();
      };
    }
    if (this.global.p5key && this.global.p5key['KeyShortCut']
      && !this.global.p5key['KeyShortCut']['AddAct'])
      this.global.p5key['KeyShortCut']['AddAct'] = () => {
        this.add_post();
      };
    if (this.BottomTabShortcut) {
      this.global.p5key['KeyShortCut']['BottomTab'] = this.BottomTabShortcut;
      this.BottomTabShortcut = undefined;
    }
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Digit'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
    delete this.nakama.socket_reactive['try_load_post'];
    this.nakama.is_post_lock = false;
  }
}
