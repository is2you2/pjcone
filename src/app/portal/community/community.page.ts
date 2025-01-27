import { Component, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5LoadingService } from 'src/app/p5-loading.service';
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
    public global: GlobalActService,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private indexed: IndexedDBService,
    private p5loading: P5LoadingService,
  ) { }

  ngOnInit() {
    this.nakama.CommunityGoToEditPost = this.add_post;
    this.global.PortalBottonTabAct.Community = () => {
      if (this.ContentScroll) this.ContentScroll.scrollTo({ top: 0, behavior: 'smooth' })
    }
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
    this.global.portalHint = false;
  }

  /** 더 불러올 게시물이 있는지 여부 */
  is_loadable = true;
  /** 하단에 약간의 공간 보여주기 */
  is_auto_load_end = false;
  async ionViewDidEnter() {
    this.try_add_shortcut();
    this.is_loadable = true;
    this.forceBlockLoadable = false;
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

  forceBlockLoadable = false;
  /** 게시물 열기 */
  open_post(post: any, index: number) {
    if (post['offlineAct']) {
      this.QueueOfflineAct(post);
    } else {
      this.forceBlockLoadable = true;
      this.nakama.open_post(post, index, 'portal/community/');
    }
  }

  ContentScroll: HTMLDivElement;
  ContentDiv: HTMLDivElement;
  /** 다중 로딩 방지용 */
  loadBlock = false;
  /** 스크롤이 생성되지 않았다면 계속해서 게시물 업데이트  
   * 또는 스크롤이 최하단인 경우 업데이트
   */
  async load_post_cycles() {
    if (this.loadBlock) return;
    this.loadBlock = true;
    if (!this.forceBlockLoadable && this.is_loadable)
      await this.load_posts();
    this.loadBlock = false;
    setTimeout(() => {
      try {
        if (!this.ContentDiv) this.ContentDiv = document.getElementById('CommunityMainContent') as HTMLDivElement;
        if (!this.ContentScroll)
          this.ContentScroll = document.getElementById('CommunityScrollDiv') as HTMLDivElement;
        if (!this.ContentScroll.onscroll)
          this.ContentScroll.onscroll = (_ev: any) => {
            if (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 450)
              this.load_post_cycles();
          }
        if (this.is_loadable && (this.ContentDiv.clientHeight - (this.ContentScroll.scrollTop + this.ContentScroll.clientHeight) < 450))
          this.load_post_cycles();
      } catch (e) {
        console.log('게시물 스크롤 행동 생성 오류: ', e);
      }
    }, 100);
  }

  /** 포스트 우클릭시 행동 */
  PostContextMenu(index: number) {
    let CheckManagable = false;
    try {
      // 내가 작성한 게시물이라면 삭제 허용
      CheckManagable = this.nakama.posts[index]['server']['local'] ||
        this.nakama.posts[index]['creator_id'] == this.nakama.servers[this.nakama.posts[index]['server']['isOfficial']][this.nakama.posts[index]['server']['target']].session.user_id;
      // 해당 서버가 연결된 상태인지 확인
      if (!this.nakama.posts[index]['server']['local'])
        CheckManagable = CheckManagable && this.statusBar.groupServer[this.nakama.posts[index]['server']['isOfficial']][this.nakama.posts[index]['server']['target']] == 'online';
    } catch (e) {
      // 삭제된 서버의 내 게시물이라면 삭제 허용
      CheckManagable = this.nakama.posts[index].server.isOfficial == 'deleted';
    }
    CheckManagable = CheckManagable || this.nakama.posts[index].is_me;
    if (CheckManagable && this.nakama.posts[index]['offlineAct'] != 'remove')
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
    return false;
  }

  try_add_shortcut() {
    if (this.global.p5KeyShortCut)
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
    for (let _is_official of isOfficial) {
      let target = Object.keys(this.nakama.post_counter[_is_official]);
      for (let _target of target) {
        let userIds = Object.keys(this.nakama.post_counter[_is_official][_target]);
        for (let _userId of userIds) {
          let is_me = _userId == 'me';
          try { // 나인지 여부를 사전에 검토
            if (_userId != 'me') is_me = _userId == this.nakama.servers[_is_official][_target].session.user_id;
          } catch (e) { }
          let counter = this.nakama.post_counter[_is_official][_target][_userId];
          await this.load_post_step_by_step(counter, _is_official, _target, _userId, is_me);
          if (!has_counter && this.nakama.post_counter[_is_official][_target][_userId] >= 0) has_counter = true;
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
    if (!loaded && user_id != 'me') try { // 로컬에서 불러오기를 실패했다면 서버에서 불러오기를 시도 (서버 게시물만) / deleted 포함됨
      loaded = await this.nakama.load_server_post_with_id(`ServerPost_${index}`, isOfficial, target, user_id, is_me);
    } catch (e) { }
    if (loaded && user_id == 'me') {
      const post = this.nakama.posts_orig[isOfficial][target][user_id][`LocalPost_${index}`];
      // 오프라인 행동이 감지되었다면 추가 행동하기
      if (post['offlineAct']) this.QueueOfflineAct(post);
    }
    this.nakama.post_counter[isOfficial][target][user_id]--;
    if (!loaded) await this.load_post_step_by_step(this.nakama.post_counter[isOfficial][target][user_id], isOfficial, target, user_id, is_me);
  }

  /** 오프라인 행동이 필요한 대기열 */
  QueuedOfflineAct = [];
  /** 오프라인 행동을 추가하기 */
  QueueOfflineAct(postInfo: any) {
    this.QueuedOfflineAct.push(postInfo);
    if (!this.isOfflineActing) this.ApplyOfflineAct();
  }

  /** 오프라인 행동중인지 여부 */
  isOfflineActing = false;
  /** 오프라인 행동을 서버에 적용시키기 */
  async ApplyOfflineAct() {
    this.isOfflineActing = true;
    while (this.QueuedOfflineAct.length) {
      let postInfo = this.QueuedOfflineAct.shift();
      let OriginalInfo = postInfo['originalInfo'];
      const isOfficial = OriginalInfo?.server.isOfficial || postInfo.server.isOfficial;
      const target = OriginalInfo?.server.target || postInfo.server.target;
      const actId = 'postOfflineAct';
      // 해당 서버에 연결되어있지 않으면 건너뛰기
      if (this.statusBar.groupServer[isOfficial][target] != 'online') continue;
      switch (postInfo['offlineAct']) {
        case 'edit':
          const editedPost = JSON.parse(JSON.stringify(postInfo));
          // 원본 정보에서 마지막 편집본에 필요한 정보 이관 후 원본 정보 삭제하기 (url 유지 등)
          let duplicate_keys = ['id', 'UserColor', 'creator_id', 'server', 'OutSource'];
          duplicate_keys.forEach(key => postInfo[key] = OriginalInfo[key]);
          delete postInfo['offlineAct'];
          delete postInfo['originalInfo'];
          // 첨부파일 blob 준비하기
          // 보편적인 경우 mainImage 는 준비가 되어있으나 안되어있는 경우를 대비함
          if (postInfo['mainImage']?.['path'] && !postInfo['mainImage']['blob'])
            postInfo['mainImage']['blob'] = await this.indexed.loadBlobFromUserPath(postInfo['mainImage']['path'], postInfo['mainImage']['type']);
          // 모든 첨부파일의 blob 준비, 썸네일 정보 삭제
          for (let i = 0, j = postInfo?.['attachments'].length; i < j; i++) {
            if (postInfo['attachments'][i]?.['path'] && !postInfo['attachments'][i]['blob'])
              postInfo['attachments'][i]['blob'] = await this.indexed.loadBlobFromUserPath(postInfo['attachments'][i]['path'], postInfo['attachments'][i]['type']);
            delete postInfo['attachments'][i]['thumbnail'];
          }
          await this.p5loading.update({
            id: actId,
            message: `${this.lang.text['AddPost']['WIP']}: ${postInfo['title']}`,
            progress: null,
            forceEnd: null,
          });
          // 원본 정보 삭제처리
          await this.nakama.RemovePost(OriginalInfo, undefined, actId);
          await this.nakama.AddPost(postInfo, actId, Boolean(2), false, postInfo['mainImage']?.['thumbnail']);
          await this.nakama.RemovePost(editedPost, undefined, actId);
          this.nakama.rearrange_posts();
          await this.p5loading.update({
            id: actId,
            message: `${this.lang.text['AddPost']['WIP']}: ${postInfo['title']}`,
            progress: 1,
            forceEnd: 350,
          });
          // 처리가 완료되었으면 첨부파일 정보는 무시하기
          for (let i = 0, j = postInfo?.['attachments'].length; i < j; i++)
            delete postInfo['attachments'][i]['blob'];
          break;
        case 'remove':
          await this.nakama.RemovePost(OriginalInfo, undefined, actId);
          await this.nakama.RemovePost(postInfo, undefined, actId);
          this.p5loading.remove(actId);
          this.nakama.rearrange_posts();
          break;
      }
    }
    this.isOfflineActing = false;
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5KeyShortCut) {
      this.global.p5KeyShortCut['Digit'] = (index: number) => {
        if (this.nakama.posts.length > index)
          this.open_post(this.nakama.posts[index], index);
        else this.add_post();
      };
    }
    if (this.global.p5KeyShortCut && !this.global.p5KeyShortCut['AddAct'])
      this.global.p5KeyShortCut['AddAct'] = () => {
        this.add_post();
      };
  }

  ionViewWillLeave() {
    delete this.global.p5KeyShortCut['Digit'];
    delete this.global.p5KeyShortCut['AddAct'];
    delete this.nakama.socket_reactive['try_load_post'];
    if (this.ContentScroll) this.ContentScroll.onscroll = null;
  }
}
