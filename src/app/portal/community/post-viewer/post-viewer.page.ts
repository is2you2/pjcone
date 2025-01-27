import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonPopover, NavController } from '@ionic/angular';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { GlobalActService } from 'src/app/global-act.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { IonModal } from '@ionic/angular/common';
import * as marked from "marked";
import { P5LoadingService } from 'src/app/p5-loading.service';
import { StatusManageService } from 'src/app/status-manage.service';

@Component({
  selector: 'app-post-viewer',
  templateUrl: './post-viewer.page.html',
  styleUrls: ['./post-viewer.page.scss'],
})
export class PostViewerPage implements OnInit, OnDestroy {

  constructor(
    private navCtrl: NavController,
    public lang: LanguageSettingService,
    private indexed: IndexedDBService,
    public nakama: NakamaService,
    private alertCtrl: AlertController,
    public global: GlobalActService,
    private p5toast: P5ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private p5loading: P5LoadingService,
    private statusBar: StatusManageService,
  ) { }

  PostInfo: any = {};
  isOwner = false;
  HavePosts = false;
  /** 불러와진 모든 포스트 기준 현재 게시물 번호 */
  CurrentIndex = 1;

  /** 파일 읽기 멈추기 위한 컨트롤러 */
  cont: AbortController;

  postMenuId = 'postMenuId';
  /** 메뉴가 열렸을 때 숫자키 단축키 활성 */
  DigitShortcutAct: Function[] = [];
  @ViewChild('PostViewMenu') PostViewMenu: IonPopover;
  /** 게시물 메뉴 열기 */
  OpenFileMenu() {
    this.PostViewMenu.onDidDismiss().then(() => {
      this.DigitShortcutAct.length = 0;
      this.global.RestoreShortCutAct('postview-menu');
    });
    this.global.StoreShortCutAct('postview-menu');
    this.DigitShortcutAct.push(() => this.ToggleFocusMode());
    if (this.isOwner && this.CurrentIndex >= 0) {
      this.DigitShortcutAct.push(() => this.EditPost());
      this.DigitShortcutAct.push(() => this.RemovePost());
    }
    this.PostViewMenu.present();
  }

  /** 집중 모드 켜기, 메뉴들이 전부 숨겨집니다 */
  ToggleFocusMode() {
    this.PostViewMenu.dismiss();
    this.global.ToggleFullScreen();
  }

  LastPickedRouter = 'portal/community/';

  ngOnInit() {
    this.postMenuId = `postMenuId_${Date.now()}`;
    this.ModalDismissId = `postviewer_modal_${Date.now()}`;
    this.cont = new AbortController();
    this.route.queryParams.subscribe(_p => {
      try {
        const navParams = this.router.getCurrentNavigation().extras.state;
        this.PostInfo = navParams.data;
        this.LastPickedRouter = this.PostInfo['router'];
        this.ScrollPostId = `ScrollPostId_${Date.now()}`;
        this.PostContentId = `PostContentId_${Date.now()}`;
        this.CurrentIndex = navParams.index;
      } catch (e) { }
    });
    this.RelevancesInputId = `post-viewer_RelevancesInputId_${Date.now}`;
  }

  WaitingLoaded = false;
  /** 정확히 현재 페이지가 처리되어야하는 경우 사용 */
  async WaitingCurrent() {
    while (!this.WaitingLoaded) {
      await new Promise((done) => setTimeout(done, 0));
    }
  }
  BackButtonPressed = false;
  ionViewWillEnter() {
    this.global.portalHint = false;
    if (this.IsFocusOnHere) this.initialize();
    this.WaitingLoaded = true;
    this.global.StoreShortCutAct('post-viewer');
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
    this.IsFocusOnHere = true;
  }
  ScrollDiv: HTMLDivElement;
  ScrollPostId = 'ScrollPostId';
  /** 블렌더 파일 불러오기에 사용된 개체들 */
  blenderViewers: p5[] = [];
  /** 동영상, 음성 파일은 URL을 기록하고 있기 */
  FileURLs = [];
  /** 재생이 가능한 동영상, 음성 개체 기록  
   * 특정 재생기가 동작하면 다른 재생기들은 전부 멈추게 구성함
   */
  PlayableElements = [];
  /** 이 페이지를 보고 있는지 */
  IsFocusOnHere = true;
  /** 첨부파일을 게시된 순서대로 기억하기 (게시물 정보) */
  RearrangedRelevance = [];
  /** 첨부파일 개체 기억하기 (elements) */
  RearrangedContents = [];
  /** 게시물 창이 2개씩 뜰 수 있으니 아이디 별도관리하기 */
  ModalDismissId = 'postviewer_modal';
  /** PC에서 키를 눌러 컨텐츠 전환 */
  ChangeContentWithKeyInput() {
    if (this.p5canvas) {
      if (!this.ScrollDiv) this.ScrollDiv = document.getElementById(this.ScrollPostId) as HTMLDivElement;
      // 단축키 행동
      this.p5canvas.keyPressed = async (ev) => {
        if (!this.IsFocusOnHere) return;
        switch (ev['code']) {
          case 'KeyW': // 위로 스크롤
            if (ev['shiftKey']) {
              this.ToggleFocusMode();
            } else this.ScrollDiv.scrollTo({ top: this.ScrollDiv.scrollTop - this.ScrollDiv.clientHeight / 2, behavior: 'smooth' });
            break;
          case 'KeyS': // 아래로 스크롤
            this.ScrollDiv.scrollTo({ top: this.ScrollDiv.scrollTop + this.ScrollDiv.clientHeight / 2, behavior: 'smooth' });
            break;
          case 'KeyA': // 왼쪽 이동
          case 'ArrowLeft':
            this.ChangeToAnother(-1);
            break;
          case 'KeyE': // 빠른 편집
            if (ev['shiftKey']) this.EditPost();
            break;
          case 'KeyD': // 오른쪽 이동
            // 빠른 삭제 단축키
            if (ev['shiftKey']) this.RemovePost();
          case 'ArrowRight':
            if (!ev['shiftKey']) this.ChangeToAnother(1);
            break;
          case 'KeyF':
            this.OpenFileMenu();
            break;
          case 'KeyQ': // 첫번째 첨부파일 열기
            if (!this.RearrangedRelevance.length) return;
            this.global.PageDismissAct[this.ModalDismissId] = (v: any) => {
              this.ExitModalAct(v);
            }
            let _is_official: string;
            let _target: string;
            let creator: string;
            try {
              creator = this.PostInfo.creator_id;
              _is_official = this.PostInfo.server.isOfficial;
              _target = this.PostInfo.server.target;
            } catch (e) {
              _is_official = 'local';
            }
            this.IsFocusOnHere = false;
            this.global.ActLikeModal(`${this.LastPickedRouter}post-viewer/ionic-viewer`, {
              info: {
                ...this.RearrangedRelevance[0],
                sender_id: creator,
              },
              isOfficial: _is_official,
              target: _target,
              path: this.RearrangedRelevance[0].content['path'],
              relevance: this.RearrangedRelevance,
              noEdit: true,
              dismiss: this.ModalDismissId,
            });
            break;
          case 'Digit1':
          case 'Digit2':
          case 'Digit3':
          case 'Digit4':
          case 'Digit5':
          case 'Digit6':
          case 'Digit7':
          case 'Digit8':
          case 'Digit9':
            const exact_index = (Number(ev['code'].slice(-1)) - 1 + 10) % 10;
            this.DigitShortcutAct[exact_index]?.();
            break;
        }
      }
      // 터치 행동
      let startPos: p5.Vector = this.p5canvas.createVector();
      let touches: { [id: string]: p5.Vector } = {};
      this.p5canvas.touchStarted = (ev: any) => {
        if (!this.IsFocusOnHere) return;
        if ('changedTouches' in ev) {
          for (let i = 0, j = ev.changedTouches.length; i < j; i++)
            touches[ev.changedTouches[i].identifier] =
              this.p5canvas.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
          let size = Object.keys(touches).length;
          switch (size) {
            case 1: // 첫 탭
              startPos = touches[ev.changedTouches[0].identifier].copy();
              break;
            default: // 그 이상은 무시
              break;
          }
        }
      }
      const SWIPE_SIZE = 100;
      this.p5canvas.touchEnded = (ev: any) => {
        if (!this.IsFocusOnHere) return;
        if ('changedTouches' in ev) {
          let lastPos: p5.Vector;
          for (let i = 0, j = ev.changedTouches.length; i < j; i++) {
            lastPos = this.p5canvas.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
            delete touches[ev.changedTouches[i].identifier];
          }
          let size = Object.keys(touches).length;
          switch (size) {
            case 0: // 손을 전부 뗌
              lastPos.sub(startPos);
              if (lastPos.x > SWIPE_SIZE)
                this.ChangeToAnother(-1);
              else if (lastPos.x < -SWIPE_SIZE)
                this.ChangeToAnother(1);
              break;
          }
        }
      }
    }
  }

  /** 페이지 돌아오기 공통 행동 */
  async ExitModalAct(v: any) {
    await this.WaitingCurrent();
    if (v.data && v.data['share']) this.navCtrl.pop();
    this.IsFocusOnHere = true;
    // 게시된 콘텐츠에 한해서 행동
    if (v.index < this.RearrangedContents.length)
      this.RearrangedContents[v.index].elt?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    delete this.global.PageDismissAct[this.ModalDismissId];
  }

  /** 진입 정보를 어떻게 활용할 것인가 */
  initialize() {
    this.RearrangedRelevance.length = 0;
    this.RearrangedContents.length = 0;
    if (this.PostInfo['mainImage']) {
      try {
        let FileURL = this.PostInfo['mainImage']['url'];
        if (!FileURL) {
          FileURL = URL.createObjectURL(this.PostInfo['mainImage']['blob']);
          setTimeout(() => {
            URL.revokeObjectURL(FileURL);
          }, 100);
        }
        this.PostInfo['mainImage']['MainThumbnail'] = FileURL;
      } catch (e) { }
    }
    this.create_content();
    try {
      this.isOwner = this.PostInfo['creator_id'] == 'me'
        || this.PostInfo['creator_id'] == this.nakama.servers[this.PostInfo['server']['isOfficial']][this.PostInfo['server']['target']].session.user_id;
      // 해당 서버가 연결된 상태인지 확인
      if (this.PostInfo['creator_id'] != 'me')
        this.isOwner = this.isOwner && this.statusBar.groupServer[this.PostInfo['server']['isOfficial']][this.PostInfo['server']['target']] == 'online';
    } catch (e) {
      this.isOwner = false;
    }
    this.isOwner = this.isOwner || this.PostInfo['is_me'];
    this.HavePosts = this.nakama.posts.length > 1 && this.CurrentIndex >= 0;
    this.ChangeContentWithKeyInput();
  }

  /** 터치 상호작용 보완용 */
  ContentChanging = false;
  /** 게시물 전환 */
  async ChangeToAnother(direction: number) {
    if (this.ContentChanging) return;
    this.ContentChanging = true;
    let tmp_calced = this.CurrentIndex + direction;
    if (tmp_calced <= 0 || tmp_calced > this.nakama.posts.length) {
      this.ContentChanging = false;
      await this.p5loading.update({
        id: 'postviewer',
        message: `${this.lang.text['ContentViewer']['EndOfList']}: ${this.CurrentIndex} / ${this.nakama.posts.length}`,
        progress: 1,
        forceEnd: 350,
      });
      return;
    }
    this.ScrollDiv.scrollTo({ top: 0 });
    if (this.p5canvas) this.p5canvas.remove();
    this.CurrentIndex = tmp_calced;
    await this.p5loading.update({
      id: 'postviewer',
      message: `${this.lang.text['PostViewer']['PreparingPost']}: ${this.nakama.posts[this.CurrentIndex - 1]?.title} (${this.CurrentIndex} / ${this.nakama.posts.length})`,
      progress: null,
      forceEnd: null,
    });
    this.PostInfo = this.nakama.posts[this.CurrentIndex - 1];
    this.CanInputValue = false;
    this.initialize();
  }

  QRCodeSRC: any;
  ResultSharedAddress: any;
  @ViewChild('QuickPostView') QuickPostView: IonModal;
  p5canvas: p5;
  PostContentId = 'PostContentId';
  AlreadyHaveGodot = false;
  /** 내용에 파일 뷰어를 포함한 구성 만들기 */
  create_content() {
    let contentDiv = document.getElementById(this.PostContentId);
    this.p5canvas = new p5((p: p5) => {
      p.setup = async () => {
        p.noCanvas();
        // 제목
        let title = p.createDiv(`${this.PostInfo['OutSource'] ? '<ion-icon id="title_link" style="cursor: pointer;" slot="start" name="link-outline"></ion-icon> ' : ''}${this.PostInfo['title']}`);
        if (this.PostInfo['OutSource']) {
          let link = document.getElementById('title_link');
          link.onclick = async () => {
            this.ResultSharedAddress = '';
            // 사용자 지정 서버가 있는지 검토우회
            this.ResultSharedAddress = `${await this.global.GetHeaderAddress()}?postViewer=${this.PostInfo['OutSource']}`;
            // QRCode 이미지 생성
            this.QRCodeSRC = this.global.readasQRCodeFromString(this.ResultSharedAddress);
            this.QuickPostView.onDidDismiss().then(() => {
              this.global.RestoreShortCutAct('quick-post-view');
            });
            this.global.StoreShortCutAct('quick-post-view');
            this.QuickPostView.present();
          }
        }
        title.style('font-size', '32px');
        title.style('font-weight', 'bold');
        title.parent(contentDiv);
        // 작성일
        let datetime = p.createDiv();
        datetime.style('color', '#888');
        let create_time = p.createDiv(`${this.lang.text['PostViewer']['CreateTime']}: ${new Date(this.PostInfo['create_time']).toLocaleString()}`);
        create_time.parent(datetime);
        if (this.PostInfo['create_time'] != this.PostInfo['modify_time']) {
          let modify_time = p.createDiv(`${this.lang.text['PostViewer']['ModifyTime']}: ${new Date(this.PostInfo['modify_time']).toLocaleString()}`);
          modify_time.parent(datetime);
        }
        datetime.parent(contentDiv);
        // 작성자
        let catch_name: string;
        try {
          catch_name = this.nakama.usernameOverride[this.PostInfo['server']['isOfficial']][this.PostInfo['server']['target']][this.PostInfo['creator_id']] || this.PostInfo['creator_name'];
        } catch (e) {
          catch_name = this.PostInfo['creator_name'];
        }
        let creator = p.createSpan(catch_name);
        creator.style('color', `#${this.PostInfo['UserColor']}`);
        creator.style('font-weight', 'bold');
        creator.style('font-size', '17px');
        creator.style('cursor', 'pointer');
        creator.mouseClicked(() => {
          if (this.PostInfo['creator_id'] == 'me') {
            this.nakama.open_profile_page();
          } else try {// 서버 사용자 검토
            let isOfficial = this.PostInfo['server']['isOfficial'];
            let target = this.PostInfo['server']['target'];
            let targetUid = this.PostInfo['creator_id'];
            if (targetUid == this.nakama.servers[isOfficial][target].session.user_id) {
              this.nakama.open_profile_page({
                isOfficial: isOfficial,
                target: target,
              });
            } else {
              this.nakama.open_others_profile({
                info: { user: this.nakama.load_other_user(targetUid, isOfficial, target) },
                group: {
                  server: {
                    isOfficial: isOfficial,
                    target: target,
                  },
                },
              });
            }
          } catch (e) {
            this.p5toast.show({
              text: `${this.lang.text['PostViewer']['CannotOpenProfile']}: ${e}`,
            });
          }
        });
        creator.parent(contentDiv);
        // 게시물 상태를 표시해줌
        if (this.PostInfo['offlineAct']) {
          let infoText = '';
          switch (this.PostInfo['offlineAct']) {
            case 'edit':
              infoText = this.lang.text['Community']['AfterOnline'];
              break;
            case 'remove':
              infoText = this.lang.text['Community']['WillBeRemove'];
              break;
          }
          const postInfo = p.createSpan(` (${infoText})`);
          postInfo.style('color: #888; font-weight: normal;');
          postInfo.parent(creator);
        }
        // 첨부파일 검토용 index 구성
        let RelevanceIndexes = [];
        // 내용
        if (this.PostInfo['content']) {
          let content: any[] = (await marked.marked(this.PostInfo['content'])).split('\n');
          /** 내용이 전부 불러와지고나면 하는 행동  
          * 보통 재생 가능한 콘텐츠가 준비될 때 해당 콘텐츠가 마지막에 로딩되는 것을 고려하여 구성됨
          */
          let AfterAllAct: Function[] = [];
          for (let i = 0, j = content.length; i < j; i++) {
            // 첨부파일인지 체크
            let is_attach = false;
            let content_len = content[i].length - 1;
            let index = 0;
            try {
              let endOfContent = content[i].indexOf('}</p>');
              index = Number(content[i].substring(4, endOfContent));
              is_attach = content[i].indexOf('<p>{') == 0 && content[i].indexOf('}</p>') == (content_len - 4) && !isNaN(index);
            } catch (e) { }
            if (is_attach) {
              this.p5loading.update({
                id: 'postviewer',
                message: `${this.lang.text['PostViewer']['PreparingPost']}: ${this.PostInfo['attachments'][index]['filename']} (${this.CurrentIndex} / ${this.nakama.posts.length})`,
                progress: index / this.PostInfo['attachments'].length,
                forceEnd: null,
              });
              if (!Number.isNaN(index) && !RelevanceIndexes.includes(index))
                RelevanceIndexes.push(index);
              // 첨부파일 불러오기
              if (this.PostInfo['server']['local'])
                try {
                  if (this.PostInfo['attachments'][index]['blob']) throw 'blob 준비되어있음';
                  let blob = await this.indexed.loadBlobFromUserPath(this.PostInfo['attachments'][index]['path'], this.PostInfo['attachments'][index]['type']);
                  this.PostInfo['attachments'][index]['blob'] = blob;
                } catch (e) { }
              else try {
                if (this.PostInfo['attachments'][index]['blob']) throw 'blob 준비되어있음';
                this.PostInfo['attachments'][index].alt_path = `servers/${this.PostInfo['server']['isOfficial']}/${this.PostInfo['server']['target']}/posts/${this.PostInfo.creator_id}/${this.PostInfo.id}/[${i}]${this.PostInfo['attachments'][i].filename}`;
                let blob = await this.nakama.sync_load_file(
                  this.PostInfo['attachments'][index], this.PostInfo['server']['isOfficial'], this.PostInfo['server']['target'], 'server_post',
                  this.PostInfo['creator_id'], `${this.PostInfo['id']}_attach_${index}`, false);
                this.PostInfo['attachments'][index]['blob'] = blob.value;
              } catch (e) { }
              switch (this.PostInfo['attachments'][index]['viewer']) {
                case 'image': {
                  let FileURL = this.PostInfo['attachments'][index]['url'];
                  if (!FileURL) try {
                    FileURL = URL.createObjectURL(this.PostInfo['attachments'][index]['blob']);
                    setTimeout(() => {
                      URL.revokeObjectURL(FileURL)
                    }, 100);
                  } catch (e) {
                    console.log('게시물 image 첨부파일 불러오기 오류: ', e);
                  }
                  let pimg = p.createP();
                  pimg.parent(contentDiv);
                  let img = p.createImg(FileURL, `${index}`);
                  img.style('cursor', 'pointer');
                  img.mouseClicked(() => {
                    this.global.PageDismissAct[this.ModalDismissId] = (v: any) => {
                      this.ExitModalAct(v);
                    }
                    let _is_official: string;
                    let _target: string;
                    let creator: string;
                    try {
                      creator = this.PostInfo.creator_id;
                      _is_official = this.PostInfo.server.isOfficial;
                      _target = this.PostInfo.server.target;
                    } catch (e) {
                      _is_official = 'local';
                    }
                    this.IsFocusOnHere = false;
                    let json = JSON.parse(JSON.stringify(this.PostInfo['attachments'][index]))
                    json['filename'] = `[${index}] ${json['filename']}`;
                    this.global.ActLikeModal(`${this.LastPickedRouter}post-viewer/ionic-viewer`, {
                      info: {
                        content: json,
                        sender_id: creator,
                      },
                      isOfficial: _is_official,
                      target: _target,
                      path: this.PostInfo['attachments'][index]['path'],
                      relevance: this.RearrangedRelevance,
                      noEdit: true,
                      dismiss: this.ModalDismissId,
                    });
                  });
                  img.parent(pimg);
                  content[i] = pimg;
                }
                  break;
                case 'audio': {
                  let FileURL = this.PostInfo['attachments'][index]['url'];
                  if (!FileURL) try {
                    FileURL = URL.createObjectURL(this.PostInfo['attachments'][index]['blob']);
                    this.FileURLs.push(FileURL);
                  } catch (e) {
                    console.log('게시물 audio 첨부파일 불러오기 오류: ', e);
                  }
                  let paudio = p.createP();
                  let audio = p.createAudio([FileURL]);
                  audio.showControls();
                  audio.elt.onplay = () => {
                    for (let i = 0, j = this.PlayableElements.length; i < j; i++)
                      try {
                        if (i != index)
                          this.PlayableElements[i].pause();
                      } catch (e) { }
                  }
                  audio.parent(paudio);
                  content[i] = paudio;
                  this.PlayableElements[index] = audio.elt;
                }
                  break;
                case 'video': {
                  let FileURL = this.PostInfo['attachments'][index]['url'];
                  if (!FileURL) try {
                    FileURL = URL.createObjectURL(this.PostInfo['attachments'][index]['blob']);
                    this.FileURLs.push(FileURL);
                  } catch (e) {
                    console.log('게시물 video 첨부파일 불러오기 오류: ', e);
                  }
                  let pvideo = p.createP();
                  let video = p.createVideo([FileURL]);
                  video.style('width', '100%');
                  video.style('height', 'auto');
                  video.showControls();
                  video.parent(pvideo);
                  content[i] = pvideo;
                  this.PlayableElements[index] = video.elt;
                }
                  break;
                case 'godot': {
                  let targetFrameId = `PostViewer_godot_pck_${index}`;
                  let godot_frame = p.createDiv();
                  godot_frame.id(targetFrameId);
                  godot_frame.style('width', '100%');
                  godot_frame.style('height', '432px');
                  godot_frame.style('margin-top', '8px');
                  content[i] = godot_frame;
                  setTimeout(() => {
                    if (this.AlreadyHaveGodot || this.global.ArcadeLoaded) {
                      try {
                        CreateClickPanel(godot_frame, index);
                        godot_frame.mouseClicked(() => {
                          this.global.PageDismissAct[this.ModalDismissId] = (v: any) => {
                            this.ExitModalAct(v);
                          }
                          let _is_official: string;
                          let _target: string;
                          let creator: string;
                          try {
                            creator = this.PostInfo.creator_id;
                            _is_official = this.PostInfo.server.isOfficial;
                            _target = this.PostInfo.server.target;
                          } catch (e) {
                            _is_official = 'local';
                          }
                          this.IsFocusOnHere = false;
                          let json = JSON.parse(JSON.stringify(this.PostInfo['attachments'][index]))
                          json['filename'] = `[${index}] ${json['filename']}`;
                          this.global.ActLikeModal(`${this.LastPickedRouter}post-viewer/ionic-viewer`, {
                            info: {
                              content: json,
                              sender_id: creator,
                            },
                            isOfficial: _is_official,
                            target: _target,
                            path: this.PostInfo['attachments'][index]['path'],
                            relevance: this.RearrangedRelevance,
                            noEdit: true,
                            dismiss: this.ModalDismissId,
                          });
                        });
                      } catch (e) {
                        console.log('프레임 삭제 행동실패: ', e);
                      }
                    } else {
                      this.AlreadyHaveGodot = true;
                      this.PostInfo['attachments'][index].cont = this.cont;
                      this.global.CreateGodotIFrameWithDuplicateAct(this.PostInfo['attachments'][index], targetFrameId, {
                        path: `tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`,
                        quit_ionic: () => {
                          try {
                            CreateClickPanel(godot_frame, index);
                            godot_frame.mouseClicked(() => {
                              this.global.PageDismissAct[this.ModalDismissId] = (v: any) => {
                                this.ExitModalAct(v);
                              }
                              let _is_official: string;
                              let _target: string;
                              let creator: string;
                              try {
                                creator = this.PostInfo.creator_id;
                                _is_official = this.PostInfo.server.isOfficial;
                                _target = this.PostInfo.server.target;
                              } catch (e) {
                                _is_official = 'local';
                              }
                              this.IsFocusOnHere = false;
                              let json = JSON.parse(JSON.stringify(this.PostInfo['attachments'][index]))
                              json['filename'] = `[${index}] ${json['filename']}`;
                              this.global.ActLikeModal(`${this.LastPickedRouter}post-viewer/ionic-viewer`, {
                                info: {
                                  content: json,
                                  sender_id: creator,
                                },
                                isOfficial: _is_official,
                                target: _target,
                                path: this.PostInfo['attachments'][index]['path'],
                                relevance: this.RearrangedRelevance,
                                noEdit: true,
                                dismiss: this.ModalDismissId,
                              });
                            });
                          } catch (e) {
                            console.log('프레임 삭제 행동실패: ', e);
                          }
                        }
                      });
                    }
                  }, 100 * index);
                }
                  break;
                case 'blender': {
                  let blender_frame = p.createDiv();
                  blender_frame.style('position', 'relative');
                  blender_frame.style('width', '100%');
                  blender_frame.style('height', '432px');
                  blender_frame.elt.onwheel = () => {
                    return false;
                  }
                  blender_frame.elt.oncontextmenu = () => {
                    return false;
                  }
                  content[i] = blender_frame;
                  let blender_viewer = this.global.load_blender_file(blender_frame.elt, this.PostInfo['attachments'][index],
                    () => { }, () => { }, this.cont);
                  this.blenderViewers.push(blender_viewer);
                } break;
                case 'code':
                case 'text':
                  if (this.PostInfo['attachments'][index]['type'] == 'text/html') {
                    // 파일 링크 준비하기
                    try {
                      if (!this.PostInfo['attachments'][index]['blob'] || !this.PostInfo['attachments'][index]['blob']['size']) {
                        if (this.PostInfo['attachments'][index]['url']) {
                          let res = await fetch(this.PostInfo['attachments'][index]['url']);
                          if (res.ok) {
                            let download_blob = await res.blob();
                            this.PostInfo['attachments'][index].alt_path = `servers/${this.PostInfo['server']['isOfficial']}/${this.PostInfo['server']['target']}/posts/${this.PostInfo.creator_id}/${this.PostInfo.id}/[${index}]${this.PostInfo['attachments'][index].filename}`;
                            await this.indexed.saveBlobToUserPath(download_blob, this.PostInfo['attachments'][index]['alt_path']);
                          }
                        }
                        let blob = await this.indexed.loadBlobFromUserPath(this.PostInfo['attachments'][index]['alt_path'] || this.PostInfo['attachments'][index]['path'], this.PostInfo['attachments'][index]['type']);
                        this.PostInfo['attachments'][index]['blob'] = blob;
                      }
                      const FileURL = URL.createObjectURL(this.PostInfo['attachments'][index]['blob']);
                      this.FileURLs.push(FileURL);
                      // 화면에 표시
                      let HTMLDiv = p.createElement('iframe');
                      HTMLDiv.style('width', '100%');
                      HTMLDiv.style('border', '0');
                      HTMLDiv.style('height', '432px');
                      HTMLDiv.attribute('src', FileURL);
                      content[i] = HTMLDiv;
                      break;
                    } catch (e) {
                      console.log('HTML 파일 읽기 실패: ', e);
                    }
                  }
                case 'disabled': // 사용 불가
                default: { // 읽을 수 없는 파일들은 클릭시 뷰어 연결 div 생성 (채널 채팅 썸네일과 비슷함)
                  let EmptyDiv = p.createDiv();
                  EmptyDiv.parent(contentDiv);
                  CreateClickPanel(EmptyDiv, index);
                  EmptyDiv.mouseClicked(() => {
                    this.global.PageDismissAct[this.ModalDismissId] = (v: any) => {
                      this.ExitModalAct(v);
                    }
                    let _is_official: string;
                    let _target: string;
                    let creator: string;
                    try {
                      creator = this.PostInfo.creator_id;
                      _is_official = this.PostInfo.server.isOfficial;
                      _target = this.PostInfo.server.target;
                    } catch (e) {
                      _is_official = 'local';
                    }
                    this.IsFocusOnHere = false;
                    let json = JSON.parse(JSON.stringify(this.PostInfo['attachments'][index]))
                    json['filename'] = `[${index}] ${json['filename']}`;
                    this.global.ActLikeModal(`${this.LastPickedRouter}post-viewer/ionic-viewer`, {
                      info: {
                        content: json,
                        sender_id: creator,
                      },
                      isOfficial: _is_official,
                      target: _target,
                      path: this.PostInfo['attachments'][index]['path'],
                      relevance: this.RearrangedRelevance,
                      noEdit: true,
                      dismiss: this.ModalDismissId,
                    });
                  });
                  content[i] = EmptyDiv;
                }
                  break;
              }
            } else {
              // 일반 텍스트는 무시하고 음원 시간 UI 생성 시도
              try {
                let GetOriginal = this.global.HTMLDecode(content[i].replace('<p>', '').replace('</p>', ''));
                let json = JSON.parse(GetOriginal);
                let targetText = `[${json['i']}] ${this.PostInfo['attachments'][json['i']]['filename']} (${json['t']})`;
                let TimeLink = p.createDiv(targetText);
                TimeLink.style('background-color', '#8888');
                TimeLink.style('width', 'fit-content');
                TimeLink.style('height', 'fit-content');
                TimeLink.style('border-radius', '16px');
                TimeLink.style('padding', '8px 16px');
                TimeLink.style('margin', '8px 0px');
                TimeLink.style('cursor', 'pointer');
                content[i] = TimeLink;
                AfterAllAct.push(() => {
                  let CatchMedia: HTMLAudioElement = this.PlayableElements[json['i']];
                  let sep = json['t'].split(':');
                  let targetSecond = 0;
                  let ratio = 1;
                  for (let i = sep.length - 1; i >= 0; i--) {
                    let AsNumber = Number(sep.pop());
                    targetSecond += AsNumber * ratio;
                    ratio *= 60;
                  }
                  TimeLink.mouseClicked(() => {
                    try { // 사용자가 직접 타이핑 치는 경우를 대비
                      CatchMedia.currentTime = targetSecond;
                      CatchMedia.play();
                    } catch (e) { }
                  });
                });
              } catch (e) { }
            }
          }
          /** 게시되지 않은 숨은 파일을 뒤에 정렬 */
          const attach_len = this.PostInfo.attachments?.length || 0;
          for (let i = 0; i < attach_len; i++)
            if (!RelevanceIndexes.includes(i))
              RelevanceIndexes.push(i);
          for (let index of RelevanceIndexes) {
            let json = JSON.parse(JSON.stringify(this.PostInfo['attachments'][index]))
            json['filename'] = `[${index}] ${json['filename']}`;
            this.RearrangedRelevance.push({ content: json });
          }
          // 게시물에 텍스트와 콘텐츠를 바로 볼 수 있게 순차적 배치
          let result = [];
          let CollectResult = () => {
            if (result.length) {
              let BeforeString = result.join('\n');
              let part = p.createDiv();
              part.style('width', '100%');
              part.elt.innerHTML = BeforeString;
              part.parent(contentDiv);
              result.length = 0;
            }
          }
          for (let i = 0, j = content.length; i < j; i++) {
            // 게시물 텍스트를 수집
            if (typeof content[i] == 'string') {
              result.push(content[i]);
            } else {
              // 문자열이 아니라면 콘텐츠로 인식
              CollectResult();
              content[i].parent(contentDiv);
              this.RearrangedContents.push(content[i]);
            }
          }
          CollectResult();
          for (let i = 0, j = AfterAllAct.length; i < j; i++)
            AfterAllAct[i]();
          for (let blenderfile of this.blenderViewers)
            blenderfile.windowResized();
        }
        this.ContentChanging = false;
        this.p5loading.update({
          id: 'postviewer',
          message: `${this.lang.text['PostViewer']['ReadyToSee']}: ${this.PostInfo['title']} (${this.CurrentIndex} / ${this.nakama.posts.length})`,
          progress: 1,
          forceEnd: 350,
        });
      }
      /** 클릭하여 파일 뷰어에 진입할 수 있도록 구조 구성해주기 */
      let CreateClickPanel = (target: p5.Element, index: number) => {
        this.PostInfo['attachments'][index]['blob'] = null;
        target.style('width', '160px');
        target.style('height', '112px');
        target.style('overflow', 'hidden');
        target.style('background-color', 'grey');
        target.style('margin-top', '8px');
        target.style('border-radius', '8px');
        target.style('cursor', 'pointer');
        let FileName = p.createP(this.PostInfo['attachments'][index]['filename']);
        FileName.style('margin', '0px 4px');
        FileName.style('text-align', 'start');
        FileName.parent(target);
        let Seperator = p.createDiv();
        Seperator.style('background-color', 'white');
        Seperator.style('margin-top', '2px');
        Seperator.style('position', 'relative');
        Seperator.style('width', '100%');
        Seperator.style('height', '2px');
        Seperator.parent(target);
        let OpenViewerInfo = p.createSpan(this.lang.text['PostViewer']['OpenFromViewer']);
        OpenViewerInfo.style('margin', '2px 4px 0px 4px');
        OpenViewerInfo.style('text-align', 'start');
        OpenViewerInfo.style('display', 'grid');
        OpenViewerInfo.parent(target);
      }
    });
  }

  CheckIfDismissAct(ev: any) {
    switch (ev.target.id) {
      case 'quick_post_link_qr':
        this.QuickPostView.dismiss();
        break;
    }
  }

  CanInputValue = false;
  RelevancesInputId = 'RelevancesInputId';
  /** 첨부파일 순번 라벨을 인풋으로 변경하기 */
  FocusOnIndexInput() {
    this.CanInputValue = true;
    setTimeout(() => {
      document.getElementById(this.RelevancesInputId)?.['focus']();
    }, 100);
  }

  /** 사용자가 직접 첨부파일 순번 입력시 */
  ChangeRelevanceIndex(ev: any) {
    // 엔터를 눌러 종료
    if (ev.key == 'Enter') {
      let targetIndex = Number(ev.target['value'] || ev.target['placeholder']);
      targetIndex = Math.max(Math.min(targetIndex, this.nakama.posts.length), 1);
      this.ChangeToAnother(targetIndex - this.CurrentIndex);
      setTimeout(() => {
        this.CanInputValue = false;
      }, 0);
    }
  }

  EditPost() {
    if (this.isOwner && this.CurrentIndex >= 0) {
      this.PostViewMenu.dismiss();
      this.navCtrl.pop();
      this.nakama.EditPost(this.PostInfo);
    }
  }

  ionViewWillLeave() {
    this.p5loading.update({
      id: 'postviewer',
      forceEnd: 0,
    }, true);
    this.WaitingLoaded = false;
    delete this.global.p5KeyShortCut['Escape'];
    this.global.RestoreShortCutAct('post-viewer');
    this.IsFocusOnHere = false;
  }

  RemovePost() {
    if (this.isOwner && this.CurrentIndex >= 0) {
      this.PostViewMenu.dismiss();
      this.alertCtrl.create({
        header: this.lang.text['PostViewer']['RemovePost'],
        message: this.lang.text['ChatRoom']['CannotUndone'],
        buttons: [{
          text: this.lang.text['ChatRoom']['Delete'],
          cssClass: 'redfont',
          handler: () => {
            const removePost = async () => {
              await this.nakama.RemovePost(this.PostInfo);
              this.navCtrl.pop();
            }
            removePost();
          }
        }],
      }).then(v => v.present());
    }
  }

  ngOnDestroy() {
    this.route.queryParams['unsubscribe']();
    this.cont.abort('게시물 뷰어 벗어남');
    this.cont = null;
    for (let i = 0, j = this.FileURLs.length; i < j; i++)
      URL.revokeObjectURL(this.FileURLs[i]);
    for (let i = 0, j = this.blenderViewers.length; i < j; i++)
      this.blenderViewers[i].remove();
    if (this.p5canvas)
      this.p5canvas.remove();
    this.global.portalHint = true;
  }
}
