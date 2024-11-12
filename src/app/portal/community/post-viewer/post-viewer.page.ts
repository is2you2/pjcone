import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { GlobalActService } from 'src/app/global-act.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { IonModal } from '@ionic/angular/common';
import * as marked from "marked";

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
  ) { }

  PostInfo: any = {};
  isOwner = false;
  HavePosts = false;
  /** 불러와진 모든 포스트 기준 현재 게시물 번호 */
  CurrentIndex = 1;

  /** 파일 읽기 멈추기 위한 컨트롤러 */
  cont: AbortController;

  ngOnInit() {
    this.cont = new AbortController();
    this.route.queryParams.subscribe(_p => {
      try {
        const navParams = this.router.getCurrentNavigation().extras.state;
        this.PostInfo = navParams.data;
        this.CurrentIndex = navParams.index;
        this.initialize();
      } catch (e) { }
    });
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
    this.WaitingLoaded = true;
    this.global.StoreShortCutAct('post-viewer');
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
    this.IsFocusOnHere = true;
  }
  ScrollDiv: HTMLDivElement;
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
  /** PC에서 키를 눌러 컨텐츠 전환 */
  ChangeContentWithKeyInput() {
    if (this.p5canvas) {
      // 단축키 행동
      this.p5canvas.keyPressed = async (ev) => {
        if (!this.IsFocusOnHere) return;
        switch (ev['code']) {
          case 'KeyA': // 왼쪽 이동
          case 'ArrowLeft':
            this.ChangeToAnother(-1);
            break;
          case 'KeyD': // 오른쪽 이동
          case 'ArrowRight':
            this.ChangeToAnother(1);
            break;
          case 'KeyQ': // 첫번째 첨부파일 열기
            let createRelevances = [];
            for (let i = 0, j = this.PostInfo['attachments'].length; i < j; i++)
              createRelevances.push({ content: JSON.parse(JSON.stringify(this.PostInfo['attachments'][i])) });
            if (!createRelevances.length) return;
            this.global.PageDismissAct['post-viewer-image-view'] = async (v: any) => {
              await this.WaitingCurrent();
              if (v.data && v.data['share']) this.navCtrl.pop();
              delete this.global.PageDismissAct['post-viewer-image-view'];
            }
            this.global.ActLikeModal('ionic-viewer', {
              info: { content: this.PostInfo['attachments'][0] },
              path: this.PostInfo['attachments'][0]['path'],
              relevance: createRelevances,
              noEdit: true,
              dismiss: 'post-viewer-image-view',
            });
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

  /** 진입 정보를 어떻게 활용할 것인가 */
  initialize() {
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
    } catch (e) {
      this.isOwner = false;
    }
    this.HavePosts = this.nakama.posts.length > 1 && this.CurrentIndex >= 0;
    this.ChangeContentWithKeyInput();
  }

  /** 터치 상호작용 보완용 */
  ContentChanging = false;
  /** 게시물 전환 */
  ChangeToAnother(direction: number) {
    if (this.ContentChanging) return;
    this.ContentChanging = true;
    let tmp_calced = this.CurrentIndex + direction;
    if (tmp_calced <= 0 || tmp_calced > this.nakama.posts.length) {
      this.ContentChanging = false;
      return;
    }
    if (!this.ScrollDiv) this.ScrollDiv = document.getElementById('ScrollPost') as HTMLDivElement;
    this.ScrollDiv.scrollTo({ top: 0 });
    if (this.p5canvas) this.p5canvas.remove();
    this.CurrentIndex = tmp_calced;
    this.PostInfo = this.nakama.posts[this.CurrentIndex - 1];
    this.initialize();
  }

  QRCodeSRC: any;
  ResultSharedAddress: any;
  @ViewChild('QuickPostView') QuickPostView: IonModal;
  p5canvas: p5;
  /** 내용에 파일 뷰어를 포함한 구성 만들기 */
  create_content() {
    let contentDiv = document.getElementById('PostContent');
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
            this.ResultSharedAddress = `${await this.global.GetHeaderAddress(undefined, true)}?postViewer=${this.PostInfo['OutSource']}`;
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
        creator.elt.onclick = () => {
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
        }
        creator.parent(contentDiv);
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
                  let img = p.createImg(FileURL, `${index}`);
                  img.style('cursor', 'pointer');
                  img.elt.onclick = () => {
                    let createRelevances = [];
                    for (let attach of this.PostInfo['attachments'])
                      createRelevances.push({ content: JSON.parse(JSON.stringify(attach)) });
                    this.global.PageDismissAct['post-viewer-image-view'] = async (v: any) => {
                      await this.WaitingCurrent();
                      if (v.data && v.data['share']) this.navCtrl.pop();
                      delete this.global.PageDismissAct['post-viewer-image-view'];
                    }
                    this.global.ActLikeModal('ionic-viewer', {
                      info: { content: this.PostInfo['attachments'][index] },
                      path: this.PostInfo['attachments'][index]['path'],
                      relevance: createRelevances,
                      noEdit: true,
                      dismiss: 'post-viewer-image-view',
                    });
                  }
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
                  content[i] = godot_frame;
                  setTimeout(async () => {
                    let createDuplicate = false;
                    if (this.indexed.godotDB) {
                      try {
                        await this.indexed.GetGodotIndexedDB();
                        await this.indexed.saveBlobToUserPath(this.PostInfo['attachments'][index]['blob'], `godot/app_userdata/Client/tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`, undefined, this.indexed.godotDB);
                        createDuplicate = true;
                      } catch (e) {
                        console.log('내부 파일 없음: ', e);
                      }
                    }
                    await this.global.CreateGodotIFrame(targetFrameId, {
                      path: `tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`,
                      url: this.PostInfo['attachments'][index].url,
                      quit_ionic: () => {
                        if (createDuplicate) {
                          try {
                            CreateClickPanel(godot_frame, index);
                            godot_frame.elt.onclick = () => {
                              let createRelevances = [];
                              for (let attach of this.PostInfo['attachments'])
                                createRelevances.push({ content: attach });
                              this.global.PageDismissAct['post-viewer-file-view'] = () => {
                                delete this.global.PageDismissAct['post-viewer-file-view'];
                              }
                              this.global.ActLikeModal('ionic-viewer', {
                                info: { content: JSON.parse(JSON.stringify(this.PostInfo['attachments'][index])) },
                                path: this.PostInfo['attachments'][index]['path'],
                                relevance: createRelevances,
                                noEdit: true,
                                dismiss: 'post-viewer-file-view',
                              });
                            }
                          } catch (e) {
                            console.log('프레임 삭제 행동실패: ', e);
                          }
                        }
                      }
                    }, 'start_load_pck');
                    if (!createDuplicate) {
                      try { // 내부에 파일이 있는지 검토
                        let blob = await this.indexed.loadBlobFromUserPath(
                          this.PostInfo['attachments'][index]['path'], '', undefined, this.indexed.ionicDB);
                        await this.indexed.GetGodotIndexedDB();
                        await this.indexed.saveBlobToUserPath(blob, `godot/app_userdata/Client/tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`, undefined, this.indexed.godotDB);
                      } catch (e) { }
                      await this.global.CreateGodotIFrame(targetFrameId, {
                        path: `tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`,
                        url: this.PostInfo['attachments'][index].url,
                        quit_ionic: () => {
                          try {
                            CreateClickPanel(godot_frame, index);
                            godot_frame.elt.onclick = () => {
                              let createRelevances = [];
                              for (let attach of this.PostInfo['attachments'])
                                createRelevances.push({ content: attach });
                              this.global.PageDismissAct['post-viewer-file-view'] = () => {
                                delete this.global.PageDismissAct['post-viewer-file-view'];
                              }
                              this.global.ActLikeModal('ionic-viewer', {
                                info: { content: JSON.parse(JSON.stringify(this.PostInfo['attachments'][index])) },
                                path: this.PostInfo['attachments'][index]['path'],
                                relevance: createRelevances,
                                noEdit: true,
                                dismiss: 'post-viewer-file-view',
                              });
                            }
                          } catch (e) {
                            console.log('프레임 삭제 행동실패: ', e);
                          }
                        }
                      }, 'start_load_pck');
                    }
                    if (this.PostInfo['attachments'][index].url)
                      this.global.godot_window['download_url']();
                    else this.global.godot_window['start_load_pck']();
                  }, 100);
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
                      let FileURL = URL.createObjectURL(this.PostInfo['attachments'][index]['blob']);
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
                  EmptyDiv.elt.onclick = () => {
                    let createRelevances = [];
                    for (let attach of this.PostInfo['attachments'])
                      createRelevances.push({ content: attach });
                    this.global.PageDismissAct['post-viewer-file-view'] = () => {
                      delete this.global.PageDismissAct['post-viewer-file-view'];
                    }
                    this.global.ActLikeModal('ionic-viewer', {
                      info: { content: JSON.parse(JSON.stringify(this.PostInfo['attachments'][index])) },
                      path: this.PostInfo['attachments'][index]['path'],
                      relevance: createRelevances,
                      noEdit: true,
                      dismiss: 'post-viewer-file-view',
                    });
                  }
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
                  TimeLink.elt.onclick = () => {
                    try { // 사용자가 직접 타이핑 치는 경우를 대비
                      CatchMedia.currentTime = targetSecond;
                      CatchMedia.play();
                    } catch (e) { }
                  }
                });
              } catch (e) { }
            }
          }
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
            if (typeof content[i] == 'string') {
              result.push(content[i]);
            } else {
              CollectResult();
              content[i].parent(contentDiv);
            }
          }
          CollectResult();
          for (let i = 0, j = AfterAllAct.length; i < j; i++)
            AfterAllAct[i]();
          for (let blenderfile of this.blenderViewers)
            blenderfile.windowResized();
        }
        this.ContentChanging = false;
      }
      /** 클릭하여 파일 뷰어에 진입할 수 있도록 구조 구성해주기 */
      let CreateClickPanel = (target: p5.Element, index: number) => {
        target.style('width', '160px');
        target.style('height', '112px');
        target.style('overflow', 'hidden');
        target.style('background-color', 'grey');
        target.style('margin-top', '4px');
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

  EditPost() {
    this.nakama.EditPost(this.PostInfo);
    this.navCtrl.pop();
  }

  ionViewWillLeave() {
    this.WaitingLoaded = false;
    delete this.global.p5KeyShortCut['Escape'];
    this.global.RestoreShortCutAct('post-viewer');
    this.IsFocusOnHere = false;
  }

  RemovePost() {
    this.alertCtrl.create({
      header: this.lang.text['PostViewer']['RemovePost'],
      message: this.lang.text['ChatRoom']['CannotUndone'],
      buttons: [{
        text: this.lang.text['ChatRoom']['Delete'],
        cssClass: 'redfont',
        handler: async () => {
          await this.nakama.RemovePost(this.PostInfo);
          this.navCtrl.pop();
        }
      }],
    }).then(v => v.present());
  }

  ngOnDestroy() {
    this.route.queryParams['unsubscribe']();
    this.cont.abort();
    for (let i = 0, j = this.FileURLs.length; i < j; i++)
      URL.revokeObjectURL(this.FileURLs[i]);
    for (let i = 0, j = this.blenderViewers.length; i < j; i++)
      this.blenderViewers[i].remove();
    if (this.p5canvas)
      this.p5canvas.remove();
  }
}
