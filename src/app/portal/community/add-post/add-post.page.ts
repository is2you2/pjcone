import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';
import { ContentCreatorInfo, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
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
export class AddPostPage implements OnInit {
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
    private alertCtrl: AlertController,
  ) { }

  servers: ServerInfo[] = [];
  userInput = {
    id: undefined,
    title: undefined,
    /** 대표 이미지 설정, blob 링크 */
    titleImage: undefined,
    /** 내용물, txt 파일 변환하여 저장됨 */
    content: undefined,
    creator_id: undefined,
    creator_name: undefined,
    UserColor: undefined,
    create_time: undefined,
    modify_time: undefined,
    server: undefined,
    mainImage: undefined as PostAttachment,
    attachments: [] as PostAttachment[],
  }
  index = 0;
  isOfficial: string;
  target: string;

  ngOnInit() {
    this.servers = this.nakama.get_all_server_info(true, true);
    let local_info = {
      name: this.lang.text['AddGroup']['UseLocalStorage'],
      isOfficial: 'local',
      target: 'channels',
      local: true,
    };
    this.servers.unshift(local_info);
    if (this.servers.length > 1) this.index = 1;
    this.select_server(this.index);
    this.userInput.creator_name = this.nakama.users.self['display_name'];
  }

  BottomTabShortcut: any;
  /** 하단 탭 단축키 캐싱 */
  catchBottomTabShortCut() {
    this.BottomTabShortcut = this.global.p5key['KeyShortCut']['BottomTab'];
    delete this.global.p5key['KeyShortCut']['BottomTab'];
  }

  ionViewWillEnter() {
    this.AddShortcut();
    this.catchBottomTabShortCut();
    let title_input = document.getElementById('add_post_title').childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
    if (!this.userInput.title)
      title_input.focus();
    else document.getElementById('add_post_content').focus();
    document.getElementById('add_post_content').onpaste = (ev: any) => {
      let stack = [];
      for (const clipboardItem of ev.clipboardData.files)
        if (clipboardItem.type.startsWith('image/'))
          stack.push({ file: clipboardItem });
      if (!stack.length) return;
      if (stack.length == 1)
        this.selected_blobFile_callback_act(stack[0].file);
      else this.alertCtrl.create({
        header: this.lang.text['ChatRoom']['MultipleSend'],
        message: `${this.lang.text['ChatRoom']['CountFile']}: ${stack.length}`,
        buttons: [{
          text: this.lang.text['ChatRoom']['Send'],
          handler: async () => {
            let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
            loading.present();
            for (let i = 0, j = stack.length; i < j; i++)
              await this.selected_blobFile_callback_act(stack[i].file);
            loading.dismiss();
          }
        }]
      }).then(v => {
        this.global.p5key['KeyShortCut']['Escape'] = () => {
          v.dismiss();
        }
        v.onDidDismiss().then(() => {
          this.global.p5key['KeyShortCut']['Escape'] = () => {
            this.navCtrl.pop();
          }
        });
        v.present();
      });
    }
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
  /** 아코디언에서 서버 선택하기 */
  select_server(i: number) {
    this.index = i;
    this.userInput.server = this.servers[i];
    this.isExpanded = false;
    this.isOfficial = this.servers[i].isOfficial;
    this.target = this.servers[i].target;
    try { // 변경된 서버 user_id 를 적용함
      this.userInput.creator_id = this.nakama.servers[this.isOfficial][this.target].session.user_id;
      this.userInput.UserColor = (this.userInput.creator_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
    } catch (e) { // 그게 아니라면 로컬입니다
      this.userInput.creator_id = 'local';
      this.userInput.creator_name = this.nakama.users.self['display_name'];
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
  MainPostImage = undefined;
  /** 확장 버튼 행동들 */
  extended_buttons: ExtendButtonForm[] = [
    { // 0
      icon: 'image-outline',
      name: this.lang.text['AddPost']['MainPostImage'],
      act: () => {
        if (!this.MainPostImage)
          document.getElementById('PostMainImage_sel').click();
        else {
          this.MainPostImage = undefined;
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
            if (v.data) await this.voidDraw_fileAct_callback(v, content_related_creator);
          });
          v.onDidDismiss().then(() => {
            this.AddShortcut();
          });
          delete this.global.p5key['KeyShortCut']['Escape'];
          v.present();
        });
      }
    }, { // 3
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
          this.userInput.attachments.push(file);
          this.MakeAttachHaveContextMenu();
          loading.dismiss();
        } catch (e) { }
      }
    }, { // 4
      icon: 'mic-circle-outline',
      name: this.lang.text['ChatRoom']['Voice'],
      act: async () => {
        if (this.isSaveClicked) return;
        this.useVoiceRecording = !this.useVoiceRecording;
        if (this.useVoiceRecording) { // 녹음 시작
          let req = await VoiceRecorder.hasAudioRecordingPermission();
          if (req.value) { // 권한 있음
            this.extended_buttons[4].icon = 'stop-circle-outline';
            await VoiceRecorder.startRecording();
            this.p5toast.show({
              text: this.lang.text['ChatRoom']['StartVRecord'],
            });
          } else await VoiceRecorder.requestAudioRecordingPermission();
        } else { // 녹음 종료
          let data = await VoiceRecorder.stopRecording();
          let blob = this.global.Base64ToBlob(`${data.value.mimeType},${data.value.recordDataBase64}`);
          blob['name'] = `${this.lang.text['ChatRoom']['VoiceRecord']}.${data.value.mimeType.split('/').pop().split(';')[0]}`;
          blob['type_override'] = data.value.mimeType;
          this.selected_blobFile_callback_act(blob);
          this.extended_buttons[4].icon = 'mic-circle-outline';
        }
      }
    }];

  /** 채널 배경화면 변경 (from PostMainImage_sel) */
  ChangeMainPostImage(ev: any) {
    let imageFile = ev.target.files[0];
    let FileURL = URL.createObjectURL(imageFile);
    let path = `tmp_files/post/MainImage.png`;
    this.indexed.saveBlobToUserPath(imageFile, path);
    this.userInput.mainImage = { filename: 'MainImage.png' };
    this.MainPostImage = FileURL;
    setTimeout(() => {
      URL.revokeObjectURL(FileURL);
    }, 100);
  }

  /** 파일이 선택되고 나면 */
  async selected_blobFile_callback_act(blob: any, contentRelated: ContentCreatorInfo[] = [], various = 'loaded', path?: string) {
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
    this.userInput.attachments.push(file);
    this.MakeAttachHaveContextMenu();
    this.indexed.saveBlobToUserPath(file.blob, file.path);
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

  async voidDraw_fileAct_callback(v: any, related_creators?: any) {
    try {
      let file = {} as PostAttachment;
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
      this.userInput.attachments.push(file);
      this.MakeAttachHaveContextMenu();
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
              pasted_url = await this.mClipboard.paste()
            } catch (e) {
              try {
                pasted_url = await clipboard.read()
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
          this.MakeAttachHaveContextMenu();
        } catch (e) {
          if (e == 'done')
            throw e;
          else throw `인식 불가능한 URL 정보: ${e}`;
        }
        break;
    }
  }

  MakeAttachHaveContextMenu() {
    setTimeout(() => {
      for (let i = this.userInput.attachments.length - 1; i >= 0; i--) {
        let FileItem = document.getElementById(`PostAttach_${i}`);
        FileItem.oncontextmenu = () => {
          this.p5toast.show({
            text: `${this.lang.text['AddPost']['RemoveAttach']}: ${this.userInput.attachments[i].filename}`,
          });
          this.userInput.attachments.splice(i, 1);
          this.MakeAttachHaveContextMenu();
          return false;
        }
      }
    }, 0);
  }

  /** 파일 첨부하기 */
  async inputFileSelected(ev: any) {
    if (ev.target.files.length) {
      let is_multiple_files = ev.target.files.length != 1;
      if (is_multiple_files) {
        let alert = await this.alertCtrl.create({
          header: this.lang.text['ChatRoom']['MultipleSend'],
          message: `${this.lang.text['ChatRoom']['CountFile']}: ${ev.target.files.length}`,
          buttons: [{
            text: this.lang.text['ChatRoom']['Send'],
            handler: async () => {
              let loading = await this.loadingCtrl.create({ message: this.lang.text['ChatRoom']['MultipleSend'] });
              loading.present();
              for (let i = 0, j = ev.target.files.length; i < j; i++) {
                loading.message = `${this.lang.text['ChatRoom']['MultipleSend']}: ${j - i}`;
                await this.selected_blobFile_callback_act(ev.target.files[i]);
              }
              loading.dismiss();
              setTimeout(() => {
                let input = document.getElementById('add_post_input') as HTMLInputElement;
                input.value = '';
              }, 300);
            }
          }]
        });
        this.global.p5key['KeyShortCut']['Escape'] = () => {
          alert.dismiss();
        }
        alert.onDidDismiss().then(() => {
          this.global.p5key['KeyShortCut']['Escape'] = () => {
            this.navCtrl.pop();
          }
        });
        alert.present();
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
  open_viewer(info: PostAttachment) {
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
                    if (v.data) await this.voidDraw_fileAct_callback(v, related_creators);
                  });
                  delete this.global.p5key['KeyShortCut']['Escape'];
                  v.present();
                });
                return;
              case 'text':
                this.selected_blobFile_callback_act(v.data.blob, v.data.contentRelated, 'textedit');
                break;
            }
          }
        });
        delete this.global.p5key['KeyShortCut']['Escape'];
        v.present();
        this.nakama.removeBanner();
        this.lock_modal_open = false;
      });
    }
  }

  /** 포스트 등록하기  
   * 글 내용이 길어질 수 있으므로 글이 아무리 짧더라도 txt 파일로 변환하여 게시
   */
  postData() {
    if (!this.userInput.title) {
      this.p5toast.show({
        text: this.lang.text['AddPost']['NeedPostTitle'],
      });
      let title_input = document.getElementById('add_post_title').childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
      title_input.focus();
      return;
    }
    this.p5toast.show({
      text: '게시물 작성 기능 준비중',
    });
    this.isSaveClicked = true;
    // 너무 긴 제목 자르기
    // 게시글의 도입부 첫 줄 자르기
    // 게시물 날짜 업데이트
    if (this.userInput.create_time) { // 생성 시간이 있다면 편집으로 간주
      this.userInput.modify_time = new Date().getTime();
    } else { // 생성 시간이 없다면 최초 생성으로 간주
      this.userInput.create_time = new Date().getTime();
    }
    // 서버 정보 지우기
    // 전체 정보(UserInput)를 텍스트 파일화
    // 서버에 동기화
    console.log('입력됨: ', this.userInput);
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    this.global.p5key['KeyShortCut']['BottomTab'] = this.BottomTabShortcut;
  }
}
