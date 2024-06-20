import { Component, OnDestroy, OnInit } from '@angular/core';
import { LoadingController, ModalController, NavController } from '@ionic/angular';
import { ContentCreatorInfo, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MatchOpCode, NakamaService, ServerInfo } from 'src/app/nakama.service';
import { GroupServerPage } from '../../settings/group-server/group-server.page';
import { P5ToastService } from 'src/app/p5-toast.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { ExtendButtonForm } from '../../subscribes/chat-room/chat-room.page';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { VoidDrawPage } from '../../subscribes/chat-room/void-draw/void-draw.page';
import { DomSanitizer } from '@angular/platform-browser';
import { VoiceRecorder } from "capacitor-voice-recorder";
import clipboard from "clipboardy";
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IonicViewerPage } from '../../subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { ActivatedRoute, Router } from '@angular/router';
import * as p5 from 'p5';
import { isPlatform } from 'src/app/app.component';

/** 첨부파일 리스트 양식  
 * [{ 주소(또는 경로), 자료 형식(url | data) }, ...]
 */
interface PostAttachment extends FileInfo {
  /** 데이터 구성요소
   * - url: 외부 링크 정보, url 텍스트가 작성됨
   * - part: nakama_parted 정보, 데이터 경로(collection-key)가 작성됨 (path)
   * - blob: 파일이 첨부됨, 게시물 작성 중일 때 사용되며 게시하는 과정에서 url 또는 part 로 변환됨
   */
  datatype?: 'url' | 'part' | 'blob';
}

@Component({
  selector: 'app-add-post',
  templateUrl: './add-post.page.html',
  styleUrls: ['./add-post.page.scss'],
})
export class AddPostPage implements OnInit, OnDestroy {
  constructor(
    private global: GlobalActService,
    public lang: LanguageSettingService,
    private navCtrl: NavController,
    private nakama: NakamaService,
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
    private loadingCtrl: LoadingController,
    private sanitizer: DomSanitizer,
    private mClipboard: Clipboard,
    private route: ActivatedRoute,
    private router: Router,
  ) { }

  ngOnDestroy(): void {
    if (this.p5canvas) this.p5canvas.remove();
    delete this.nakama.StatusBarChangedCallback;
    if (this.useVoiceRecording) this.StopAndSaveVoiceRecording();
    try {
      if (this.MainPostImage)
        setTimeout(() => {
          URL.revokeObjectURL(this.MainPostImage);
        }, 1000);
    } catch (e) { }
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
    server: undefined,
    /** 대표 이미지 설정 */
    mainImage: undefined as PostAttachment,
    attachments: [] as PostAttachment[],
    isNSFW: false,
  }
  index = 0;
  isOfficial: string;
  target: string;
  /** 원본 게시물 정보 */
  OriginalInfo: any;
  /** 서버 정보 비교를 위한 문자열 구성 */
  OriginalServerInfo: string;

  ngOnInit() {
    this.useFirstCustomCDN = Number(localStorage.getItem('useFFSCDN')) || 0;
    this.toggle_custom_attach(this.useFirstCustomCDN);
    this.route.queryParams.subscribe(async _p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      let InitAct = false;
      if (navParams) {
        InitAct = Boolean(navParams.act);
        if (navParams.data) this.userInput = navParams.data;
      }
      if (!InitAct) return;
      this.LoadListServer();
      /** 편집하기로 들어왔다면 */
      if (navParams && navParams.data) {
        // 로컬이라면 첫번째 서버로 설정
        let inputServerInfo = `${this.userInput.server.isOfficial}/${this.userInput.server.target}`;
        for (let i = 0, j = this.servers.length; i < j; i++) {
          let ServerInfo = `${this.servers[i].isOfficial}/${this.servers[i].target}`;
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
              let blob = await this.indexed.loadBlobFromUserPath(this.userInput.attachments[i].path, this.userInput.attachments[i].file_ext);
              let FileURL = URL.createObjectURL(blob);
              this.userInput.attachments[i].thumbnail = FileURL;
              setTimeout(() => {
                URL.revokeObjectURL(FileURL);
              }, 1000);
            }
          }
      }
      this.select_server(this.index);
      if (navParams && navParams.data)
        this.OriginalInfo = JSON.parse(JSON.stringify(this.userInput));
    });
    // 드랍이기도 하나 보이스 관리를 겸하므로 플랫폼 무관 생성
    this.CreateDrop();
    this.nakama.StatusBarChangedCallback = () => {
      this.LoadListServer();
      this.index = 0;
    };
  }

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.navCtrl.back();
    };
  }

  LoadListServer() {
    this.servers = this.nakama.get_all_server_info(true, true);
    /** 이 기기에 저장에 사용하는 정보 */
    let local_info = {
      name: this.lang.text['AddGroup']['UseLocalStorage'],
      isOfficial: 'local',
      target: 'target',
      local: true,
    };
    this.servers.unshift(local_info);
  }

  p5canvas: p5;
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
          p['StartVoiceTimer'] = () => {
            p.loop();
            VoiceStartTime = p.millis();
          }
          p['StopVoiceTimer'] = () => {
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
          let result = hour ? `${hour}:${minite}:${p.nf(second, 2)}` : `${minite}:${p.nf(second, 2)}`;
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
        p.keyPressed = (ev) => {
          switch (ev['code']) {
            case 'Enter':
              if (document.activeElement.id == 'exact_post_title_id')
                this.postData();
              break;
          }
        }
      });
  }

  BottomTabShortcut: any;
  /** 하단 탭 단축키 캐싱 */
  catchBottomTabShortCut() {
    this.BottomTabShortcut = this.global.p5key['KeyShortCut']['BottomTab'];
    delete this.global.p5key['KeyShortCut']['BottomTab'];
  }

  ContentTextArea: HTMLTextAreaElement;
  /** 게시물 제목 작성칸 */
  TitleInput: HTMLInputElement;
  /** 기존 게시물 편집 여부 */
  isModify = false;
  ionViewWillEnter() {
    this.AddShortcut();
    this.catchBottomTabShortCut();
    this.TitleInput = document.getElementById('add_post_title').childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
    this.TitleInput.id = 'exact_post_title_id';
    this.TitleInput.onpaste = (ev: any) => {
      let stack = [];
      for (const clipboardItem of ev.clipboardData.files)
        if (clipboardItem.type.startsWith('image/png'))
          stack.push({ file: clipboardItem });
      if (!stack.length) return;
      if (stack.length == 1)
        this.ChangeMainPostImage({ target: { files: [stack[0].file] } });
      return false;
    }
    this.ContentTextArea = document.getElementById('add_post_content') as HTMLTextAreaElement;
    setTimeout(() => {
      if (!this.userInput.title)
        this.TitleInput.focus();
      else this.ContentTextArea.focus();
    }, 200);
    this.ContentTextArea.onpaste = (ev: any) => {
      let stack = [];
      for (const clipboardItem of ev.clipboardData.files)
        if (clipboardItem.type.startsWith('image/'))
          stack.push({ file: clipboardItem });
      if (!stack.length) return;
      if (stack.length == 1)
        this.selected_blobFile_callback_act(stack[0].file);
      else for (let i = 0, j = stack.length; i < j; i++)
        this.selected_blobFile_callback_act(stack[i].file);
      return false;
    }
    this.isModify = Boolean(this.userInput.id);
    this.InitBrowserBackButtonOverride();
  }

  go_to_profile() {
    this.modalCtrl.create({
      component: GroupServerPage,
      componentProps: {
        isOfficial: this.isOfficial,
        target: this.target,
      }
    }).then(v => v.present());
  }

  /** 서버 선택지 열림 여부 */
  isExpanded = false;
  /** 저장버튼 눌림 여부 */
  isSaveClicked = false;
  /** 게시 서버 변경 여부, 이 경우 기존 서버에서 삭제 후 다시 등록해야함 */
  isServerChanged = false;
  /** 아코디언에서 서버 선택하기 */
  select_server(i: number, changed = false) {
    this.index = i;
    this.userInput.server = this.servers[i];
    this.isExpanded = false;
    this.isOfficial = this.servers[i].isOfficial;
    this.target = this.servers[i].target;
    if (changed) {
      this.isServerChanged = this.OriginalServerInfo != `${this.isOfficial}/${this.target}`;
    } else this.OriginalServerInfo = `${this.isOfficial}/${this.target}`;
    this.userInput.creator_name = this.nakama.users.self['display_name'];
    try { // 변경된 서버 user_id 를 적용함
      this.userInput.creator_id = this.nakama.servers[this.isOfficial][this.target].session.user_id;
      this.userInput.UserColor = (this.userInput.creator_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
    } catch (e) { // 그게 아니라면 로컬입니다
      this.userInput.creator_id = 'me';
      this.userInput.UserColor = '888888';
    }
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Escape'] = () => {
        this.navCtrl.navigateBack('portal/community');
      };
    }
  }

  useVoiceRecording = false;
  /** 게시물 편집기에서 보여지는 대표 이미지 링크 주소 */
  MainPostImage = undefined;
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
          this.MainPostImage = undefined;
          this.userInput.mainImage = undefined;
          let input = document.getElementById('PostMainImage_sel') as HTMLInputElement;
          input.value = '';
        }
      }
    },
    { // 1
      icon: 'document-attach-outline',
      name: this.lang.text['ChatRoom']['attachments'],
      act: async () => {
        if (this.isSaveClicked) return;
        try {
          await this.new_attach({ detail: { value: 'link' } });
          return; // 파일 넣기 성공시 링크 발송 기능 여전히 사용
        } catch (e) {
          if (e != 'done')
            this.new_attach({ detail: { value: 'load' } });
        }
      }
    }, { // 2
      icon_img: 'voidDraw.png',
      name: this.lang.text['ChatRoom']['voidDraw'],
      act: async () => {
        if (this.isSaveClicked) return;
        let props = {}
        let content_related_creator: ContentCreatorInfo[];
        this.modalCtrl.create({
          component: VoidDrawPage,
          componentProps: props,
          cssClass: 'fullscreen',
        }).then(v => {
          v.onWillDismiss().then(async v => {
            if (v.data) {
              this.AddAttachTextForm();
              await this.voidDraw_fileAct_callback(v, content_related_creator);
            }
          });
          v.onDidDismiss().then(() => {
            this.AddShortcut();
          });
          delete this.global.p5key['KeyShortCut']['Escape'];
          v.present();
        });
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
        };
        let newDate = new Date();
        let year = newDate.getUTCFullYear();
        let month = ("0" + (newDate.getMonth() + 1)).slice(-2);
        let date = ("0" + newDate.getDate()).slice(-2);
        let hour = ("0" + newDate.getHours()).slice(-2);
        let minute = ("0" + newDate.getMinutes()).slice(-2);
        let second = ("0" + newDate.getSeconds()).slice(-2);
        props.info.content.is_new = 'text';
        props.info.content.filename = `texteditor_${year}-${month}-${date}_${hour}-${minute}-${second}.txt`;
        props.no_edit = true;
        this.modalCtrl.create({
          component: IonicViewerPage,
          componentProps: props,
        }).then(v => {
          v.onWillDismiss().then(v => {
            if (v.data) {
              let this_file: FileInfo = {};
              this_file.content_creator = {
                timestamp: new Date().getTime(),
                display_name: this.nakama.users.self['display_name'],
                various: 'textedit',
              };
              this_file.content_related_creator = [];
              this_file.content_related_creator.push(this_file.content_creator);
              this_file.blob = v.data.blob;
              this_file.path = v.data.path;
              this_file.size = v.data.blob['size'];
              this_file.filename = v.data.blob.name || props.info.content.filename;
              this_file.file_ext = this_file.filename.split('.').pop();
              this_file.type = 'text/plain';
              this_file.viewer = 'text';
              this.userInput.attachments.push(this_file);
            }
          });
          v.onDidDismiss().then(() => {
            this.AddShortcut();
          });
          delete this.global.p5key['KeyShortCut']['Escape'];
          v.present();
        });
      }
    }, { // 4
      icon: 'camera-outline',
      name: this.lang.text['ChatRoom']['Camera'],
      act: async () => {
        if (this.isSaveClicked) return;
        try {
          const image = await Camera.getPhoto({
            quality: 90,
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera,
          });
          let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
          loading.present();
          let file = {} as PostAttachment;
          let time = new Date();
          file.filename = `Camera_${time.toLocaleString().replace(/:/g, '_')}.${image.format}`;
          file.file_ext = image.format;
          file.thumbnail = this.sanitizer.bypassSecurityTrustUrl('data:image/jpeg;base64,' + image.base64String);
          file.type = `image/${image.format}`;
          file.typeheader = 'image';
          file.content_related_creator = [{
            user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'camera',
          }];
          file.content_creator = {
            user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'camera',
          };
          file.viewer = 'image';
          file.path = `tmp_files/post/${file.filename}`;
          await this.indexed.saveBase64ToUserPath('data:image/jpeg;base64,' + image.base64String,
            file.path, (raw) => {
              file.blob = new Blob([raw], { type: file['type'] })
            });
          this.AddAttachTextForm();
          this.userInput.attachments.push(file);
          loading.dismiss();
        } catch (e) { }
      }
    }, { // 5
      icon: 'mic-circle-outline',
      name: this.lang.text['ChatRoom']['Voice'],
      act: async () => {
        if (this.isSaveClicked) return;
        this.useVoiceRecording = !this.useVoiceRecording;
        if (this.useVoiceRecording) { // 녹음 시작
          let req = await VoiceRecorder.hasAudioRecordingPermission();
          if (req.value) { // 권한 있음
            this.extended_buttons[5].icon = 'stop-circle-outline';
            this.p5toast.show({
              text: this.lang.text['ChatRoom']['StartVRecord'],
            });
            this.p5canvas['StartVoiceTimer']();
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
    }];

  /** 녹음중인 음성의 시간을 기록함 */
  AddVoiceTimeHistory() {
    if (this.userInput.content)
      this.userInput.content += `\n{"i":"n","t":"${this.extended_buttons[5].name}"}\n`;
    else this.userInput.content = `{"i":"n","t":"${this.extended_buttons[5].name}"}\n`;
    this.ContentTextArea.focus();
  }

  /** 음성 녹음이 진행되는 경우 시간 기록을 편하게 할 수 있는 버튼 생성 */
  p5floatingButton: p5;
  /** 페이지는 벗어났으나 계속 녹음을 유지중일 때 floating 버튼을 사용 */
  CreateFloatingVoiceTimeHistoryAddButton() {
    if (this.p5floatingButton) this.p5floatingButton.remove();
    this.p5floatingButton = new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        let float_button = p.createDiv(`<ion-icon style="width: 36px; height: 36px" name="timer-outline"></ion-icon>`);
        float_button.style("position: absolute; right: 0; bottom: 56px; z-index: 1");
        float_button.style("width: 64px; height: 64px");
        float_button.style("text-align: center; align-content: center");
        float_button.style("cursor: pointer");
        float_button.style("margin: 16px");
        float_button.style("padding-top: 6px");
        float_button.style("background-color: #8888");
        float_button.style("border-radius: 24px");
        float_button.elt.onclick = () => {
          this.AddVoiceTimeHistory();
          this.p5toast.show({
            text: `${this.lang.text['AddPost']['RecordVoiceTime']}: ${this.extended_buttons[5].name}`,
          });
        };
      }
    });
  }

  async StopAndSaveVoiceRecording() {
    if (this.p5floatingButton) this.p5floatingButton.remove();
    let loading = await this.loadingCtrl.create({ message: this.lang.text['AddPost']['SavingRecord'] });
    loading.present();
    try {
      let data = await VoiceRecorder.stopRecording();
      let blob = this.global.Base64ToBlob(`${data.value.mimeType},${data.value.recordDataBase64}`);
      blob['name'] = `${this.lang.text['ChatRoom']['VoiceRecord']}.${data.value.mimeType.split('/').pop().split(';')[0]}`;
      blob['type_override'] = data.value.mimeType;
      await this.selected_blobFile_callback_act(blob);
      loading.dismiss();
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['AddPost']['FailedToSaveVoice']}:${e}`,
      });
      loading.dismiss();
    }
    this.extended_buttons[5].icon = 'mic-circle-outline';
    this.extended_buttons[5].name = this.lang.text['ChatRoom']['Voice'];
    this.checkVoiceLinker();
  }

  /** 게시물 내용에 음성 시간 링크가 있는지 확인 */
  checkVoiceLinker() {
    this.p5canvas['StopVoiceTimer']();
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
    let file = {} as PostAttachment;
    file['filename'] = blob.name;
    file['file_ext'] = blob.name.split('.').pop() || blob.type || this.lang.text['ChatRoom']['unknown_ext'];
    file['size'] = blob.size;
    file['type'] = blob.type || blob.type_override;
    file.blob = blob;
    file.path = `tmp_files/post/MainImage.${file['file_ext']}`;
    this.userInput.mainImage = file;
    let FileURL = URL.createObjectURL(blob);
    this.indexed.saveBlobToUserPath(blob, file.path);
    this.MainPostImage = FileURL;
  }

  /** 파일이 선택되고 나면 */
  async selected_blobFile_callback_act(blob: any, contentRelated: ContentCreatorInfo[] = [], various = 'loaded', path?: string, index?: number) {
    let file = {} as PostAttachment;
    file['filename'] = blob.name;
    file['file_ext'] = blob.name.split('.').pop() || blob.type || this.lang.text['ChatRoom']['unknown_ext'];
    file['size'] = blob.size;
    file['type'] = blob.type || blob.type_override;
    if (path) file.path = path;
    file['content_related_creator'] = [
      ...contentRelated, {
        user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
        timestamp: new Date().getTime(),
        display_name: this.nakama.users.self['display_name'],
        various: various as any,
      }];
    file['content_creator'] = {
      user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
      timestamp: new Date().getTime(),
      display_name: this.nakama.users.self['display_name'],
      various: various as any,
    };
    file.blob = blob;
    file.path = `tmp_files/post/${file.filename}_${this.userInput.attachments.length}.${file.file_ext}`;
    this.create_selected_thumbnail(file);
    if (index === undefined) {
      this.AddAttachTextForm();
      this.userInput.attachments.push(file);
    } else this.userInput.attachments[index] = file;
    this.indexed.saveBlobToUserPath(file.blob, file.path);
  }

  /** 게시물 내용에 첨부파일 링크를 추가함 */
  AddAttachTextForm() {
    if (this.userInput.content)
      this.userInput.content += `\n[${this.userInput.attachments.length}]\n`;
    else this.userInput.content = `[${this.userInput.attachments.length}]\n`;
  }

  /** 선택한 파일의 썸네일 만들기 */
  async create_selected_thumbnail(file: PostAttachment) {
    this.global.set_viewer_category_from_ext(file);
    if (file.url) {
      try {
        let res = await fetch(file.url);
        if (res.ok) file.thumbnail = file.url;
      } catch (e) { }
      file.typeheader = file.viewer;
      return;
    } else try {
      file.thumbnail = await this.indexed.loadBlobFromUserPath(file.path, file.type);
    } catch (e) { }
    let FileURL = URL.createObjectURL(file.blob);
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
    let file = {} as PostAttachment;
    if (index !== undefined)
      this.userInput.attachments[index] = file;
    else this.userInput.attachments.push(file);
    try {
      file.filename = v.data['name'];
      file.file_ext = 'png';
      file.thumbnail = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
      file.type = 'image/png';
      file.typeheader = 'image';
      if (related_creators) {
        file.content_related_creator = related_creators;
        file.content_creator = {
          user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        };
      } else {
        file.content_related_creator = [{
          user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        }];
        file.content_creator = {
          user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        };
      }
      file.path = `tmp_files/post/${file.filename}`;
      file.viewer = 'image';
      await this.indexed.saveBase64ToUserPath(v.data['img'], file.path, (raw) => {
        file.blob = new Blob([raw], { type: file['type'] });
      });
    } catch (e) {
      console.error('godot-이미지 편집 사용 불가: ', e);
    }
    v.data['loadingCtrl'].dismiss();
  }

  /** 첨부 파일 타입 정하기 */
  async new_attach(ev: any, override: FileInfo = undefined) {
    if (override === undefined)
      override = {};
    let file: any;
    switch (ev.detail.value) {
      case 'load':
        document.getElementById('add_post_input').click();
        break;
      case 'link':
        try {
          let pasted_url = override.url;
          if (pasted_url === undefined)
            try {
              pasted_url = await this.mClipboard.paste();
            } catch (e) {
              try {
                pasted_url = await clipboard.read();
              } catch (e) {
                throw e;
              }
            }
          try { // DataURL 주소인지 검토
            let blob = this.global.Base64ToBlob(pasted_url);
            let getType = pasted_url.split(';')[0].split(':')[1];
            file = new File([blob],
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
            if (file && override.filename === undefined) throw '이미 파일이 첨부됨, 토글만 시도';
            let res = await fetch(pasted_url);
            if (!res.ok) throw 'URL 구조가 정상이 아님';
          } catch (e) {
            throw e;
          }
          let this_file: PostAttachment = {};
          this_file.url = pasted_url;
          this_file['content_related_creator'] = [];
          if (override && override.content_related_creator) this_file['content_related_creator'] = [...override.content_related_creator]
          this_file['content_related_creator'].push({
            user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: override.url ? 'shared' : 'link',
          });
          this_file['content_creator'] = {
            user_id: this.servers[this.index].isOfficial == 'local' ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: override.url ? 'shared' : 'link',
          };
          let sep = this_file.url.split('.');
          this_file.file_ext = override.file_ext || sep.pop().split('?').shift();
          this_file.filename = override.filename || decodeURIComponent(`${sep.pop().split('/').pop() || this.lang.text['ChatRoom']['ExternalLinkFile']}.${this_file.file_ext}`);
          this.global.set_viewer_category_from_ext(this_file);
          this_file.type = override.type || '';
          this_file.typeheader = override.typeheader || this_file.viewer;
          this.global.modulate_thumbnail(this_file, this_file.url);
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
    this.p5toast.show({
      text: `${this.lang.text['AddPost']['RemoveAttach']}: ${this.userInput.attachments[i].filename}`,
    });
    this.userInput.attachments.splice(i, 1);
    // 첨부파일 링크 텍스트를 삭제하고, 재정렬시킴
    let sep_as_line = this.userInput.content.split('\n');
    for (let k = sep_as_line.length - 1; k >= 0; k--) {
      // 첨부파일인지 체크
      let is_attach = false;
      let content_len = sep_as_line[k].length - 1;
      let index = 0;
      try {
        index = Number(sep_as_line[k].substring(1, content_len));
        is_attach = sep_as_line[k].charAt(0) == '[' && sep_as_line[k].charAt(content_len) == ']' && !isNaN(index);
      } catch (e) { }
      if (is_attach) {
        if (i == index) { // 삭제된 파일에 해당하는 줄은 삭제
          if (sep_as_line[k + 1] == '') try {
            sep_as_line.splice(k + 1, 1);
          } catch (e) { }
          sep_as_line.splice(k, 1);
        } else if (i < index) // 해당 파일보다 큰 순번은 숫자를 줄여 정렬처리
          sep_as_line[k] = `[${index - 1}]`;
      }
    }
    this.userInput.content = sep_as_line.join('\n');
    return false;
  }

  /** 파일 첨부하기 */
  async inputFileSelected(ev: any) {
    if (ev.target.files.length) {
      let is_multiple_files = ev.target.files.length != 1;
      if (is_multiple_files) {
        let loading = await this.loadingCtrl.create({ message: this.lang.text['ChatRoom']['MultipleSend'] });
        loading.present();
        for (let i = 0, j = ev.target.files.length; i < j; i++) {
          loading.message = `${j - i}: ${ev.target.files[i].name}`;
          await this.selected_blobFile_callback_act(ev.target.files[i]);
        }
        loading.dismiss();
        setTimeout(() => {
          let input = document.getElementById('add_post_input') as HTMLInputElement;
          input.value = '';
        }, 300);
      } else {
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
        await this.selected_blobFile_callback_act(ev.target.files[0]);
        loading.dismiss();
        let input = document.getElementById('add_post_input') as HTMLInputElement;
        input.value = '';
      }
    }
  }

  lock_modal_open = false;
  open_viewer(info: PostAttachment, index: number) {
    let attaches = [];
    for (let i = 0, j = this.userInput.attachments.length; i < j; i++)
      attaches.push({ content: this.userInput.attachments[i] });
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      delete this.global.p5key['KeyShortCut']['Escape'];
      this.modalCtrl.create({
        component: IonicViewerPage,
        componentProps: {
          info: { content: info },
          path: info.path,
          alt_path: info.path,
          isOfficial: this.isOfficial,
          target: this.target,
          relevance: attaches,
          local: this.servers[this.index].isOfficial == 'local',
        },
        cssClass: 'fullscreen',
      }).then(v => {
        v.onDidDismiss().then((v) => {
          this.AddShortcut();
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
                this.modalCtrl.create({
                  component: VoidDrawPage,
                  componentProps: {
                    path: v.data.path || info.path,
                    width: v.data.width,
                    height: v.data.height,
                    isDarkMode: v.data.isDarkMode,
                  },
                  cssClass: 'fullscreen',
                }).then(v => {
                  v.onDidDismiss().then(() => {
                    this.AddShortcut();
                  });
                  v.onWillDismiss().then(async v => {
                    if (v.data) await this.voidDraw_fileAct_callback(v, related_creators, index);
                  });
                  delete this.global.p5key['KeyShortCut']['Escape'];
                  v.present();
                });
                return;
              case 'text':
                this.selected_blobFile_callback_act(v.data.blob, v.data.contentRelated, 'textedit', undefined, index);
                break;
            }
          }
        });
        delete this.global.p5key['KeyShortCut']['Escape'];
        v.present();
        this.lock_modal_open = false;
      });
    }
  }

  /** 사용자 지정 우선 서버 사용 여부  
   * 0: 기본값  
   * 1: FFS 우선  
   * 2: SQL 강제
   */
  useFirstCustomCDN = 0;
  async toggle_custom_attach(force?: number) {
    let ModulerSize = this.userInput.creator_id == 'me' ? 2 : 3
    this.useFirstCustomCDN = (force ?? (this.useFirstCustomCDN + 1)) % ModulerSize;
    if (isPlatform == 'Android') {
      this.useFirstCustomCDN = 2;
      this.extended_buttons[6].isHide = true;
    }
    switch (this.useFirstCustomCDN) {
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
    localStorage.setItem('useFFSCDN', `${this.useFirstCustomCDN}`);
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
    // 음성 녹음중이라면 녹음을 마무리하여 파일로 저장한 후 게시물 저장처리 진행
    if (this.useVoiceRecording) await this.StopAndSaveVoiceRecording();
    /** 로컬 서버인지 여부 */
    let is_local = Boolean(this.userInput.server['local']);
    this.isApplyPostData = true;
    let loading = await this.loadingCtrl.create({ message: this.lang.text['AddPost']['WIP'] });
    loading.present();
    this.isSaveClicked = true;
    let isOfficial = this.userInput.server['isOfficial'];
    let target = this.userInput.server['target'];
    try {
      // 게시물 아이디 구성하기
      if (!this.isModify || this.isServerChanged) { // 새 게시물 작성시에만 생성
        if (this.isServerChanged && this.OriginalInfo) // 기존 서버의 게시물 정보 삭제
          await this.nakama.RemovePost(this.OriginalInfo);
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
        } // 편집된 게시물이라면 전부다 지우고 다시 등록
      } else {
        if (this.userInput.mainImage && this.userInput.mainImage.url && !this.userInput.mainImage.blob)
          this.userInput.mainImage.blob = await (await fetch(this.userInput.mainImage.url)).blob();
        for (let i = 0, j = this.userInput.attachments.length; i < j; i++)
          if (this.userInput.attachments[i].url && !this.userInput.attachments[i].blob)
            this.userInput.attachments[i].blob = await (await fetch(this.userInput.attachments[i].url)).blob();
        await this.nakama.RemovePost(this.userInput);
      }
      // 게시물 날짜 업데이트
      if (this.isModify)
        this.userInput.modify_time = new Date().getTime();
      else { // 생성 시간이 없다면 최초 생성으로 간주
        this.userInput.create_time = new Date().getTime();
        this.userInput.modify_time = this.userInput.create_time;
      }
      // 썸네일 정보 삭제
      for (let i = 0, j = this.userInput.attachments.length; i < j; i++)
        delete this.userInput.attachments[i].thumbnail;
      // 대표 이미지 저장
      if (this.userInput.mainImage) {
        loading.message = this.lang.text['AddPost']['SyncMainImage'];
        this.userInput.mainImage.path = `servers/${isOfficial}/${target}/posts/${this.userInput.creator_id}/${this.userInput.id}/MainImage.${this.userInput.mainImage.file_ext}`;
        this.userInput.mainImage.thumbnail = this.MainPostImage;
        try { // FFS 업로드 시도
          if (this.useFirstCustomCDN != 1) throw 'FFS 사용 순위에 없음';
          loading.message = `${this.lang.text['AddPost']['SyncMainImage']}: ${this.userInput.mainImage.filename}`;
          let CatchedAddress: string;
          CatchedAddress = await this.global.try_upload_to_user_custom_fs(this.userInput.mainImage, this.nakama.users.self['display_name'], undefined, loading);
          if (CatchedAddress) {
            delete this.userInput.mainImage['path'];
            delete this.userInput.mainImage['partsize'];
            this.userInput.mainImage['url'] = CatchedAddress;
          } else throw '업로드 실패';
        } catch (e) {
          await this.indexed.saveBlobToUserPath(this.userInput.mainImage.blob, this.userInput.mainImage.path);
        }
        if (!is_local) {
          try { // 서버에 연결된 경우 cdn 서버 업데이트 시도
            if (this.useFirstCustomCDN == 2) throw 'SQL 강제';
            let address = this.nakama.servers[this.isOfficial][this.target].info.address;
            let protocol = this.nakama.servers[this.isOfficial][this.target].info.useSSL ? 'https:' : 'http:';
            let savedAddress = await this.global.upload_file_to_storage(this.userInput.mainImage,
              this.nakama.servers[this.isOfficial][this.target].session.user_id,
              protocol, address, this.useFirstCustomCDN == 1, loading);
            let isURL = Boolean(savedAddress);
            if (!isURL) throw '링크 만들기 실패';
            delete this.userInput.mainImage['partsize']; // 메시지 삭제 등의 업무 효율을 위해 정보 삭제
            this.userInput.mainImage['url'] = savedAddress;
          } catch (e) {
            await this.nakama.sync_save_file(this.userInput.mainImage, isOfficial, target, 'server_post', `${this.userInput.id}_mainImage`);
          }
        }
      }
      // 첨부파일들 전부 저장
      let attach_len = this.userInput.attachments.length;
      if (attach_len) {
        loading.message = this.lang.text['AddPost']['SyncAttaches'];
        for (let i = attach_len - 1; i >= 0; i--) {
          try { // FFS 업로드 시도
            if (this.useFirstCustomCDN != 1) throw 'FFS 사용 순위에 없음';
            loading.message = `${this.lang.text['AddPost']['SyncAttaches']}: [${i}]${this.userInput.attachments[i].filename}`;
            let CatchedAddress: string;
            CatchedAddress = await this.global.try_upload_to_user_custom_fs(this.userInput.attachments[i], this.nakama.users.self['display_name'], undefined, loading);
            if (CatchedAddress) {
              delete this.userInput.attachments[i]['path'];
              delete this.userInput.attachments[i]['partsize'];
              this.userInput.attachments[i]['url'] = CatchedAddress;
            } else throw '업로드 실패';
          } catch (e) {
            this.userInput.attachments[i].path = `servers/${isOfficial}/${target}/posts/${this.userInput.creator_id}/${this.userInput.id}/[${i}]${this.userInput.attachments[i].filename}`;
            await this.indexed.saveBlobToUserPath(this.userInput.attachments[i].blob, this.userInput.attachments[i].path);
          }
          if (!is_local) {
            try { // 서버에 연결된 경우 cdn 서버 업데이트 시도
              if (this.useFirstCustomCDN == 2) throw 'SQL 강제';
              let address = this.nakama.servers[this.isOfficial][this.target].info.address;
              let protocol = this.nakama.servers[this.isOfficial][this.target].info.useSSL ? 'https:' : 'http:';
              let savedAddress = await this.global.upload_file_to_storage(this.userInput.attachments[i],
                this.nakama.servers[this.isOfficial][this.target].session.user_id,
                protocol, address, this.useFirstCustomCDN == 1, loading);
              let isURL = Boolean(savedAddress);
              if (!isURL) throw '링크 만들기 실패';
              delete this.userInput.attachments[i]['partsize']; // 메시지 삭제 등의 업무 효율을 위해 정보 삭제
              this.userInput.attachments[i]['url'] = savedAddress;
            } catch (e) {
              if (e == 'SQL 강제' && this.userInput.attachments[i].url && !this.userInput.attachments[i].blob)
                this.userInput.attachments[i].blob = await (await fetch(this.userInput.attachments[i].url)).blob();
              await this.nakama.sync_save_file(this.userInput.attachments[i], isOfficial, target, 'server_post', `${this.userInput.id}_attach_${i}`);
            }
          }
        }
      }
      let make_copy_info = JSON.parse(JSON.stringify(this.userInput))
      if (make_copy_info.mainImage)
        delete make_copy_info.mainImage.blob;
      for (let i = make_copy_info.attachments.length - 1; i >= 0; i--)
        delete make_copy_info.attachments[i].blob;
      delete make_copy_info.server;
      try {
        if (!this.nakama.posts_orig[isOfficial][target])
          this.nakama.posts_orig[isOfficial][target] = {};
        if (!this.nakama.posts_orig[isOfficial][target][this.userInput.creator_id])
          this.nakama.posts_orig[isOfficial][target][this.userInput.creator_id] = {};
        this.nakama.posts_orig[isOfficial][target][this.userInput.creator_id][this.userInput.id] = this.userInput;
        // 게시물 정보 저장하기
      } catch (e) {
        this.p5toast.show({
          text: `${this.lang.text['AddPost']['SyncErr']}: ${e}`,
        });
        console.log(e);
      }
      let json_str = JSON.stringify(make_copy_info);
      await this.indexed.saveTextFileToUserPath(json_str, `servers/${isOfficial}/${target}/posts/${this.userInput.creator_id}/${this.userInput.id}/info.json`);
      if (!is_local) { // 서버라면 추가로 서버에 정보 등록
        let blob = new Blob([json_str], { type: 'application/json' });
        let file: FileInfo = {};
        file.filename = 'info.json';
        file.blob = blob;
        file.size = blob.size;
        file.type = 'application/json';
        file.file_ext = 'txt';
        file.typeheader = 'text';
        file.path = `servers/${isOfficial}/${target}/posts/${this.userInput.creator_id}/${this.userInput.id}/info.json`;
        await this.nakama.sync_save_file(file, isOfficial, target, 'server_post', this.userInput.id);
      }
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
    loading.dismiss();
    this.navCtrl.navigateBack('portal/community');
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    this.global.p5key['KeyShortCut']['BottomTab'] = this.BottomTabShortcut;
    this.indexed.GetFileListFromDB('tmp_files/post').then(list => list.forEach(path => this.indexed.removeFileFromUserPath(path)));
    // 데이터 저장이 아니라면 기존 데이터를 다시 불러와서 게시물 정보 원복시키기
    if (!this.isApplyPostData) try {
      if (this.nakama.posts_orig[this.isOfficial][this.target][this.userInput.creator_id][this.userInput.id])
        delete this.nakama.posts_orig[this.isOfficial][this.target][this.userInput.creator_id][this.userInput.id];
      this.nakama.load_local_post_with_id(this.userInput.id, this.userInput.server.isOfficial, this.userInput.server.target, this.userInput.creator_id);
      this.nakama.rearrange_posts();
    } catch (e) { }
  }
}
