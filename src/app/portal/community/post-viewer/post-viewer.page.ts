import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { IonicViewerPage } from '../../subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { NakamaService } from 'src/app/nakama.service';
import { GlobalActService } from 'src/app/global-act.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-post-viewer',
  templateUrl: './post-viewer.page.html',
  styleUrls: ['./post-viewer.page.scss'],
})
export class PostViewerPage implements OnInit, OnDestroy {

  constructor(
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    public lang: LanguageSettingService,
    private indexed: IndexedDBService,
    public nakama: NakamaService,
    private alertCtrl: AlertController,
    private global: GlobalActService,
    private mClipboard: Clipboard,
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
    this.route.queryParams.subscribe(_p => {
      try {
        const navParams = this.router.getCurrentNavigation().extras.state;
        this.PostInfo = navParams.data;
        this.CurrentIndex = navParams.index;
        this.initialize();
      } catch (e) { }
    });
  }
  BackButtonPressed = false;
  ionViewWillEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
    this.IsFocusOnHere = true;
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.navCtrl.pop();
    };
  }
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
  /** 파일 뷰어로 넘어간 경우 게시물 전환 단축키 막기 */
  blockShortcut = false;
  /** PC에서 키를 눌러 컨텐츠 전환 */
  ChangeContentWithKeyInput() {
    if (this.p5canvas) {
      // 단축키 행동
      this.p5canvas.keyPressed = async (ev) => {
        if (!this.IsFocusOnHere) return;
        if (this.blockShortcut) return;
        switch (ev['code']) {
          case 'KeyA': // 왼쪽 이동
          case 'ArrowLeft':
            this.ChangeToAnother(-1);
            break;
          case 'KeyD': // 오른쪽 이동
          case 'ArrowRight':
            this.ChangeToAnother(1);
            break;
        }
      }
      // 터치 행동
      let startPos: p5.Vector = this.p5canvas.createVector();
      let touches: { [id: string]: p5.Vector } = {};
      this.p5canvas.touchStarted = (ev: any) => {
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
    if (this.cont) this.cont.abort();
    this.cont = new AbortController();
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
    if (this.p5canvas) this.p5canvas.remove();
    this.CurrentIndex = tmp_calced;
    this.PostInfo = this.nakama.posts[this.CurrentIndex - 1];
    this.initialize();
  }

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
            let is_https = this.PostInfo['OutSource'].indexOf('https:') == 0;
            let targetAddress = '';
            if (is_https) // 보안 연결인 경우 홈페이지 우회
              targetAddress = `${SERVER_PATH_ROOT}godotchat_pwa/?postViewer=${this.PostInfo['OutSource']}`;
            else { // 비보안 연결인 경우 연결 검토 후 우회
              let address_text: string = this.PostInfo['OutSource'];
              let extract = address_text.substring(0, address_text.indexOf(':8080'));
              try { // 사용자 지정 서버 업로드 시도 우선
                let HasLocalPage = `${extract}:8080/www/`;
                const cont = new AbortController();
                const id = setTimeout(() => {
                  cont.abort();
                }, 500);
                let res = await fetch(HasLocalPage, { signal: cont.signal });
                clearTimeout(id);
                if (res.ok) targetAddress = `${extract}:8080/www/?postViewer=${this.PostInfo['OutSource']}`;
                else throw '주소 없음';
              } catch (e) {
                targetAddress = `http://localhost:8080/www/?postViewer=${this.PostInfo['OutSource']}`;
              }
            }
            this.mClipboard.copy(targetAddress)
              .catch(_e => {
                this.global.WriteValueToClipboard('text/plain', targetAddress);
              });
          }
        }
        title.style('font-size', '32px');
        title.style('font-weight', 'bold');
        title.parent(contentDiv);
        // 작성일
        let datetime = p.createDiv();
        datetime.style('color', '#888');
        datetime.parent(contentDiv);
        let create_time = p.createDiv(`${this.lang.text['PostViewer']['CreateTime']}: ${new Date(this.PostInfo['create_time']).toLocaleString()}`);
        create_time.parent(datetime);
        if (this.PostInfo['create_time'] != this.PostInfo['modify_time']) {
          let modify_time = p.createDiv(`${this.lang.text['PostViewer']['ModifyTime']}: ${new Date(this.PostInfo['modify_time']).toLocaleString()}`);
          modify_time.parent(datetime);
        }
        // 작성자
        let creatorForm = p.createDiv();
        creatorForm.style('padding-bottom', '8px');
        creatorForm.parent(contentDiv);
        let creator = p.createSpan(this.PostInfo['creator_name']);
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
        creator.parent(creatorForm);
        // 첨부파일 불러오기
        if (this.PostInfo['server']['local'])
          for (let i = 0, j = this.PostInfo['attachments'].length; i < j; i++) {
            try {
              let blob = await this.indexed.loadBlobFromUserPath(this.PostInfo['attachments'][i]['path'], this.PostInfo['attachments'][i]['type']);
              this.PostInfo['attachments'][i]['blob'] = blob;
            } catch (e) { }
          }
        else for (let i = 0, j = this.PostInfo['attachments'].length; i < j; i++) {
          try {
            this.PostInfo['attachments'][i].alt_path = `servers/${this.PostInfo['server']['isOfficial']}/${this.PostInfo['server']['target']}/posts/${this.PostInfo.creator_id}/${this.PostInfo.id}/[${i}]${this.PostInfo['attachments'][i].filename}`;
            let blob = await this.nakama.sync_load_file(
              this.PostInfo['attachments'][i], this.PostInfo['server']['isOfficial'], this.PostInfo['server']['target'], 'server_post',
              this.PostInfo['creator_id'], `${this.PostInfo['id']}_attach_${i}`, false);
            this.PostInfo['attachments'][i]['blob'] = blob.value;
          } catch (e) { }
        }
        // 내용
        if (this.PostInfo['content']) {
          let content: string[] = this.PostInfo['content'].split('\n');
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
              index = Number(content[i].substring(1, content_len));
              is_attach = content[i].charAt(0) == '[' && content[i].charAt(content_len) == ']' && !isNaN(index);
            } catch (e) { }
            if (is_attach) {
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
                  let img = p.createImg(FileURL, `${index}`);
                  img.style('cursor', 'pointer');
                  img.elt.onclick = () => {
                    let createRelevances = [];
                    for (let i = 0, j = this.PostInfo['attachments'].length; i < j; i++)
                      createRelevances.push({ content: this.PostInfo['attachments'][i] });
                    this.modalCtrl.create({
                      component: IonicViewerPage,
                      componentProps: {
                        info: { content: this.PostInfo['attachments'][index] },
                        path: this.PostInfo['attachments'][index]['path'],
                        relevance: createRelevances,
                        noEdit: true,
                      },
                      cssClass: 'fullscreen',
                    }).then(v => {
                      v.onDidDismiss().then(v => {
                        this.blockShortcut = false;
                        if (v.data && v.data['share']) this.navCtrl.pop();
                      });
                      this.blockShortcut = true;
                      v.present();
                    });
                  }
                  img.parent(contentDiv);
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
                  let audio = p.createAudio([FileURL]);
                  audio.showControls();
                  audio.elt.onplay = () => {
                    for (let i = 0, j = this.PlayableElements.length; i < j; i++)
                      try {
                        if (i != index)
                          this.PlayableElements[i].pause();
                      } catch (e) { }
                  }
                  audio.parent(contentDiv);
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
                  let video = p.createVideo([FileURL]);
                  video.style('width', '100%');
                  video.style('height', 'auto');
                  video.showControls();
                  video.parent(contentDiv);
                  this.PlayableElements[index] = video.elt;
                }
                  break;
                case 'godot': {
                  let targetFrameId = `PostViewer_godot_pck_${index}`;
                  let godot_frame = p.createDiv();
                  godot_frame.id(targetFrameId);
                  godot_frame.style('width', '100%');
                  godot_frame.style('height', '432px');
                  godot_frame.parent(contentDiv);
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
                  blender_frame.parent(contentDiv);
                  let blender_viewer = this.global.load_blender_file(blender_frame.elt, this.PostInfo['attachments'][index], undefined,
                    () => { }, () => { });
                  this.blenderViewers.push(blender_viewer);
                } break;
                case 'code':
                case 'text':
                case 'disabled': // 사용 불가
                default: { // 읽을 수 없는 파일들은 클릭시 뷰어 연결 div 생성 (채널 채팅 썸네일과 비슷함)
                  let EmptyDiv = p.createDiv();
                  EmptyDiv.style('width', '160px');
                  EmptyDiv.style('height', '112px');
                  EmptyDiv.style('overflow', 'hidden');
                  EmptyDiv.style('background-color', 'grey');
                  EmptyDiv.style('margin-top', '4px');
                  EmptyDiv.style('border-radius', '8px');
                  EmptyDiv.style('cursor', 'pointer');
                  EmptyDiv.parent(contentDiv);
                  let FileName = p.createP(this.PostInfo['attachments'][index]['filename']);
                  FileName.style('margin', '0px 4px');
                  FileName.style('text-align', 'start');
                  FileName.parent(EmptyDiv);
                  let Seperator = p.createDiv();
                  Seperator.style('background-color', 'white');
                  Seperator.style('margin-top', '2px');
                  Seperator.style('position', 'relative');
                  Seperator.style('width', '100%');
                  Seperator.style('height', '2px');
                  Seperator.parent(EmptyDiv);
                  let OpenViewerInfo = p.createSpan(this.lang.text['PostViewer']['OpenFromViewer']);
                  OpenViewerInfo.style('margin', '2px 4px 0px 4px');
                  OpenViewerInfo.style('text-align', 'start');
                  OpenViewerInfo.style('display', 'grid');
                  OpenViewerInfo.parent(EmptyDiv);
                  EmptyDiv.elt.onclick = () => {
                    let createRelevances = [];
                    for (let i = 0, j = this.PostInfo['attachments'].length; i < j; i++)
                      createRelevances.push({ content: this.PostInfo['attachments'][i] });
                    this.modalCtrl.create({
                      component: IonicViewerPage,
                      componentProps: {
                        info: { content: this.PostInfo['attachments'][index] },
                        path: this.PostInfo['attachments'][index]['path'],
                        relevance: createRelevances,
                        noEdit: true,
                      },
                      cssClass: 'fullscreen',
                    }).then(v => {
                      v.onDidDismiss().then(() => {
                        this.blockShortcut = false;
                      });
                      this.blockShortcut = true;
                      v.present();
                    });
                  }
                }
                  break;
              }
            } else { // 일반 문자열
              try { // 일반 문자열이 json 구성을 띈 기능 정보인 경우, 콘텐츠 시간 링크로 간주
                let json = JSON.parse(content[i]);
                let targetText = `[${json['i']}] ${this.PostInfo['attachments'][json['i']]['filename']} (${json['t']})`;
                let TimeLink = p.createDiv(targetText);
                TimeLink.style('background-color', '#8888');
                TimeLink.style('width', 'fit-content');
                TimeLink.style('height', 'fit-content');
                TimeLink.style('border-radius', '16px');
                TimeLink.style('padding', '8px 16px');
                TimeLink.style('cursor', 'pointer');
                TimeLink.parent(contentDiv);
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
              } catch (e) { // 정말로 일반 문자열
                let line = p.createDiv();
                line.parent(contentDiv);
                // 문자열을 띄어쓰기 단위로 나누기
                let sep = content[i].split(' ');
                for (let k = 0, l = sep.length; k < l; k++) {
                  // 웹 주소라면 하이퍼링크 처리
                  if (sep[k].indexOf('http:') == 0 || sep[k].indexOf('https:') == 0) {
                    let link = p.createA(sep[k], sep[k]);
                    link.attribute('target', '_blank');
                    link.parent(line);
                    let word = p.createSpan('&nbsp');
                    word.parent(line);
                  } else {
                    let word = p.createSpan(sep[k] + '&nbsp');
                    word.parent(line);
                  }
                }
              }
            }
          }
          for (let i = 0, j = AfterAllAct.length; i < j; i++)
            AfterAllAct[i]();
        }
        this.ContentChanging = false;
      }
    });
  }

  EditPost() {
    this.nakama.EditPost(this.PostInfo);
    this.navCtrl.pop();
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
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

  ngOnDestroy(): void {
    this.cont.abort();
    for (let i = 0, j = this.FileURLs.length; i < j; i++)
      URL.revokeObjectURL(this.FileURLs[i]);
    for (let i = 0, j = this.blenderViewers.length; i < j; i++)
      this.blenderViewers[i].remove();
    if (this.p5canvas)
      this.p5canvas.remove();
  }
}
