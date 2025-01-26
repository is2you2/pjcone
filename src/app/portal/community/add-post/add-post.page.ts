import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { ContentCreatorInfo, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MatchOpCode, NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { ExtendButtonForm } from '../../subscribes/chat-room/chat-room.page';
import { DomSanitizer } from '@angular/platform-browser';
import { VoiceRecorder } from "@langx/capacitor-voice-recorder";
import { ActivatedRoute, Router } from '@angular/router';
import * as p5 from 'p5';
import { isPlatform } from 'src/app/app.component';
import { FloatButtonService } from 'src/app/float-button.service';
import { P5LoadingService } from 'src/app/p5-loading.service';

@Component({
  selector: 'app-add-post',
  templateUrl: './add-post.page.html',
  styleUrls: ['./add-post.page.scss'],
})
export class AddPostPage implements OnInit, OnDestroy {
  constructor(
    public global: GlobalActService,
    public lang: LanguageSettingService,
    private navCtrl: NavController,
    private nakama: NakamaService,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private floatButton: FloatButtonService,
    private alertCtrl: AlertController,
    private p5loading: P5LoadingService,
  ) { }

  ngOnDestroy() {
    this.route.queryParams['unsubscribe']();
    this.TitleInput.onpaste = null;
    this.TitleInput.onfocus = null;
    this.TitleInput.onblur = null;
    this.ContentTextArea.onpaste = null;
    this.p5StartVoiceTimer = null;
    this.p5StopVoiceTimer = null;
    this.cont.abort('게시물 편집 페이지 벗어남');
    this.cont = null;
    if (this.p5canvas) this.p5canvas.remove();
    delete this.nakama.StatusBarChangedCallback;
    if (this.useVoiceRecording) this.StopAndSaveVoiceRecording();
    try {
      if (this.MainPostImage)
        setTimeout(() => {
          URL.revokeObjectURL(this.MainPostImage);
        }, 1000);
    } catch (e) { }
    this.indexed.GetFileListFromDB('tmp_files/post').then(list => list.forEach(path => this.indexed.removeFileFromUserPath(path)));
    this.global.portalHint = true;
  }

  servers: ServerInfo[] = [];
  userInput = {
    id: undefined,
    title: undefined,
    /** 내용물, txt 파일 변환하여 저장됨 */
    content: undefined,
    creator_id: undefined,
    creator_name: undefined,
    UserColor: undefined,
    create_time: undefined,
    modify_time: undefined,
    server: undefined as ServerInfo,
    /** 대표 이미지 설정 */
    mainImage: undefined as FileInfo,
    attachments: [] as FileInfo[],
    /** 게시물의 완벽한 외부 노출  
     * 게시물 링크 정보를 포함하면 빠른 진입으로 이 게시물을 볼 수 있게 된다  
     * 서버를 사용하는 경우 또는 FFS를 사용하는 경우에만 가능  
     * 이 자리에 외부노출 주소가 포함되게 됨 (UserInput에 해당하는 json 파일을 업로드한 URL)
    */
    OutSource: undefined,
    isNSFW: false,
    /** 사용자 지정 우선 서버 사용 여부  
   * 0: 기본값  
   * 1: FFS 우선  
   * 2: SQL 강제
   */
    CDN: undefined as number,
    /** 오프라인 행동을 시도한 경우 */
    offlineAct: undefined as 'edit' | 'remove',
    /** 오프라인 행동의 기존 서버 키워드 정보 */
    originalInfo: undefined,
  }
  index = 0;
  isOfficial: string;
  target: string;
  /** 원본 게시물 정보 */
  OriginalInfo: any;
  /** 서버 정보 비교를 위한 문자열 구성 */
  OriginalServerInfo: string;
  /** 파일 읽기 멈추기 위한 컨트롤러 */
  cont: AbortController;

  ngOnInit() {
    this.voidDrawContextId = `add_post_voiddraw_${Date.now()}`;
    this.cont = new AbortController();
    this.UseOutLink = true;
    this.toggle_open_link(this.UseOutLink);
    this.route.queryParams.subscribe(async _p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      let InitAct = false;
      if (navParams) {
        InitAct = Boolean(navParams.act);
        if (navParams.data) this.userInput = navParams.data;
        this.toggle_custom_attach(this.userInput?.CDN || 0);
      }
      this.lock_modal_open = false;
      if (!InitAct) return;
      this.LoadListServer();
      if (this.servers.length > 1) this.index = 1;
      /** 편집하기로 들어왔다면 */
      if (navParams && navParams.data) {
        // 로컬이라면 첫번째 서버로 설정
        const inputServerInfo = `${this.userInput.server.isOfficial}/${this.userInput.server.target}`;
        for (let i = 0, j = this.servers.length; i < j; i++) {
          const ServerInfo = `${this.servers[i].isOfficial}/${this.servers[i].target}`;
          if (ServerInfo == inputServerInfo) {
            this.index = i;
            break;
          }
        }
        // 대표 이미지가 있다면 구성
        if (this.userInput.mainImage) {
          let FileURL = this.userInput.mainImage['url'];
          if (!FileURL) {
            FileURL = URL.createObjectURL(this.userInput.mainImage.blob);
          }
          this.MainPostImage = FileURL;
        }
        for (let i = 0, j = this.userInput.attachments.length; i < j; i++)
          if (this.userInput.attachments[i].viewer == 'image') {
            if (this.userInput.attachments[i].url)
              this.userInput.attachments[i].thumbnail = this.userInput.attachments[i].url;
            else {
              const blob = await this.indexed.loadBlobFromUserPath(this.userInput.attachments[i].path, this.userInput.attachments[i].type);
              const FileURL = URL.createObjectURL(blob);
              this.userInput.attachments[i].thumbnail = FileURL;
              setTimeout(() => {
                URL.revokeObjectURL(FileURL);
              }, 1000);
            }
          }
        this.UseOutLink = Boolean(this.userInput.OutSource);
        this.toggle_open_link(this.UseOutLink);
        this.OriginalInfo = JSON.parse(JSON.stringify(this.userInput));
      }
      try {
        this.OriginalServerInfo = `${this.userInput.server.isOfficial}/${this.userInput.server.target}`;
      } catch (e) {
        console.log('게시물에 기록된 서버 정보 받기 실패: ', e);
      }
      this.select_server(this.index);
    });
    // 드랍이기도 하나 보이스 관리를 겸하므로 플랫폼 무관 생성
    setTimeout(() => {
      if (this.WillLeavePage) return;
      this.CreateDrop();
    }, 100);
    this.nakama.StatusBarChangedCallback = () => {
      this.LoadListServer();
      this.select_server(0);
    };
  }

  LoadListServer() {
    this.servers = this.nakama.get_all_server_info(true, true);
    /** 이 기기에 저장에 사용하는 정보 */
    const local_info = {
      name: this.lang.text['AddGroup']['UseLocalStorage'],
      isOfficial: 'local',
      target: 'target',
      local: true,
    };
    this.servers.unshift(local_info);
  }

  /** 정확히 현재 페이지가 처리되어야하는 경우 사용 */
  async WaitingCurrent() {
    while (this.WillLeavePage) {
      await new Promise((done) => setTimeout(done, 0));
    }
  }

  p5canvas: p5;
  p5StartVoiceTimer: Function;
  p5StopVoiceTimer: Function;
  CreateDrop() {
    let parent = document.getElementById('p5Drop_addPost');
    if (!this.p5canvas)
      this.p5canvas = new p5((p: p5) => {
        let VoiceStartTime = 0;
        p.setup = () => {
          let canvas = p.createCanvas(parent.clientWidth, parent.clientHeight);
          canvas.parent(parent);
          p.pixelDensity(.1);
          canvas.drop(async (file: any) => {
            await this.selected_blobFile_callback_act(file.file);
          });
          p.noLoop();
          this.p5StartVoiceTimer = () => {
            p.loop();
            VoiceStartTime = p.millis();
          }
          this.p5StopVoiceTimer = () => {
            p.noLoop();
          }
        }
        p.draw = () => {
          if (this.useVoiceRecording)
            this.extended_buttons[5].name = millis_to_timeDisplay(p.millis() - VoiceStartTime);
        }
        let millis_to_timeDisplay = (m: number) => {
          let second_calc = m / 1000;
          let second = p.floor(second_calc) % 60;
          let minite_calc = second_calc / 60;
          let minite = p.floor(minite_calc) % 60;
          let hour = p.floor(minite_calc / 60);
          let result = hour ? `${hour}:${p.nf(minite, 2)}:${p.nf(second, 2)}` : `${minite}:${p.nf(second, 2)}`;
          return result;
        }
        p.mouseMoved = (ev: any) => {
          if (ev['dataTransfer']) {
            parent.style.pointerEvents = 'all';
            parent.style.backgroundColor = '#0008';
          } else {
            parent.style.pointerEvents = 'none';
            parent.style.backgroundColor = 'transparent';
          }
        }
        p.keyPressed = async (ev) => {
          if (this.WillLeavePage) return;
          switch (ev['key']) {
            case 'Enter':
              if (document.activeElement == this.TitleInput)
                setTimeout(() => {
                  this.ContentTextArea.focus();
                }, 0);
              if (ev['ctrlKey'])
                this.postData();
              break;
          }
        }
      });
  }

  ContentTextArea: HTMLTextAreaElement;
  /** 게시물 제목 작성칸 */
  TitleInput: HTMLInputElement;
  /** 타이틀 입력칸에 포커스되어있는지 여부 */
  CheckIfTitleInputFocus = false;
  /** 기존 게시물 편집 여부 */
  isModify = false;
  ionViewWillEnter() {
    this.global.portalHint = false;
    this.WillLeavePage = false;
    this.TitleInput = document.getElementById('add_post_title').childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
    if (!this.TitleInput.onblur)
      this.TitleInput.onblur = () => {
        this.CheckIfTitleInputFocus = false;
      }
    if (!this.TitleInput.onfocus)
      this.TitleInput.onfocus = () => {
        this.CheckIfTitleInputFocus = true;
      }
    if (!this.TitleInput.onpaste)
      this.TitleInput.onpaste = (ev: any) => {
        let stack = [];
        for (const clipboardItem of ev.clipboardData.files)
          stack.push({ file: clipboardItem });
        if (!stack.length) return;
        if (stack.length == 1)
          this.ChangeMainPostImage({ target: { files: [stack[0].file] } });
        return false;
      }
    this.ContentTextArea = document.getElementById('add_post_content') as HTMLTextAreaElement;
    setTimeout(() => {
      if (isPlatform == 'DesktopPWA') {
        if (!this.userInput.title)
          this.TitleInput.focus();
        else this.ContentTextArea.focus();
      }
    }, 200);
    if (!this.ContentTextArea.onpaste)
      this.ContentTextArea.onpaste = (ev: any) => {
        let stack = [];
        for (const clipboardItem of ev.clipboardData.files)
          stack.push({ file: clipboardItem });
        if (!stack.length) return;
        for (let i = 0, j = stack.length; i < j; i++)
          this.selected_blobFile_callback_act(stack[i].file);
        return false;
      }
    this.isModify = Boolean(this.userInput.id);
  }

  voidDrawContextId = 'add_post_voiddraw';
  /** 이미지를 불러온 후 즉시 그림판에 대입하기 */
  async SelectVoidDrawBackgroundImage(ev: any) {
    const file: File = ev.target.files[0];
    const TMP_PATH = `tmp_files/add_post/${file.name}`;
    await this.indexed.saveBlobToUserPath(file, TMP_PATH);
    let blob = await this.indexed.loadBlobFromUserPath(TMP_PATH, file.type);
    const FileURL = URL.createObjectURL(blob);
    new p5((p: p5) => {
      p.setup = () => {
        document.getElementById(this.voidDrawContextId)['value'] = '';
        p.noCanvas();
        p.loadImage(FileURL, v => {
          this.global.PageDismissAct['add-post-new-image-quick'] = async (v: any) => {
            if (v.data) {
              this.AddAttachTextForm();
              await this.voidDraw_fileAct_callback(v);
            }
            delete this.global.PageDismissAct['add-post-new-image-quick'];
          }
          this.global.ActLikeModal('portal/community/add-post/void-draw', {
            path: TMP_PATH,
            width: v.width,
            height: v.height,
            type: file.type,
            dismiss: 'add-post-new-image-quick',
          });
          URL.revokeObjectURL(FileURL);
          p.remove();
        }, e => {
          console.log('빠른 편집기 이동 실패: ', e);
          URL.revokeObjectURL(FileURL);
          p.remove();
        });
      }
    });
  }

  ionViewDidEnter() {
    if (!this.WillLeavePageInside)
      this.global.StoreShortCutAct('AddPostPage');
    this.WillLeavePageInside = false;
    this.AddShortcut();
  }

  go_to_profile() {
    this.nakama.open_profile_page({
      isOfficial: this.isOfficial,
      target: this.target,
    });
  }

  /** 서버 선택지 열림 여부 */
  isExpanded = false;
  /** 첨부파일 리스트 열림 여부 */
  isAttachExpanded = false;
  /** 저장버튼 눌림 여부 */
  isSaveClicked = false;
  /** 게시 서버 변경 여부, 이 경우 기존 서버에서 삭제 후 다시 등록해야함 */
  isServerChanged = false;
  /** 아코디언에서 서버 선택하기
   * @param [changed=false] 사용자가 직접 수정했을 경우 기억
   */
  select_server(i: number, changed = false) {
    this.index = i;
    this.userInput.server = this.servers[i];
    this.isExpanded = false;
    this.isOfficial = this.servers[i].isOfficial;
    this.target = this.servers[i].target;
    if (changed) {
      this.isServerChanged = this.OriginalServerInfo != `${this.isOfficial}/${this.target}`;
      delete this.userInput.originalInfo;
      delete this.userInput.offlineAct;
    }
    this.userInput.creator_name = this.nakama.users.self['display_name'];
    try { // 변경된 서버 user_id 를 적용함
      this.userInput.creator_id = this.nakama.servers[this.isOfficial][this.target].session.user_id;
      this.userInput.UserColor = (this.userInput.creator_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
      this.extended_buttons[7].isHide = this.userInput.CDN == 2;
    } catch (e) { // 그게 아니라면 로컬입니다
      this.userInput.creator_id = 'me';
      this.userInput.UserColor = '888888';
      this.extended_buttons[7].isHide = true;
      this.toggle_open_link(true);
    }
    if (isPlatform == 'DesktopPWA' && this.TitleInput)
      this.TitleInput.focus();
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5KeyShortCut) {
      this.global.p5KeyShortCut['Escape'] = () => {
        this.navCtrl.navigateBack('portal/community');
      };
    }
  }

  useVoiceRecording = false;
  /** 게시물 편집기에서 보여지는 대표 이미지 링크 주소 */
  MainPostImage = null;
  /** 확장 버튼 행동들 */
  extended_buttons: ExtendButtonForm[] = [
    { // 0
      icon: 'image-outline',
      name: this.lang.text['AddPost']['MainPostImage'],
      act: () => {
        if (this.isSaveClicked) return;
        if (!this.MainPostImage)
          document.getElementById('PostMainImage_sel').click();
        else {
          URL.revokeObjectURL(this.MainPostImage);
          this.MainPostImage = null;
          this.userInput.mainImage = undefined;
          let input = document.getElementById('PostMainImage_sel') as HTMLInputElement;
          input.value = '';
        }
      },
      context: () => {
        let contextAct = async () => {
          let pasted_url: string;
          try {
            try {
              let clipboard = await this.global.GetValueFromClipboard('add_post');
              switch (clipboard.type) {
                case 'text/plain':
                  pasted_url = clipboard.value;
                  break;
                case 'image/png':
                  this.ChangeMainPostImage({ target: { files: [clipboard.value] } });
                  return;
                case 'error':
                  throw clipboard.value;
              }
            } catch (e) {
              throw e;
            }
            try { // DataURL 주소인지 검토
              let blob = this.global.Base64ToBlob(pasted_url);
              let getType = pasted_url.split(';')[0].split(':')[1];
              let file = new File([blob],
                `${this.lang.text['ChatRoom']['FileLink']}.${getType.split('/').pop()}`, {
                type: getType,
              });
              this.ChangeMainPostImage({ target: { files: [file] } });
              throw 'done';
            } catch (e) {
              switch (e) {
                case 'done':
                  throw e;
              }
            }
            try { // 정상적인 주소인지 검토
              if (pasted_url.indexOf('http:') != 0 && pasted_url.indexOf('https:') != 0) throw '올바른 웹 주소가 아님';
            } catch (e) {
              throw e;
            }
            let this_file: FileInfo = {};
            this_file.url = pasted_url;
            this_file['content_related_creator'] = [];
            this_file['content_related_creator'].push({
              user_id: this.isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
              timestamp: new Date().getTime(),
              display_name: this.nakama.users.self['display_name'],
              various: 'link',
            });
            this_file['content_creator'] = {
              user_id: this.isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
              timestamp: new Date().getTime(),
              display_name: this.nakama.users.self['display_name'],
              various: 'link',
            };
            let sep = this_file.url.split('.');
            this_file.file_ext = sep.pop().split('?').shift();
            this_file.filename = decodeURIComponent(`${sep.pop().split('/').pop() || this.lang.text['ChatRoom']['ExternalLinkFile']}.${this_file.file_ext}`);
            this.global.set_viewer_category_from_ext(this_file);
            this_file.type = '';
            this_file.typeheader = this_file.viewer;
            this.global.modulate_thumbnail(this_file, this_file.url, this.cont);
            this.userInput.mainImage = this_file;
            this.MainPostImage = this_file.url;
          } catch (e) {
            if (e == 'done')
              throw e;
            else throw `인식 불가능한 URL 정보: ${e}`;
          }
        }
        contextAct();
        return false;
      },
    },
    { // 1
      icon: 'document-attach-outline',
      name: this.lang.text['ChatRoom']['attachments'],
      act: () => {
        if (this.isSaveClicked) return;
        this.new_attach({ detail: { value: 'load' } });
      },
      context: () => {
        if (this.isSaveClicked) return;
        this.new_attach({ detail: { value: 'link' } });
        return false;
      }
    }, { // 2
      icon_img: 'voidDraw.png',
      name: this.lang.text['ChatRoom']['voidDraw'],
      act: async () => {
        if (this.isSaveClicked) return;
        this.WillLeavePageInside = true;
        this.global.PageDismissAct['add-post-new-image'] = async (v: any) => {
          if (v.data) {
            this.AddAttachTextForm();
            await this.voidDraw_fileAct_callback(v);
          }
          delete this.global.PageDismissAct['add-post-new-image'];
        }
        this.global.ActLikeModal('portal/community/add-post/void-draw', {
          dismiss: 'add-post-new-image',
        });
      },
      context: () => {
        let Quicklink = async () => {
          let clipboard = await this.global.GetValueFromClipboard('voiddraw');
          switch (clipboard.type) {
            // 이미지인 경우 파일 뷰어로 열기
            case 'image/png':
              const file: File = clipboard.value;
              this.SelectVoidDrawBackgroundImage({ target: { files: [file] } });
              break;
            default:
              document.getElementById(this.voidDrawContextId).click();
              break;
          }
        }
        Quicklink();
        return false;
      }
    },
    { // 3
      icon: 'reader-outline',
      name: this.lang.text['ChatRoom']['newText'],
      act: async () => {
        let props = {
          info: {
            content: {
              is_new: undefined,
              type: 'text/plain',
              viewer: 'text',
              filename: undefined,
              path: undefined,
            },
          },
          no_edit: undefined,
          dismiss: 'add-post-viewer',
        };
        props.info.content.is_new = 'text';
        props.info.content.filename = this.global.TextEditorNewFileName();
        props.no_edit = true;
        this.WillLeavePageInside = true;
        this.global.PageDismissAct['add-post-viewer'] = (v: any) => {
          if (v.data) {
            let this_file: FileInfo = this.global.TextEditorAfterAct(v.data, {
              display_name: this.nakama.users.self['display_name'],
            });
            this.AddAttachTextForm();
            this.userInput.attachments.push(this_file);
          }
          delete this.global.PageDismissAct['add-post-viewer'];
        }
        this.global.ActLikeModal('portal/community/add-post/ionic-viewer', props);
      }
    }, { // 4
      icon: 'camera-outline',
      name: this.lang.text['ChatRoom']['Camera'],
      act: async () => {
        if (this.isSaveClicked) return;
        try {
          let result = await this.global.from_camera('tmp_files/post/', {
            user_id: this.isOfficial == 'local' ? undefined : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            display_name: this.nakama.users.self['display_name']
          }, 'add_post');
          this.AddAttachTextForm();
          this.userInput.attachments.push(result);
        } catch (e) { }
      }
    }, { // 5
      icon: 'mic-circle-outline',
      name: this.lang.text['ChatRoom']['Voice'],
      act: async () => {
        if (this.isSaveClicked) return;
        if (this.global.useVoiceRecording && this.global.useVoiceRecording != 'PostRecording') {
          this.p5toast.show({
            text: this.lang.text['GlobalAct'][this.global.useVoiceRecording],
          });
          return;
        }
        this.useVoiceRecording = !this.useVoiceRecording;
        if (this.useVoiceRecording) { // 녹음 시작
          let req = await VoiceRecorder.hasAudioRecordingPermission();
          if (req.value) { // 권한 있음
            this.global.useVoiceRecording = 'PostRecording';
            this.extended_buttons[5].icon = 'stop-circle-outline';
            this.p5loading.toast(this.lang.text['ChatRoom']['StartVRecord'], 'add_post');
            this.p5StartVoiceTimer();
            await VoiceRecorder.startRecording();
            this.CreateFloatingVoiceTimeHistoryAddButton();
          } else { // 권한이 없다면 권한 요청 및 UI 복구
            this.useVoiceRecording = false;
            this.extended_buttons[5].icon = 'mic-circle-outline';
            await VoiceRecorder.requestAudioRecordingPermission();
          }
        } else await this.StopAndSaveVoiceRecording();
      }
    }, { // 6
      icon: 'cloud-done-outline',
      name: this.lang.text['ChatRoom']['Detour'],
      act: () => {
        this.toggle_custom_attach();
      }
    }, { // 7
      icon: 'globe-outline',
      name: this.lang.text['AddPost']['NoOutLink'],
      act: () => {
        this.toggle_open_link();
      }
    }];

  /** 녹음중인 음성의 시간을 기록함 */
  AddVoiceTimeHistory() {
    let result = `{"i":"n","t":"${this.extended_buttons[5].name}"}`;
    /** 마지막에 작성되어있던 텍스트 받아오기 */
    const LastText = this.ContentTextArea.value;
    /** 커서 위치에 첨부파일 앵커 텍스트 생성하기 */
    const CursorPosition = this.ContentTextArea.selectionStart;
    /** 커서 앞 텍스트들 */
    const FrontText = LastText.substring(0, CursorPosition);
    // 커서가 처음을 가르키는게 아니라면 머릿말 검토처리
    if (CursorPosition != 0) {
      /** 커서 전 텍스트 끝에서 첫번째 글자 */
      const FrontLastOne = FrontText.charAt(FrontText.length - 1);
      if (FrontLastOne != '\n') result = '\n' + result;
      // 커서가 2번째 글짜 이후로, 엔터 검토가 한번 더 필요하다면
      if (CursorPosition > 1) {
        /** 커서 전 텍스트 끝에서 두번째 글자 */
        const FrontLastTwo = FrontText.charAt(FrontText.length - 2);
        if (FrontLastTwo != '\n') result = '\n' + result;
      }
    }
    /** 커서 이후의 텍스트들 */
    const BackText = LastText.substring(CursorPosition);
    const BackFirst = BackText.charAt(0);
    if (BackFirst != '\n') result += '\n';
    /** 커서 전 텍스트 끝에서 두번째 글자 */
    const BackSecond = BackText.charAt(1);
    if (BackSecond != '\n') result += '\n';
    this.userInput.content = `${FrontText}${result}${BackText}`;
    this.ContentTextArea.focus();
  }

  /** 페이지는 벗어났으나 계속 녹음을 유지중일 때 floating 버튼을 사용 */
  CreateFloatingVoiceTimeHistoryAddButton() {
    this.floatButton.RemoveFloatButton('addpost-timer');
    let float_button = this.floatButton.AddFloatButton('addpost-timer', 'timer-outline');
    float_button.mouseClicked(() => {
      this.AddVoiceTimeHistory();
      this.p5toast.show({
        text: `${this.lang.text['AddPost']['RecordVoiceTime']}: ${this.extended_buttons[5].name}`,
      });
    });
  }

  async StopAndSaveVoiceRecording() {
    this.floatButton.RemoveFloatButton('addpost-timer');
    const actId = 'add_post';
    this.p5loading.update({
      id: actId,
      message: this.lang.text['AddPost']['SavingRecord'],
    });
    try {
      let blob = await this.global.StopAndSaveVoiceRecording();
      await this.selected_blobFile_callback_act(blob);
    } catch (e) { }
    this.p5loading.remove(actId);
    this.extended_buttons[5].icon = 'mic-circle-outline';
    this.extended_buttons[5].name = this.lang.text['ChatRoom']['Voice'];
    this.checkVoiceLinker();
  }

  /** 게시물 내용에 음성 시간 링크가 있는지 확인 */
  checkVoiceLinker() {
    if (this.p5StopVoiceTimer) this.p5StopVoiceTimer();
    let content_as_line = this.userInput.content.split('\n');
    for (let i = 0, j = content_as_line.length; i < j; i++)
      try {
        let json = JSON.parse(content_as_line[i]);
        // 순번이 지정되지 않은 녹음위치 정보를 마지막 녹음의 소유로 판단
        if (json['i'] == 'n') json['i'] = this.userInput.attachments.length - 1;
        content_as_line[i] = JSON.stringify(json);
      } catch (e) { }
    this.userInput.content = content_as_line.join('\n');
  }

  /** 채널 배경화면 변경 (from PostMainImage_sel) */
  ChangeMainPostImage(ev: any) {
    let blob = ev.target.files[0];
    let file = {} as FileInfo;
    file['filename'] = blob.name;
    file['file_ext'] = blob.name.split('.').pop() || blob.type || this.lang.text['ChatRoom']['unknown_ext'];
    file['size'] = blob.size;
    file['type'] = blob.type || blob.type_override;
    file.blob = blob;
    file.path = `tmp_files/post/MainImage.${file['file_ext']}`;
    this.userInput.mainImage = file;
    const FileURL = URL.createObjectURL(blob);
    this.indexed.saveBlobToUserPath(blob, file.path);
    this.MainPostImage = FileURL;
    this.p5loading.update({
      id: 'add_post',
      message: this.lang.text['AddPost']['SyncMainImage'],
      image: this.MainPostImage,
      forceEnd: 1000,
    });
  }

  /** 파일이 선택되고 나면 */
  async selected_blobFile_callback_act(blob: any, contentRelated: ContentCreatorInfo[] = [], various = 'loaded', index?: number) {
    let file = this.global.selected_blobFile_callback_act(blob, 'tmp_files/post/', {
      user_id: this.isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
      display_name: this.nakama.users.self['display_name'],
    }, various, contentRelated);
    await this.create_selected_thumbnail(file);
    if (index === undefined) {
      this.AddAttachTextForm();
      this.userInput.attachments.push(file);
    } else this.userInput.attachments[index] = file;
    this.indexed.saveBlobToUserPath(file.blob, file.path);
  }

  /** 게시물 내용에 첨부파일 링크를 추가함 */
  AddAttachTextForm() {
    let result = `{${this.userInput.attachments.length}}`;
    /** 마지막에 작성되어있던 텍스트 받아오기 */
    const LastText = this.ContentTextArea.value;
    /** 커서 위치에 첨부파일 앵커 텍스트 생성하기 */
    const CursorPosition = this.ContentTextArea.selectionStart;
    /** 커서 앞 텍스트들 */
    const FrontText = LastText.substring(0, CursorPosition);
    // 커서가 처음을 가르키는게 아니라면 머릿말 검토처리
    if (CursorPosition != 0) {
      /** 커서 전 텍스트 끝에서 첫번째 글자 */
      const FrontLastOne = FrontText.charAt(FrontText.length - 1);
      if (FrontLastOne != '\n') result = '\n' + result;
      // 커서가 2번째 글짜 이후로, 엔터 검토가 한번 더 필요하다면
      if (CursorPosition > 1) {
        /** 커서 전 텍스트 끝에서 두번째 글자 */
        const FrontLastTwo = FrontText.charAt(FrontText.length - 2);
        if (FrontLastTwo != '\n') result = '\n' + result;
      }
    }
    /** 커서 이후의 텍스트들 */
    const BackText = LastText.substring(CursorPosition);
    const BackFirst = BackText.charAt(0);
    if (BackFirst != '\n') result += '\n';
    /** 커서 전 텍스트 끝에서 두번째 글자 */
    const BackSecond = BackText.charAt(1);
    if (BackSecond != '\n') result += '\n';
    this.userInput.content = `${FrontText}${result}${BackText}`;
    this.ContentTextArea.focus();
  }

  /** 선택한 파일의 썸네일 만들기 */
  async create_selected_thumbnail(file: FileInfo) {
    this.global.set_viewer_category_from_ext(file);
    if (file.url) {
      try {
        let res = await fetch(file.url, { method: 'HEAD', signal: this.cont.signal });
        if (res.ok) file.thumbnail = file.url;
      } catch (e) { }
      file.typeheader = file.viewer;
      return;
    } else try {
      file.thumbnail = await this.indexed.loadBlobFromUserPath(file.path, file.type);
    } catch (e) { }
    const FileURL = URL.createObjectURL(file.blob);
    this.p5loading.update({
      id: 'add_post',
      image: file.viewer == 'image' ? FileURL : null,
    }, true);
    file['typeheader'] = file.blob.type.split('/')[0] || file.viewer;
    setTimeout(() => {
      URL.revokeObjectURL(FileURL);
    }, 0);
    file['thumbnail'] = undefined;
    switch (file['typeheader']) {
      case 'image': // 이미지인 경우 사용자에게 보여주기
        file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(FileURL);
        break;
    }
  }

  async voidDraw_fileAct_callback(v: any, related_creators?: any, index?: number) {
    let file = await this.global.voidDraw_fileAct_callback(v, 'tmp_files/post/', {
      user_id: this.isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
      display_name: this.nakama.users.self['display_name'],
    }, related_creators);
    file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
    if (index !== undefined)
      this.userInput.attachments[index] = file;
    else this.userInput.attachments.push(file);
    this.p5loading.remove(v.data['loadingCtrl']);
  }

  /** 첨부 파일 타입 정하기 */
  async new_attach(ev: any) {
    switch (ev.detail.value) {
      case 'load':
        document.getElementById('add_post_input').click();
        break;
      case 'link':
        let pasted_url: string;
        try {
          try {
            let clipboard = await this.global.GetValueFromClipboard('add_post');
            switch (clipboard.type) {
              case 'text/plain':
                pasted_url = clipboard.value;
                break;
              case 'image/png':
                this.inputFileSelected({ target: { files: [clipboard.value] } });
                return;
              case 'error':
                throw clipboard.value;
            }
          } catch (e) {
            throw e;
          }
          try { // DataURL 주소인지 검토
            let blob = this.global.Base64ToBlob(pasted_url);
            let getType = pasted_url.split(';')[0].split(':')[1];
            let file = new File([blob],
              `${this.lang.text['ChatRoom']['FileLink']}.${getType.split('/').pop()}`, {
              type: getType,
            });
            await this.selected_blobFile_callback_act(file);
            throw 'done';
          } catch (e) {
            switch (e) {
              case 'done':
                throw e;
            }
          }
          try { // 정상적인 주소인지 검토
            if (pasted_url.indexOf('http:') != 0 && pasted_url.indexOf('https:') != 0) throw '올바른 웹 주소가 아님';
          } catch (e) {
            throw e;
          }
          let this_file: FileInfo = {};
          this_file.url = pasted_url;
          this_file['content_related_creator'] = [];
          this_file['content_related_creator'].push({
            user_id: this.isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'link',
          });
          this_file['content_creator'] = {
            user_id: this.isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'link',
          };
          let sep = this_file.url.split('.');
          this_file.file_ext = sep.pop().split('?').shift();
          this_file.filename = decodeURIComponent(`${sep.pop().split('/').pop() || this.lang.text['ChatRoom']['ExternalLinkFile']}.${this_file.file_ext}`).split('/').pop();
          this.global.set_viewer_category_from_ext(this_file);
          this_file.type = '';
          this_file.typeheader = this_file.viewer;
          this.global.modulate_thumbnail(this_file, this_file.url, this.cont);
          this.AddAttachTextForm();
          this.userInput.attachments.push(this_file);
        } catch (e) {
          if (e == 'done')
            throw e;
          else throw `인식 불가능한 URL 정보: ${e}`;
        }
        break;
    }
  }

  /** 첨부파일 우클릭하여 삭제 */
  PostAttachContextMenu(i: number) {
    this.alertCtrl.create({
      header: this.lang.text['AddPost']['RemoveAttach'],
      message: `{${i}} ${this.userInput.attachments[i].filename}`,
      buttons: [{
        text: this.lang.text['UserFsDir']['RemoveApply'],
        handler: () => {
          this.nakama.RemoveCurrentPostAttach(i, this.userInput);
        },
        cssClass: 'redfont',
      }]
    }).then(v => v.present());
    return false;
  }

  /** 파일 첨부하기 */
  async inputFileSelected(ev: any) {
    if (ev.target?.files?.length) {
      const actId = 'add_post';
      let is_multiple_files = ev.target.files.length != 1;
      if (is_multiple_files) {
        this.p5loading.update({
          id: actId,
          message: this.lang.text['ContentViewer']['OnLoadContent'],
          progress: 0,
        });
        for (let i = 0, j = ev.target.files.length; i < j; i++) {
          this.p5loading.update({
            id: actId,
            message: `${this.lang.text['ContentViewer']['OnLoadContent']}: ${ev.target.files[i].name}`,
            progress: i / j,
          });
          await this.selected_blobFile_callback_act(ev.target.files[i]);
        }
        this.p5loading.remove(actId);
        setTimeout(() => {
          let input = document.getElementById('add_post_input') as HTMLInputElement;
          input.value = '';
        }, 300);
      } else {
        this.p5loading.update({
          id: actId,
        });
        await this.selected_blobFile_callback_act(ev.target.files[0]);
        this.p5loading.remove(actId);
        let input = document.getElementById('add_post_input') as HTMLInputElement;
        input.value = '';
      }
    }
  }

  lock_modal_open = false;
  open_viewer(info: FileInfo, index: number) {
    let attaches = [];
    for (let i = 0, j = this.userInput.attachments.length; i < j; i++)
      attaches.push({ content: this.userInput.attachments[i] });
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      this.global.PageDismissAct['add-post-open-viewer'] = async (v: any) => {
        if (v.data) { // 파일 편집하기를 누른 경우
          switch (v.data.type) {
            case 'image':
              let related_creators: ContentCreatorInfo[] = [];
              if (v.data.msg.content['content_related_creator'])
                related_creators = [...v.data.msg.content['content_related_creator']];
              if (v.data.msg.content['content_creator']) { // 마지막 제작자가 이미 작업 참여자로 표시되어 있다면 추가하지 않음
                let is_already_exist = false;
                for (let i = 0, j = related_creators.length; i < j; i++)
                  if (related_creators[i].user_id == v.data.msg.content['content_creator']['user_id']) {
                    is_already_exist = true;
                    break;
                  }
                if (!is_already_exist) related_creators.push(v.data.msg.content['content_creator']);
              }
              this.global.PageDismissAct['add-post-modify-image'] = async (v: any) => {
                if (v.data) await this.voidDraw_fileAct_callback(v, related_creators, index);
                delete this.global.PageDismissAct['add-post-modify-image'];
              }
              await this.WaitingCurrent();
              this.WillLeavePageInside = true;
              this.global.ActLikeModal('portal/community/add-post/void-draw', {
                path: v.data.path || info.path,
                width: v.data.width,
                height: v.data.height,
                type: v.data.filetype,
                isDarkMode: v.data.isDarkMode,
                scrollHeight: v.data.scrollHeight,
                dismiss: 'add-post-modify-image',
              });
              return;
            case 'text':
              await this.selected_blobFile_callback_act(v.data.blob, v.data.contentRelated, 'textedit', index);
              break;
          }
        }
        delete this.global.PageDismissAct['add-post-open-viewer'];
      }
      this.WillLeavePageInside = true;
      this.global.ActLikeModal('portal/community/add-post/ionic-viewer', {
        info: { content: info },
        path: info.path,
        alt_path: info.path,
        isOfficial: this.isOfficial,
        target: this.target,
        relevance: attaches,
        dismiss: 'add-post-open-viewer',
      });
    }
  }

  async toggle_custom_attach(force?: number) {
    this.userInput.CDN = (force ?? (this.userInput.CDN + 1)) % 3;
    switch (this.userInput.CDN) {
      case 0: // 기본값, cdn 서버 우선, 실패시 SQL
        this.extended_buttons[6].icon = 'cloud-offline-outline';
        this.extended_buttons[6].name = this.lang.text['ChatRoom']['Detour'];
        break;
      case 1: // FFS 서버 우선, 실패시 cdn, SQL 순
        this.extended_buttons[6].icon = 'cloud-done-outline';
        this.extended_buttons[6].name = this.lang.text['ChatRoom']['useFSS'];
        break;
      case 2: // SQL 강제
        this.extended_buttons[6].icon = 'server-outline';
        this.extended_buttons[6].name = this.lang.text['ChatRoom']['forceSQL'];
        break;
    }
  }

  UseOutLink = false;
  /** 외부 완전 공개 여부를 검토 */
  async toggle_open_link(force?: boolean) {
    this.UseOutLink = force ?? !this.UseOutLink;
    if (this.UseOutLink) {
      this.extended_buttons[7].icon = 'link-outline';
      this.extended_buttons[7].name = this.lang.text['AddPost']['UseOutLink'];
    } else {
      this.extended_buttons[7].icon = 'globe-outline';
      this.extended_buttons[7].name = this.lang.text['AddPost']['NoOutLink'];
    }
  }

  /** 작성중이던 내용을 뷰어에서 열어보기 */
  showPreview() {
    this.global.RemoveAllModals(() => {
      this.navCtrl.navigateForward('portal/community/add-post/post-viewer', {
        state: {
          data: this.userInput,
          index: -1,
        },
      });
    });
  }

  /** 게시물 등록하기 버튼을 눌러 데이터 변경하기가 이루어졌는지 여부 */
  isApplyPostData = false;
  /** 게시물 등록하기  
   * 글 내용이 길어질 수 있으므로 글이 아무리 짧더라도 txt 파일로 변환하여 게시
   */
  async postData() {
    if (!this.userInput.title) {
      this.p5toast.show({
        text: this.lang.text['AddPost']['NeedPostTitle'],
      });
      this.TitleInput.focus();
      return;
    }
    /** 온라인 게시물을 오프라인에서 편집한 것으로 추정되는 경우 */
    const isOfflineEdit = this.isModify && !this.isServerChanged && this.OriginalServerInfo != `${this.isOfficial}/${this.target}`;
    // 오프라인에서 편집됨을 표시한 경우, 로컬에 편집된 내용을 저장하기 (오프라인 작업 최초 1회에 한하여)
    if (isOfflineEdit && !this.userInput.originalInfo) {
      const originalInfo = JSON.parse(JSON.stringify(this.OriginalInfo));
      this.select_server(0, true);
      this.userInput.originalInfo = originalInfo;
      this.userInput.offlineAct = 'edit';
      this.OriginalInfo.offlineAct = 'edit';
    }
    this.isApplyPostData = true;
    this.navCtrl.navigateBack('portal/community');
    const actId = `postData_${Date.now()}`;
    await this.p5loading.update({
      id: actId,
      message: `${this.lang.text['AddPost']['WIP']}: ${this.userInput.title}`,
      forceEnd: null,
    });
    // 음성 녹음중이라면 녹음을 마무리하여 파일로 저장한 후 게시물 저장처리 진행
    if (this.useVoiceRecording) await this.StopAndSaveVoiceRecording();
    /** 로컬 서버인지 여부 */
    let is_local = Boolean(this.userInput.server['local']);
    this.isSaveClicked = true;
    let isOfficial = this.userInput.server['isOfficial'];
    let target = this.userInput.server['target'];
    let isCDNChanged = this.OriginalInfo?.CDN != this.userInput.CDN;
    delete this.userInput['router'];
    // 편집된 게시물이라면 첨부파일을 전부다 지우고 다시 등록
    if (this.isModify || isCDNChanged || this.isServerChanged) {
      if (this.userInput.mainImage && this.userInput.mainImage.url) {
        try {
          let res = await fetch(this.userInput.mainImage.url);
          if (res.ok) this.userInput.mainImage.blob = await res.blob();
        } catch (e) { }
        delete this.userInput.mainImage.thumbnail;
        delete this.userInput.mainImage.alt_path;
        delete this.userInput.mainImage['MainThumbnail'];
        if (this.userInput.mainImage.url) {
          let sep = this.userInput.mainImage.url.split('/');
          while (sep.shift() != 'cdn') { }
          this.userInput.mainImage.override_name = sep.pop();
          this.userInput.mainImage.override_path = sep.join('/');
          delete this.userInput.mainImage.url;
        }
      }
      // 첨부파일 기억하기
      for (let i = 0, j = this.userInput.attachments.length; i < j; i++) {
        if (!this.userInput.attachments[i].blob) {
          if (this.userInput.attachments[i]['url']) {
            try {
              const res = await fetch(this.userInput.attachments[i]['url']);
              const blob = await res.blob();
              this.userInput.attachments[i].blob = blob;
              delete this.userInput.attachments[i].thumbnail;
              delete this.userInput.attachments[i].alt_path;
              if (this.userInput.attachments[i].url) {
                let sep = this.userInput.attachments[i].url.split('/');
                while (sep.shift() != 'cdn') { }
                this.userInput.attachments[i].override_name = sep.pop();
                this.userInput.attachments[i].override_path = sep.join('/');
                delete this.userInput.attachments[i].url;
              }
            } catch (e) {
              continue;
            }
          } else {
            let blob = await this.indexed.loadBlobFromUserPath(this.userInput.attachments[i].path, this.userInput.attachments[i].type);
            this.userInput.attachments[i].blob = blob;
          }
        }
      }
      await this.nakama.RemovePost(this.userInput, false, actId);
      if (this.OriginalInfo) // 기존 게시물 정보 삭제
        await this.nakama.RemovePost(this.OriginalInfo, false, actId);
    }
    this.p5loading.update({
      id: actId,
      message: `${this.lang.text['AddPost']['WIP']}: ${this.userInput.title}`,
      progress: null,
    });
    try {
      // 게시물 아이디 구성하기
      if (!this.isModify || this.isServerChanged) { // 새 게시물 작성시에만 생성
        // 기존 게시물 순번 검토 후 새 게시물 번호 받아오기
        if (is_local) {
          let counter = Number(await this.indexed.loadTextFromUserPath('servers/local/target/posts/me/counter.txt')) || 0;
          this.userInput.id = `LocalPost_${counter}`;
          try {
            await this.indexed.saveTextFileToUserPath(`${counter + 1}`, 'servers/local/target/posts/me/counter.txt');
          } catch (e) {
            this.p5toast.show({
              text: `${this.lang.text['AddPost']['SyncErr']}: ${e}`,
            });
            console.log(e);
          }
        } else { // 서버 게시물인 경우
          try {
            let v = await this.nakama.servers[isOfficial][target].client.readStorageObjects(
              this.nakama.servers[isOfficial][target].session, {
              object_ids: [{
                collection: 'server_post',
                key: 'Counter',
                user_id: this.nakama.servers[isOfficial][target].session.user_id,
              }],
            });
            let CurrentCounter = 0;
            // 받은 정보로 아이디 구성
            if (v.objects.length) CurrentCounter = v.objects[0].value['counter'];
            this.userInput.id = `ServerPost_${CurrentCounter}`;
            // 카운터 업데이트
            await this.nakama.servers[isOfficial][target].client.writeStorageObjects(
              this.nakama.servers[isOfficial][target].session, [{
                collection: 'server_post',
                key: 'Counter',
                permission_write: 1,
                permission_read: 2,
                value: { counter: CurrentCounter + 1 },
              }]);
          } catch (e) {
            this.p5toast.show({
              text: `${this.lang.text['AddPost']['SyncErr']}: ${e}`,
            });
            console.log(e);
          }
        }
      }
      // 게시물 날짜 업데이트
      if (this.isModify)
        this.userInput.modify_time = new Date().getTime();
      else { // 생성 시간이 없다면 최초 생성으로 간주
        this.userInput.create_time = new Date().getTime();
        this.userInput.modify_time = this.userInput.create_time;
      }
      await this.nakama.AddPost(this.userInput, actId, this.UseOutLink, is_local, this.MainPostImage);
      this.nakama.rearrange_posts();
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['AddPost']['SyncErr']}: ${e}`,
      });
      console.warn('게시물 저장 처리 오류: ', e);
    }
    try {
      await this.nakama.servers[this.isOfficial][this.target].client.rpc(
        this.nakama.servers[this.isOfficial][this.target].session,
        'send_noti_all_fn', {
        noti_id: MatchOpCode.MANAGE_POST,
        type: 'add',
        user_id: this.userInput.creator_id,
        post_id: this.userInput.id,
        persistent: false,
      });
    } catch (e) { }
    await this.p5loading.update({
      id: actId,
      message: `${this.lang.text['AddPost']['WIP']}: ${this.userInput.title}`,
      progress: 1,
      forceEnd: 1000,
    });
  }

  /** 이 페이지를 떠날 예정 */
  WillLeavePage = false;
  /** 이 페이지 내에서 페이지가 전환됨 */
  WillLeavePageInside = false;
  ionViewWillLeave() {
    this.p5loading.update({
      id: 'add_post',
      forceEnd: 0,
    }, true);
    this.WillLeavePage = true;
    if (!this.WillLeavePageInside)
      this.global.RestoreShortCutAct('AddPostPage');
    delete this.global.p5KeyShortCut['Escape'];
    // 데이터 저장이 아니라면 기존 데이터를 다시 불러와서 게시물 정보 원복시키기
    if (!this.isApplyPostData) try {
      if (this.nakama.posts_orig[this.isOfficial][this.target][this.userInput.creator_id][this.userInput.id])
        delete this.nakama.posts_orig[this.isOfficial][this.target][this.userInput.creator_id][this.userInput.id];
      this.nakama.load_local_post_with_id(this.userInput.id, this.userInput.server.isOfficial, this.userInput.server.target, this.userInput.creator_id);
      this.nakama.rearrange_posts();
    } catch (e) { }
  }
}
