import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonSelect, LoadingController, NavController } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import * as p5 from "p5";
import { P5ToastService } from 'src/app/p5-toast.service';
import { DomSanitizer } from '@angular/platform-browser';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService, MatchOpCode } from 'src/app/nakama.service';
import { LocalNotiService } from 'src/app/local-noti.service';
import { isPlatform } from 'src/app/app.component';
import { StatusManageService } from 'src/app/status-manage.service';
import { ContentCreatorInfo, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { ActivatedRoute, Router } from '@angular/router';
import { VoiceRecorder } from "@langx/capacitor-voice-recorder";
import { ExtendButtonForm } from '../../subscribes/chat-room/chat-room.page';

/** 서버에서 생성한 경우 */
interface RemoteInfo {
  creator_id?: string;
  name?: string;
  /** 공유될 때 수신자의 정보에 맞게 재구성되어야 함 */
  isOfficial?: string;
  /** 공유될 때 수신자의 정보에 맞게 재구성되어야 함 */
  target?: string;
  group_id?: string;
  channel_id?: string;
  message_id?: string;
  type?: string;
}

@Component({
  selector: 'app-add-todo-menu',
  templateUrl: './add-todo-menu.page.html',
  styleUrls: ['./add-todo-menu.page.scss'],
})
export class AddTodoMenuPage implements OnInit, OnDestroy {
  @ViewChild('StartCalendar') StartCalendar: any;
  @ViewChild('Calendar') Calendar: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
    private sanitizer: DomSanitizer,
    private indexed: IndexedDBService,
    private nakama: NakamaService,
    private alertCtrl: AlertController,
    private noti: LocalNotiService,
    private statusBar: StatusManageService,
    private loadingCtrl: LoadingController,
    public global: GlobalActService,
    private navCtrl: NavController,
  ) { }

  /** 작성된 내용 */
  userInput = {
    /** 해야할 일 아이디  
     * 로컬에서 생성하면 날짜시간 정보로 생성  
     * 리모트에서 생성하면 'isOfficial_target ( _channel_id_message_id )' 로 생성됨  
     * 그룹에서 공유된 정보는 메시지id를 수신받은 후 메시지id까지 포함하여 생성
     */
    id: undefined,
    /** 저장소 명시  
     * 구분자: local, isOfficial_target (server), isOfficial_target_group_id (group)
     */
    storeAt: 'local',
    /** 사용자에게 보여지는 저장소 정보 */
    display_store: '',
    /** 간략한 제목 설정 */
    title: undefined,
    /** 최초 생성날짜 */
    create_at: undefined,
    /** 마지막 수정 일시 */
    written: undefined,
    /** 보여지는 시간 */
    startFrom: undefined,
    /** 기한 */
    limit: undefined,
    /** 사용자 지정 할 일 색상 */
    custom_color: undefined,
    /** 등록된 작업자 */
    workers: undefined as any[],
    /** 일의 중요도, 가시화 기한의 색상에 영향을 줌 */
    importance: '0',
    /** 상세 내용 */
    description: undefined,
    /** 서버에 저장된 경우 필요한 정보를 기입 */
    remote: undefined as RemoteInfo,
    /** 제작자 표시명 */
    display_creator: undefined,
    /** 첨부 이미지 정보 */
    attach: [] as FileInfo[],
    /** 이 업무는 완료되었습니다, 완료 후에도 변경될 수 있음 */
    done: undefined,
    /** 알림 아이디 저장 */
    noti_id: undefined,
    /** 사용자 지정 우선 서버 사용 여부  
     * 0: 기본값  
     * 1: FFS 우선  
     * 2: SQL 강제
     */
    CDN: undefined as number,
  };

  /** 사용자에게 보여지는 시작일시 문자열 */
  startDisplay: string;
  /** 사용자에게 보여지는 기한 문자열, 저장시 삭제됨 */
  limitDisplay: string;
  /** 스크롤 행동용 메인 div 개체 */
  MainDiv: HTMLElement;

  /** 파일 읽기 멈추기 위한 컨트롤러 */
  cont: AbortController;

  useVoiceRecording = false;
  /** 확장 버튼 행동들 */
  extended_buttons: ExtendButtonForm[] = [
    { // 0
      icon: 'document-attach-outline',
      name: this.lang.text['ChatRoom']['attachments'],
      act: () => {
        if (this.isButtonClicked) return;
        this.new_attach({ detail: { value: 'load' } });
      },
      context: () => {
        if (this.isButtonClicked) return;
        this.new_attach({ detail: { value: 'link' } });
        return false;
      }
    }, { // 1
      icon_img: 'voidDraw.png',
      name: this.lang.text['ChatRoom']['voidDraw'],
      act: () => {
        if (this.isButtonClicked) return;
        this.new_attach({ detail: { value: 'image' } });
      }
    },
    { // 2
      icon: 'reader-outline',
      name: this.lang.text['ChatRoom']['newText'],
      act: () => {
        if (this.isButtonClicked) return;
        this.new_attach({ detail: { value: 'text' } });
      }
    }, { // 3
      icon: 'camera-outline',
      name: this.lang.text['ChatRoom']['Camera'],
      act: () => {
        if (this.isButtonClicked) return;
        this.new_attach({ detail: { value: 'camera' } });
      }
    }, { // 4
      icon: 'mic-circle-outline',
      name: this.lang.text['ChatRoom']['Voice'],
      act: async () => {
        if (this.isButtonClicked) return;
        this.useVoiceRecording = !this.useVoiceRecording;
        if (this.useVoiceRecording) { // 녹음 시작
          let req = await VoiceRecorder.hasAudioRecordingPermission();
          if (req.value) { // 권한 있음
            this.extended_buttons[4].icon = 'stop-circle-outline';
            this.extended_buttons[4].name = this.lang.text['ChatRoom']['VoiceStop'];
            this.p5toast.show({
              text: this.lang.text['ChatRoom']['StartVRecord'],
            });
            await VoiceRecorder.startRecording();
          } else { // 권한이 없다면 권한 요청 및 UI 복구
            this.useVoiceRecording = false;
            this.extended_buttons[4].icon = 'mic-circle-outline';
            this.extended_buttons[4].name = this.lang.text['ChatRoom']['Voice'];
            await VoiceRecorder.requestAudioRecordingPermission();
          }
        } else await this.StopAndSaveVoiceRecording();
      }
    }, { // 5
      icon: 'cloud-done-outline',
      name: this.lang.text['ChatRoom']['Detour'],
      act: () => {
        this.toggle_custom_attach();
      }
    }];

  async StopAndSaveVoiceRecording() {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['AddPost']['SavingRecord'] });
    loading.present();
    try {
      let blob = await this.global.StopAndSaveVoiceRecording();
      await this.selected_blobFile_callback_act(blob, false);
    } catch (e) { }
    loading.dismiss();
    this.extended_buttons[4].icon = 'mic-circle-outline';
    this.extended_buttons[4].name = this.lang.text['ChatRoom']['Voice'];
  }

  /** 여기서는 페이지에 값이 들어왔는지 검토만 한다 */
  navParams: boolean;
  BackButtonPressed = false;
  AlreadyInited = false;
  ngOnInit() {
    this.cont = new AbortController();
    this.MainDiv = document.getElementById('main_div');
    this.nakama.socket_reactive['add_todo_menu'] = this;
    // 미리 지정된 데이터 정보가 있는지 검토
    this.route.queryParams.subscribe(_p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      this.navParams = Boolean(navParams);
      if (navParams) this.received_data = navParams.data;
      if (this.received_data && !this.AlreadyInited)
        this.userInput = { ...this.userInput, ...JSON.parse(this.received_data) };
      this.toggle_custom_attach(this.userInput.CDN || 0);
      this.AlreadyInited = true;
    });
    this.nakama.AddTodoLinkAct = async (info: string) => {
      if (this.p5timer) this.p5timer.remove();
      this.received_data = info;
      this.userInput = JSON.parse(this.received_data);
      await this.ionViewWillEnter();
      this.show_count_timer();
    };
    this.nakama.AddTodoManageUpdateAct = (todo_id: string, user_id: string, isDelete: boolean, act_time: number) => {
      if (this.userInput.id == todo_id) {
        for (let i = 0, j = this.userInput.workers.length; i < j; i++)
          if ((this.userInput.workers[i].user_id || this.userInput.workers[i].id) == user_id) {
            this.userInput.workers[i]['isDelete'] = isDelete;
            this.userInput.workers[i]['timestamp'] = act_time;
            this.userInput.workers[i]['displayTime'] = new Date(act_time).toLocaleString();
            this.worker_done++;
            break;
          }
      }
    }
    if (isPlatform == 'DesktopPWA')
      setTimeout(() => {
        if (!this.WillLeavePage) this.CreateDrop();
      }, 100);
    if (this.userInput.workers) {
      for (let i = 0, j = this.userInput.workers.length; i < j; i++)
        if (this.userInput.workers[i].timestamp) {
          this.userInput.workers[i]['displayTime'] = new Date(this.userInput.workers[i].timestamp).toLocaleString();
          this.worker_done++;
        }
    }
    this.nakama.StatusBarChangedCallback = () => {
      if (!this.isModify) { // 새 할 일인 경우
        this.LoadStorageList();
      } else { // 기존 할 일을 수정중이라면
        this.LoadStorageList();
        if (this.userInput.remote) { // 원격이라면 연결 여부를 업데이트
          try {
            let CurrentOnline = false;
            for (let i = 0, j = this.AvailableStorageList.length; i < j; i++) {
              if (this.AvailableStorageList[i].type == `${this.userInput.remote.isOfficial}/${this.userInput.remote.target}`) {
                CurrentOnline = true;
                break;
              }
            }
            this.isModifiable = CurrentOnline;
            if (!CurrentOnline) { // 해당 서버가 오프라인
              this.userInput.display_creator = this.lang.text['TodoDetail']['Disconnected'];
            } else { // 해당 서버가 온라인
              this.userInput.display_creator =
                this.nakama.GetOverrideName(this.userInput.remote.creator_id, this.userInput.remote.isOfficial, this.userInput.remote.target) ||
                this.nakama.load_other_user(this.userInput.remote.creator_id, this.userInput.remote.isOfficial, this.userInput.remote.target)['display_name'];
            }
          } catch (e) { }
        }
      }
    }
  }

  /** 연결끊긴 할 일을 삭제하고, 로컬로 저장함 */
  ChangeDisconnectStatus() {
    // 이 할 일이 오프라인임을 검토
    if (this.userInput.display_creator == this.lang.text['TodoDetail']['Disconnected']) {
      this.alertCtrl.create({
        header: this.lang.text['TodoDetail']['MoveToLocal'],
        message: this.lang.text['TodoDetail']['RemoveFromRemote'],
        buttons: [{
          text: this.lang.text['Nakama']['LocalNotiOK'],
          cssClass: 'redfont',
          handler: async () => {
            // 이 할 일 삭제 행동 모방
            this.isButtonClicked = true;
            await this.nakama.deleteTodoFromStorage(true, JSON.parse(JSON.stringify(this.userInput)));
            // 이 할 일을 로컬에 저장하기
            this.StoreAtSelChanged({ detail: { value: 'local' } });
            this.isModify = false;
            this.userInput.id = undefined;
            this.userInput.noti_id = undefined;
            this.userInput.create_at = undefined;
            delete this.userInput['modified'];
            this.saveData();
          }
        }]
      }).then(v => v.present());
    }
  }

  p5canvas: p5;
  CreateDrop() {
    let parent = document.getElementById('p5Drop_todo');
    this.p5canvas = new p5((p: p5) => {
      p.setup = () => {
        let canvas = p.createCanvas(parent.clientWidth, parent.clientHeight);
        canvas.parent(parent);
        p.pixelDensity(.1);
        canvas.drop(async (file: any) => {
          await this.selected_blobFile_callback_act(file.file, false);
        });
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
    });
  }

  async selected_blobFile_callback_act(blob: any, showLoading = true) {
    let saving_file: HTMLIonLoadingElement;
    if (showLoading) {
      saving_file = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      saving_file.present();
    }
    let this_file: FileInfo = this.global.selected_blobFile_callback_act(blob, 'tmp_files/todo/', {
      display_name: this.nakama.users.self['display_name'],
    });
    await this.checkHasSameFileAndRename(this_file);
    let FileURL = URL.createObjectURL(blob);
    if (this_file['viewer'] == 'image')
      this_file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(FileURL);
    try {
      await this.indexed.saveBlobToUserPath(blob, this_file['path']);
      this.userInput.attach.push(this_file);
      setTimeout(() => {
        URL.revokeObjectURL(FileURL);
      }, 0);
    } catch (e) {
      console.error('파일 올리기 실패: ', e);
      this.p5toast.show({
        text: this.lang.text['TodoDetail']['load_failed'],
      });
    }
    if (showLoading) saving_file.dismiss();
    this.auto_scroll_down();
  }

  /** 이름이 같은 파일인 경우 이름을 자동으로 변경 */
  async checkHasSameFileAndRename(this_file: FileInfo) {
    let has_same_named_file = false;
    has_same_named_file = await this.indexed.checkIfFileExist(this_file.path);
    if (this.userInput.id && !has_same_named_file)
      try {
        has_same_named_file = await this.indexed.checkIfFileExist(`todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/${this_file.filename}`);
      } catch (e) {
        has_same_named_file = await this.indexed.checkIfFileExist(`todo/${this.userInput.id}/${this_file.filename}`);
      }
    if (has_same_named_file) { // 동명의 파일 등록시 파일 이름 변형
      this_file.filename = `${this_file.filename.substring(0, this_file.filename.lastIndexOf('.'))}_.${this_file.file_ext}`;
      this_file['path'] = `tmp_files/todo/${this_file['filename']}`;
      await this.checkHasSameFileAndRename(this_file);
    }
  }

  /** 첨부파일 우클릭시 빠른 이미지 편집 */
  AttachmentContextMenu(_FileInfo: FileInfo, index: number) {
    if (!this.isStoreAtChangable) return false;
    let LoadAct = async () => {
      let FileURL = URL.createObjectURL(_FileInfo.blob);
      new p5((p: p5) => {
        p.setup = () => {
          p.noCanvas();
          p.loadImage(FileURL, v => {
            let related_creators: ContentCreatorInfo[] = [];
            if (_FileInfo['content_related_creator'])
              related_creators = [..._FileInfo['content_related_creator']];
            if (_FileInfo['content_creator']) { // 마지막 제작자가 이미 작업 참여자로 표시되어 있다면 추가하지 않음
              let is_already_exist = false;
              for (let i = 0, j = related_creators.length; i < j; i++)
                if (related_creators[i].user_id !== undefined && _FileInfo['content_creator']['user_id'] !== undefined
                  && related_creators[i].user_id == _FileInfo['content_creator']['user_id']) {
                  is_already_exist = true;
                  break;
                }
              if (!is_already_exist) related_creators.push(_FileInfo['content_creator']);
            }
            this.global.PageDismissAct['quick-modify-image'] = (v: any) => {
              if (v.data) this.voidDraw_fileAct_callback(v, related_creators, index);
              delete this.global.PageDismissAct['quick-modify-image'];
            }
            this.global.ActLikeModal('portal/main/add-todo-menu/void-draw', {
              path: _FileInfo.alt_path || _FileInfo.path,
              width: v.width,
              height: v.height,
              type: _FileInfo.type,
              dismiss: 'quick-modify-image',
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
    LoadAct();
    return false;
  }

  /** 하단에 보여지는 버튼 */
  buttonDisplay = {
    saveTodo: this.lang.text['TodoDetail']['buttonDisplay_add'],
  }

  /** 이 할 일을 내가 만들었는지 */
  AmICreator = true;
  /** 기존 할 일을 보러 온 것인지 */
  isModify = false;
  /** 로컬/원격 상태에 따른 수정 가능 여부 */
  isModifiable = false;
  received_data: string;
  /** 진입 후 저장소가 변경되었는지 검토 */
  isStoreAtChanged = false;
  /** 저장소 변경이 가능한지 검토 (원격이면서 작성자가 남이 아닌지 검토) */
  isStoreAtChangable = true;
  /** 타이틀에 포커스중인지 검토 */
  CheckIfTitleFocus = false;
  async ionViewWillEnter() {
    this.global.StoreShortCutAct('add-todo');
    this.WaitingLoaded = true;
    this.lock_modal_open = false;
    if (!this.navParams) return;
    VoiceRecorder.getCurrentStatus().then(v => {
      if (v.status == 'RECORDING') {
        // 게시물 생성기에서 음성녹음중인 상태로 들어오면 음성녹음을 할 수 없음
        this.extended_buttons[4].isHide = true;
      }
    });
    this.WillLeavePage = false;
    this.LoadStorageList();
    let received_json: any;
    if (this.received_data) { // 이미 있는 데이터 조회
      this.buttonDisplay.saveTodo = this.lang.text['TodoDetail']['buttonDisplay_modify'];
      received_json = JSON.parse(this.received_data);
      this.userInput = { ...this.userInput, ...received_json };
      this.isModify = true;
      if (this.isModify) {
        if (this.userInput.noti_id)
          this.noti.ClearNoti(this.userInput.noti_id);
      }
      // 기록된 저장소로 설정
      if (this.userInput.storeAt == 'local')
        this.StoreAt.value = 'local';
      else for (let i = 0, j = this.AvailableStorageList.length; i < j; i++)
        if (this.userInput.remote.isOfficial == this.AvailableStorageList[i].isOfficial
          && this.userInput.remote.target == this.AvailableStorageList[i].target) {
          this.StoreAt.value = this.AvailableStorageList[i];
          break;
        }
    } else { // 새로 만드는 경우
      this.userInput.limit = new Date().getTime();
      this.limitTimeP5Display = this.userInput.limit;
      if (this.AvailableStorageList.length) {
        this.StoreAt.value = this.AvailableStorageList[0].target;
        this.StoreAtSelChanged({ detail: { value: this.AvailableStorageList[0] } });
      }
    }
    let ionInput = document.getElementById('titleInput');
    this.titleIonInput = ionInput.children[0].children[1].children[0];
    if (!this.titleIonInput.onblur)
      this.titleIonInput.onblur = () => {
        this.CheckIfTitleFocus = false;
      }
    if (!this.titleIonInput.onfocus)
      this.titleIonInput.onfocus = () => {
        this.CheckIfTitleFocus = true;
      }
    setTimeout(() => {
      if (isPlatform == 'DesktopPWA' && !this.isModify && !this.titleIonInput.value)
        this.titleIonInput.focus();
    }, 200);
    this.ImporantSelChanged({ detail: { value: this.userInput.importance } });
    this.file_sel_id = `${this.userInput.id || 'new_todo_id'}_${new Date().getTime()}`;
    // 첨부 이미지가 있음
    // 이 할 일이 썸네일을 가지고 있는지 검토
    let has_thumbnail = false;
    try {
      has_thumbnail = await this.indexed.checkIfFileExist(`todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/thumbnail.png`);
    } catch (e) {
      has_thumbnail = await this.indexed.checkIfFileExist(`todo/${this.userInput.id}/thumbnail.png`);
    }
    if (this.userInput.attach.length) {
      let loading = await this.loadingCtrl.create({ message: this.lang.text['AddPost']['SyncAttaches'] });
      loading.present();
      for (let i = 0, j = this.userInput.attach.length; i < j; i++) {
        loading.message = `${this.lang.text['AddPost']['SyncAttaches']}: ${this.userInput.attach[i].filename}`;
        try {
          if (this.userInput.remote) {
            try {
              this.userInput.attach[i].alt_path = `todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/${this.userInput.attach[i].filename}`;
              this.userInput.attach[i].blob = (await this.nakama.sync_load_file(this.userInput.attach[i],
                this.userInput.remote.isOfficial, this.userInput.remote.target, 'todo_attach', this.userInput.remote.creator_id)).value;
              if (!this.userInput.attach[i].blob) throw '불러오기 실패함';
            } catch (e) {
              if (this.userInput.attach[i].url) {
                let checkFile = await this.indexed.checkIfFileExist(this.userInput.attach[i].alt_path || this.userInput.attach[i].path);
                if (!checkFile) {
                  let res = await fetch(this.userInput.attach[i].url);
                  if (res.ok) {
                    let blob = await res.blob();
                    await this.indexed.saveBlobToUserPath(blob, this.userInput.attach[i].alt_path || this.userInput.attach[i].path);
                    let loaded_blob = await this.indexed.loadBlobFromUserPath(this.userInput.attach[i].path, this.userInput.attach[i].type);
                    this.userInput.attach[i].blob = loaded_blob;
                  } else {
                    console.log('즉시 다운로드 실패: ', res);
                    this.p5toast.show({
                      text: `${this.lang.text['Nakama']['FailedDownload']}: ${res.statusText} (${res.status})`,
                    });
                  }
                }
                this.userInput.attach[i].thumbnail = this.userInput.attach[i].url;
              }
            }
            if (!has_thumbnail) { // 썸네일 이미지가 없다면 만들기
              if (this.userInput.attach[i].viewer == 'image') {
                let header_image = URL.createObjectURL(this.userInput.attach[i].blob);
                await new Promise((done: any) => {
                  new p5((p: p5) => {
                    p.setup = () => {
                      p.noCanvas();
                      p.loadImage(header_image, v => {
                        let isLandscapeImage = v.width > v.height;
                        if (isLandscapeImage)
                          v.resize(v.width / v.height * 128, 128);
                        else v.resize(128, v.height / v.width * 128);
                        let canvas = p.createCanvas(128, 128);
                        canvas.hide();
                        p.smooth();
                        p.pixelDensity(1);
                        p.image(v, -(v.width - 128) / 2, -(v.height - 128) / 2);
                        let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
                        let path: string;
                        try {
                          path = `todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/thumbnail.png`;
                        } catch (e) {
                          path = `todo/${this.userInput.id}/thumbnail.png`;
                        }
                        this.indexed.saveBase64ToUserPath(base64, path, (_) => {
                          if (this.global.p5todoAddtodo)
                            this.global.p5todoAddtodo(JSON.stringify(this.userInput));
                          done();
                        });
                        if (this.userInput.attach[i].blob) URL.revokeObjectURL(header_image);
                        p.remove();
                      }, e => {
                        console.error('Todo-등록된 이미지 불러오기 실패: ', e);
                        if (this.userInput.attach[i].blob) URL.revokeObjectURL(header_image);
                        p.remove();
                        done();
                      });
                    }
                  });
                });
              }
            }
          } else if (this.userInput.attach[i].viewer == 'image' || this.userInput.attach[i].viewer == 'text')
            this.userInput.attach[i].blob = await this.indexed.loadBlobFromUserPath(this.userInput.attach[i]['path'], this.userInput.attach[i]['type']);
          else throw '번외 썸네일 필요';
          if (!this.userInput.attach[i].blob) continue;
          let url = URL.createObjectURL(this.userInput.attach[i].blob);
          this.global.modulate_thumbnail(this.userInput.attach[i], url, this.cont);
        } catch (e) {
          this.global.modulate_thumbnail(this.userInput.attach[i], '', this.cont);
        }
        this.userInput.attach[i]['exist'] = true;
      }
      loading.dismiss();
    }
    // 저장소 표기 적용
    try {
      if (this.userInput.storeAt == 'local') {
        if (!this.isModify)
          this.StoreAt.value = this.userInput.storeAt;
        this.userInput.display_store = this.lang.text['TodoDetail']['OnThisDevice'];
        this.userInput.display_creator = this.lang.text['TodoDetail']['WrittenByMe'];
        this.isModifiable = true;
      } else if (this.userInput.remote) {
        if (!this.isModify)
          this.StoreAt.value = this.userInput.remote;
        this.userInput.display_store = this.userInput.remote.name;
        this.userInput.display_creator = this.lang.text['TodoDetail']['Disconnected'];
        if (!this.nakama.servers[this.userInput.remote.isOfficial] || !this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target]) {
          this.userInput.display_creator = this.lang.text['TodoDetail']['DeletedServer'];
          throw { text: 'Server Deleted', isModifiable: true };
        }
        if (this.statusBar.groupServer[this.userInput.remote.isOfficial]
          && this.statusBar.groupServer[this.userInput.remote.isOfficial][this.userInput.remote.target] != 'online') {
          this.isStoreAtChangable = false;
          throw { text: "Server disconnected", isModifiable: false };
        } else if (this.statusBar.groupServer[this.userInput.remote.isOfficial][this.userInput.remote.target] == 'online')
          this.isModifiable = true;
        // 제작자가 있다면 그게 나인지 검토
        if (this.userInput.remote.creator_id)
          this.AmICreator =
            this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id == this.userInput.remote.creator_id;
        this.userInput.display_creator =
          this.AmICreator ? this.lang.text['TodoDetail']['WrittenByMe'] :
            (this.nakama.GetOverrideName(this.userInput.remote.creator_id, this.userInput.remote.isOfficial, this.userInput.remote.target) ||
              this.nakama.load_other_user(this.userInput.remote.creator_id, this.userInput.remote.isOfficial, this.userInput.remote.target)['display_name']);
        if (this.userInput.remote.group_id)
          this.isModifiable = this.nakama.groups[this.userInput.remote.isOfficial][this.userInput.remote.target][this.userInput.remote.group_id]['status'] == 'online';
      }
    } catch (e) {
      this.isModifiable = e.isModifiable;
      console.log('Server issue: ', e);
    }
    this.noti.Current = this.userInput.id;
    let date_limit = new Date(this.userInput.limit);
    this.Calendar.value = new Date(date_limit.getTime() - date_limit.getTimezoneOffset() * 60 * 1000).toISOString();
    if (received_json)
      this.limitTimeP5Display = new Date(received_json['limit']).getTime();
    if (this.userInput.startFrom) {
      let date_start = new Date(this.userInput.startFrom);
      this.startDisplay = date_start.toLocaleString(this.lang.lang);
      this.startDisplay = this.startDisplay.substring(0, this.startDisplay.lastIndexOf(':'));
    }
    this.limit_change({ detail: { value: this.userInput.limit } });
    if (this.userInput.workers) { // 작업자 이름 동기화 시도
      for (let i = 0, j = this.userInput.workers.length; i < j; i++) {
        try {
          this.userInput.workers[i]['name'] =
            this.nakama.GetOverrideName(this.userInput.workers[i]['id'], this.userInput.remote.isOfficial, this.userInput.remote.target) ||
            this.nakama.load_other_user(this.userInput.workers[i]['id'],
              this.userInput.remote.isOfficial, this.userInput.remote.target)['display_name'];
        } catch (e) { }
        if (this.userInput.workers[i].timestamp)
          this.userInput.workers[i]['displayTime'] = new Date(this.userInput.workers[i].timestamp).toLocaleString();
      }
    }
    this.desc_input = document.getElementById('descInput') as HTMLInputElement;
    this.desc_input.onpaste = (ev: any) => {
      let stack = [];
      for (const clipboardItem of ev.clipboardData.files)
        stack.push({ file: clipboardItem });
      if (!stack.length) return;
      for (let i = 0, j = stack.length; i < j; i++)
        this.selected_blobFile_callback_act(stack[i].file);
      return false;
    }
  }

  /** 사용가능한 저장소 리스트 생성 */
  LoadStorageList() {
    // 저장소로 사용 가능한 서버와 그룹 수집
    let servers: RemoteInfo[] = [];
    let isOfficial = Object.keys(this.nakama.servers);
    isOfficial.forEach(_is_official => {
      let Target = Object.keys(this.nakama.servers[_is_official]);
      Target.forEach(_target => { // 온라인 그룹만 수집
        if (this.statusBar.groupServer[_is_official][_target] == 'online') {
          let serverInfo: RemoteInfo = {
            name: `${this.nakama.servers[_is_official][_target].info.name}`,
            isOfficial: _is_official,
            target: _target,
            type: `${_is_official}/${_target}`,
          }
          servers.push(serverInfo);
        }
      });
    });
    let merge = [...servers];
    merge.forEach(info => {
      this.AvailableStorageList.push(info);
    });
  }

  ionViewDidEnter() {
    this.show_count_timer();
    this.WillLeavePage = false;
    this.AddShortCut();
  }

  AddShortCut() {
    setTimeout(() => {
      if (this.WillLeavePage) return;
      this.global.p5KeyShortCut['Escape'] = () => {
        this.navCtrl.pop();
      }
      this.global.p5KeyShortCut['EnterAct'] = (ev: any) => {
        if (document.activeElement == this.titleIonInput)
          setTimeout(() => {
            this.desc_input.focus();
          }, 0);
        if (ev['ctrlKey']) this.saveData();
      }
    }, 0);
  }

  removeShortCut() {
    delete this.global.p5KeyShortCut['Escape'];
    delete this.global.p5KeyShortCut['Escape'];
  }

  start_change(ev: any) {
    this.userInput.startFrom = ev.detail.value;
    this.startDisplay = new Date(ev.detail.value).toLocaleString(this.lang.lang);
    this.startDisplay = this.startDisplay.substring(0, this.startDisplay.lastIndexOf(':'))
    this.startTimeP5Display = new Date(this.userInput.startFrom).getTime();
  }

  /** 기한이 현재시간보다 미래로 되어있어 기한으로서 의미가 있음 */
  isLimitUsable = false;
  /** 기한 변경됨 */
  limit_change(ev: any) {
    this.userInput.limit = ev.detail.value;
    let limitDate = new Date(ev.detail.value);
    if (limitDate.getTime() <= Date.now()) {
      this.limitDisplay = this.lang.text['TodoDetail']['NoDeadLine'];
    } else {
      this.limitDisplay = limitDate.toLocaleString(this.lang.lang);
      this.limitDisplay = this.limitDisplay.substring(0, this.limitDisplay.lastIndexOf(':'))
    }
    this.limitTimeP5Display = new Date(this.userInput.limit).getTime();
    this.startTimeP5Display = Date.now();
    this.isLimitUsable = this.limitTimeP5Display > this.startTimeP5Display;
  }

  /** 첨부파일 삭제 */
  remove_attach(i: number) {
    this.userInput.attach.splice(i, 1);
  }

  p5timer: p5;
  startTimeP5Display: number;
  limitTimeP5Display: number;
  /** 평소 기한 가시화 색상 */
  normal_color = '#8888';
  alert_color = '#0bb8';
  AlertLerpStartFrom = .8;
  show_count_timer() {
    this.p5timer = new p5((p: p5) => {
      let startAnimLerp = 0;
      {
        let catchStart = this.userInput.startFrom || this.userInput.written;
        this.startTimeP5Display = catchStart ? new Date(this.userInput.startFrom || this.userInput.written).getTime() : new Date().getTime();
      }
      this.startTimeP5Display = p.min(this.startTimeP5Display, this.limitTimeP5Display);
      let currentTime: number;
      let color = p.color(this.normal_color);
      p.setup = () => {
        let timerDiv = document.getElementById('p5timer');
        let canvas = p.createCanvas(timerDiv.clientWidth, timerDiv.clientHeight);
        canvas.id('timer');
        canvas.style('position', 'inherit');
        canvas.style('width', '100%');
        canvas.style('height', '100%');
        canvas.parent(timerDiv);
        p.noStroke();
      }
      let lerpVal = 0;
      let checkCurrent = () => {
        currentTime = new Date().getTime();
        if (this.limitTimeP5Display < currentTime)
          lerpVal = 1;
        else lerpVal = p.map(currentTime, this.startTimeP5Display, this.limitTimeP5Display, 0, 1, true);
        if (lerpVal <= this.AlertLerpStartFrom) {
          color = p.color(this.userInput.custom_color ? this.userInput.custom_color + '88' : this.normal_color);
        } else if (lerpVal > this.AlertLerpStartFrom)
          color = this.userInput.custom_color ? p.color(this.userInput.custom_color + '88')
            : p.lerpColor(p.color(this.normal_color), p.color(this.alert_color), p.map(lerpVal, this.AlertLerpStartFrom, 1, 0, 1) * startAnimLerp);
      }
      p.draw = () => {
        checkCurrent();
        p.clear(255, 255, 255, 255);
        p.push();
        p.fill(color);
        if (startAnimLerp < 1) {
          startAnimLerp += .04;
          if (startAnimLerp >= 1)
            startAnimLerp = 1;
          p.rect(0, 0, p.lerp(0, p.width, lerpVal * easeOut(startAnimLerp)), p.height);
        } else {
          p.rect(0, 0, p.lerp(0, p.width, lerpVal), p.height);
        }
        p.pop();
      }
      let easeOut = (t: number) => {
        return Flip(p.sq(Flip(t)));
      }
      let Flip = (t: number) => {
        return 1 - t;
      }
    });
  }

  /** 할 일 제목 입력칸 */
  titleIonInput: any;
  /** 할 일 내용 입력칸 */
  desc_input: HTMLInputElement;

  /** 새 파일 만들기 */
  async new_attach(ev: any) {
    switch (ev.detail.value) {
      case 'camera':
        try {
          let result = await this.global.from_camera('tmp_files/todo/', {
            display_name: this.nakama.users.self['display_name'],
          });
          result.thumbnail = this.sanitizer.bypassSecurityTrustUrl(result.base64);
          this.userInput.attach.push(result);
        } catch (e) {
          console.log('촬영 실패: ', e);
          this.p5toast.show({
            text: `${this.lang.text['GlobalAct']['ErrorFromCamera']}: ${e}`,
          });
        }
        this.AddShortCut();
        this.auto_scroll_down(100);
        break;
      case 'text':
        let new_textfile_name = this.global.TextEditorNewFileName();
        this.global.PageDismissAct['todo-text-add'] = (v: any) => {
          if (v.data) {
            let this_file: FileInfo = this.global.TextEditorAfterAct(v.data, {
              display_name: this.nakama.users.self['display_name'],
            });
            this.userInput.attach.push(this_file);
            this.auto_scroll_down();
          }
          this.global.RestoreShortCutAct('add-todo-add-text');
          delete this.global.PageDismissAct['todo-text-add'];
        }
        this.global.StoreShortCutAct('add-todo-add-text');
        this.global.ActLikeModal('portal/main/add-todo-menu/ionic-viewer', {
          info: {
            content: {
              is_new: 'text',
              type: 'text/plain',
              viewer: 'text',
              filename: new_textfile_name,
            },
          },
          noEdit: true,
          dismiss: 'todo-text-add',
        });
        break;
      case 'image':
        this.global.PageDismissAct['todo-image-add'] = (v: any) => {
          if (v.data) this.voidDraw_fileAct_callback(v);
          delete this.global.PageDismissAct['todo-image-add'];
        }
        this.global.ActLikeModal('portal/main/add-todo-menu/void-draw', {
          dismiss: 'todo-image-add',
        });
        break;
      case 'inapp': // 인앱 탐색기에서 가져오기
        this.global.PageDismissAct['todo-userfs-add'] = (v: any) => {
          if (v.data) this.selected_blobFile_callback_act(v.data);
          delete this.global.PageDismissAct['todo-userfs-add'];
        }
        this.global.ActLikeModal('user-fs-dir', {
          selector: true,
          dismiss: 'todo-userfs-add',
        });
        break;
      case 'load': // 불러오기 행동 병합
        this.select_attach();
        this.AddShortCut();
        break;
      case 'link':
        let pasted_url: string;
        try {
          try {
            let clipboard = await this.global.GetValueFromClipboard();
            switch (clipboard.type) {
              case 'text/plain':
                pasted_url = clipboard.value;
                break;
              case 'image/png':
                this.inputImageSelected({ target: { files: [clipboard.value] } });
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
            user_id: this.userInput.storeAt == 'local' ? 'local' : this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'link',
          });
          this_file['content_creator'] = {
            user_id: this.userInput.storeAt == 'local' ? 'local' : this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'link',
          };
          let sep = this_file.url.split('.');
          this_file.file_ext = sep.pop().split('?').shift();
          this_file.filename = decodeURIComponent(`${sep.pop().split('/').pop() || this.lang.text['ChatRoom']['ExternalLinkFile']}.${this_file.file_ext}`).split('_').pop();
          this.global.set_viewer_category_from_ext(this_file);
          this_file.type = '';
          this_file.typeheader = this_file.viewer;
          this.global.modulate_thumbnail(this_file, this_file.url, this.cont);
          this.userInput.attach.push(this_file);
        } catch (e) {
          if (e == 'done')
            throw e;
          else throw `인식 불가능한 URL 정보: ${e}`;
        }
        break;
    }
  }

  file_sel_id = '';
  /** 파일 첨부 */
  select_attach() {
    document.getElementById(this.file_sel_id).click();
  }
  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    if (!ev.target.files.length) return;
    let loading = await this.loadingCtrl.create({ message: this.lang.text['ContentViewer']['OnLoadContent'] });
    loading.present();
    for (let i = 0, j = ev.target.files.length; i < j; i++) {
      loading.message = `${this.lang.text['ContentViewer']['OnLoadContent']}: ${ev.target.files[i].name}`;
      await this.selected_blobFile_callback_act(ev.target.files[i], false);
    }
    loading.dismiss();
    let input = document.getElementById(this.file_sel_id) as HTMLInputElement;
    input.value = '';
  }

  /** 사용가능한 원격 서버 리스트 */
  AvailableStorageList: RemoteInfo[] = [];
  @ViewChild('StoreAt') StoreAt: IonSelect;
  StoreAtSelClicked() {
    this.StoreAt.open();
  }

  /** 단 하나라도 그룹으로부터 권한을 부여받은게 있다면 true */
  isManager = false;
  /** 가용 작업자 */
  AvailableWorker = {};
  /** 가용 작업자 그룹 (구분용) */
  WorkerGroups = [];
  /** 저장소 변경됨 */
  StoreAtSelChanged(ev: any) {
    this.isStoreAtChanged = true;
    let value: any = ev.detail.value;
    if (value == 'local') {
      this.userInput.storeAt = 'local';
      this.userInput.remote = undefined;
      this.isManager = false;
      this.userInput.workers = undefined;
    } else {
      this.userInput.storeAt = value.type;
      this.userInput.remote = value;
      this.userInput.workers = [];
      this.nakama.servers[value.isOfficial][value.target].client.getAccount(
        this.nakama.servers[value.isOfficial][value.target].session)
        .then(v => {
          let user_metadata = JSON.parse(v.user.metadata);
          this.WorkerGroups.length = 0;
          this.AvailableWorker = {};
          if (user_metadata['is_admin']) {
            // 관리자인 경우 모든 그룹 및 사용자 받기
            this.nakama.servers[value.isOfficial][value.target].client.rpc(
              this.nakama.servers[value.isOfficial][value.target].session,
              'query_all_groups', {})
              .then(v => {
                let groups = v.payload as any;
                for (let i = 0, j = groups.length; i < j; i++) {
                  // 그룹 별 사용자 링크
                  if (!this.AvailableWorker[groups[i].id])
                    this.AvailableWorker[groups[i].id] = [];
                  for (let k = 0, l = groups[i].users.length; k < l; k++) {
                    let user = this.nakama.load_other_user(groups[i].users[k].user.user_id,
                      value.isOfficial, value.target, user => {
                        delete user.todo_checked; // 기존 정보 무시
                        if (!user.email)
                          user['override_name'] = this.nakama.GetOverrideName(user.id || user.user_id, this.userInput.remote.isOfficial, this.userInput.remote.target);
                      });
                    if (!user.email)
                      this.AvailableWorker[groups[i].id].push(user);
                  }
                  if (!this.AvailableWorker[groups[i].id].length)
                    delete this.AvailableWorker[groups[i].id];
                  else this.WorkerGroups.push({
                    id: groups[i].id,
                    name: groups[i].name,
                  });
                }
                this.isManager = true;
              });
          } else this.UpdateWorkerList();
        });
    }
    setTimeout(() => {
      if (isPlatform == 'DesktopPWA' && !this.isModify && this.titleIonInput && !this.titleIonInput.value)
        this.titleIonInput.focus();
    }, 200);
  }

  /** 작업자 리스트 업데이트하기 */
  UpdateWorkerList() {
    if (!this.isStoreAtChanged) return;
    // 그룹으로부터 권한을 부여받은 경우 해당 그룹에 한하여 할 일 분배 가능
    let CountIfManager = 0;
    this.WorkerGroups.length = 0;
    this.userInput.workers = [];
    let isOfficial = Object.keys(this.nakama.PromotedGroup);
    for (let _is_official of isOfficial) {
      let target = Object.keys(this.nakama.PromotedGroup[_is_official]);
      for (let _target of target) {
        let gid = Object.keys(this.nakama.PromotedGroup[_is_official][_target]);
        for (let _gid of gid) {
          let group = this.nakama.groups[_is_official][_target][_gid];
          if (!this.AvailableWorker[group.id])
            this.AvailableWorker[group.id] = [];
          this.AvailableWorker[group.id].length = 0;
          for (let k = 0, l = group.users.length; k < l; k++) {
            if (!(group.users[k].user.user_id || group.users[k].user.id) // 작업자가 없거나 나라면 건너뛰기
              || (group.users[k].user.user_id || group.users[k].user.id) == this.nakama.servers[_is_official][_target].session.user_id)
              continue;
            let user = this.nakama.load_other_user(group.users[k].user.user_id || group.users[k].user.id,
              _is_official, _target, user => {
                delete user.todo_checked; // 기존 정보 무시
                if ((user.id || user.user_id) != this.nakama.servers[_is_official][_target].session.user_id
                  && user['display_name'])
                  user['override_name'] = this.nakama.GetOverrideName(user.id || user.user_id, this.userInput.remote.isOfficial, this.userInput.remote.target);
              });
            if ((user.id || user.user_id) != this.nakama.servers[_is_official][_target].session.user_id && user['display_name'])
              this.AvailableWorker[group.id].push(user);
          }
          if (!this.AvailableWorker[group.id].length)
            delete this.AvailableWorker[group.id];
          else this.WorkerGroups.push({
            id: group.id,
            name: group.name,
          });
          CountIfManager++;
        }
      }
    }
    this.isManager = CountIfManager != 0;
  }

  /** 전체 토글 기록용 */
  toggle_logs = {};
  /** 이 그룹 내 모든 사용자 토글 */
  toggle_all_user(group_id: string) {
    this.toggle_logs[group_id] = !this.toggle_logs[group_id];
    for (let i = 0, j = this.AvailableWorker[group_id].length; i < j; i++)
      this.AvailableWorker[group_id][i]['todo_checked'] = this.toggle_logs[group_id];
  }

  worker_done = 0;

  @ViewChild('ImporantSel') ImporantSel: any;
  ImporantSelClicked() {
    this.ImporantSel.open();
  }
  /** 중요도 변경됨 */
  ImporantSelChanged(ev: any) {
    this.userInput.importance = ev.detail.value;
    switch (this.userInput.importance) {
      case '0': // 메모
        this.normal_color = '#888b';
        this.alert_color = '#58a19288';
        this.AlertLerpStartFrom = .8;
        break;
      case '1': // 기억해야함
        this.normal_color = '#888b';
        this.alert_color = '#ddbb4188';
        this.AlertLerpStartFrom = .5;
        break;
      case '2': // 중요함
        this.normal_color = '#dddd0c88';
        this.alert_color = '#b9543788';
        this.AlertLerpStartFrom = .4;
        break;
    }
  }

  toggle_custom_color() {
    if (this.userInput.custom_color)
      this.userInput.custom_color = undefined;
    else {
      let color = document.getElementById('TodoCustomColorInput') as HTMLInputElement;
      color.click();
      this.userInput.custom_color = '#ff0000';
    }
  }

  WaitingLoaded = false;
  /** 정확히 현재 페이지가 처리되어야하는 경우 사용 */
  async WaitingCurrent() {
    while (!this.WaitingLoaded) {
      await new Promise((done) => setTimeout(done, 0));
    }
    return true;
  }

  lock_modal_open = false;
  open_content_viewer(index: number) {
    if (this.lock_modal_open) return;
    this.lock_modal_open = true;
    let createRelevances = [];
    for (let i = 0, j = this.userInput.attach.length; i < j; i++)
      createRelevances.push({ content: JSON.parse(JSON.stringify(this.userInput.attach[i])) });
    this.global.PageDismissAct['todo-ionicivewer'] = async (v: any) => {
      await this.WaitingCurrent();
      this.lock_modal_open = false;
      if (v.data) { // 파일 편집하기를 누른 경우
        switch (v.data.type) {
          case 'image':
            let related_creators: ContentCreatorInfo[] = [];
            if (this.userInput.attach[v.data.index]['content_related_creator'])
              related_creators = [...this.userInput.attach[v.data.index]['content_related_creator']];
            if (this.userInput.attach[v.data.index]['content_creator']) { // 마지막 제작자가 이미 작업 참여자로 표시되어 있다면 추가하지 않음
              let is_already_exist = false;
              for (let i = 0, j = related_creators.length; i < j; i++)
                if (related_creators[i].user_id !== undefined && this.userInput.attach[v.data.index]['content_creator']['user_id'] !== undefined
                  && related_creators[i].user_id == this.userInput.attach[v.data.index]['content_creator']['user_id']) {
                  is_already_exist = true;
                  break;
                }
              if (!is_already_exist) related_creators.push(this.userInput.attach[v.data.index]['content_creator']);
            }
            delete this.userInput.attach[v.data.index]['exist'];
            this.global.PageDismissAct['todo-modify-image'] = (w: any) => {
              if (w.data) {
                switch (v.data.msg.content.viewer) {
                  case 'image':
                    this.voidDraw_fileAct_callback(w, related_creators, v.data.index);
                    break;
                  default:
                    this.voidDraw_fileAct_callback(w, related_creators);
                    break;
                }
              }
              delete this.global.PageDismissAct['todo-modify-image'];
            }
            this.global.ActLikeModal('portal/main/add-todo-menu/void-draw', {
              path: v.data.path || this.userInput.attach[v.data.index]['alt_path'] || this.userInput.attach[v.data.index]['path'],
              width: v.data.width,
              height: v.data.height,
              type: v.data.filetype,
              text: v.data.text,
              dismiss: 'todo-modify-image',
            });
            break;
          case 'text':
            this.userInput.attach[v.data.index].content_related_creator.push(this.userInput.attach[v.data.index].content_creator);
            this.userInput.attach[v.data.index].content_creator = {
              timestamp: new Date().getTime(),
              display_name: this.nakama.users.self['display_name'],
              various: 'textedit',
            };
            this.userInput.attach[v.data.index].blob = v.data.blob;
            this.userInput.attach[v.data.index].path = v.data.path;
            this.userInput.attach[v.data.index].size = v.data.blob['size'];
            this.userInput.attach[v.data.index].filename = v.data.blob.name || this.userInput.attach[v.data.index].filename;
            delete this.userInput.attach[v.data.index]['exist'];
            break;
        }
      }
      this.global.RestoreShortCutAct('add-todo-viewer');
      delete this.global.PageDismissAct['todo-ionicivewer'];
    }
    this.noti.Current = 'IonicViewerPage';
    this.global.StoreShortCutAct('add-todo-viewer');
    let _is_official: string;
    let _target: string;
    let creator: string;
    try {
      creator = this.userInput.remote.creator_id;
      _is_official = this.userInput.remote.isOfficial;
      _target = this.userInput.remote.target;
    } catch (e) {
      _is_official = 'local';
    }
    this.global.ActLikeModal('portal/main/add-todo-menu/ionic-viewer', {
      info: {
        content: this.userInput.attach[index],
        sender_id: creator,
      },
      isOfficial: _is_official,
      target: _target,
      path: this.userInput.attach[index]['alt_path'] || this.userInput.attach[index]['path'],
      relevance: createRelevances,
      noEdit: !this.isModifiable,
      dismiss: 'todo-ionicivewer',
    });
  }

  auto_scroll_down(timeout = 0) {
    setTimeout(() => {
      this.MainDiv.scrollTo({ top: this.MainDiv.scrollHeight, behavior: 'smooth' });
    }, timeout);
  }

  async voidDraw_fileAct_callback(v: any, related_creators?: any, index?: number) {
    let this_file: FileInfo = await this.global.voidDraw_fileAct_callback(v, 'tmp_files/todo/', {
      display_name: this.nakama.users.self['display_name'],
    }, related_creators);
    try {
      if (index !== undefined) {
        this.userInput.attach[index] = this_file;
      } else throw 'not overwrite';
    } catch (e) {
      this.userInput.attach.push(this_file);
    }
    this.auto_scroll_down(100);
  }

  doneTodo() {
    this.isButtonClicked = true;
    this.nakama.doneTodo(this.userInput);
  }

  isCDNToggleClicked = false;
  async toggle_custom_attach(force?: number) {
    this.isCDNToggleClicked = true;
    this.userInput.CDN = (force ?? (this.userInput.CDN + 1)) % 2;
    switch (this.userInput.CDN) {
      case 0: // 기본값, cdn 서버 우선, 실패시 SQL
        this.extended_buttons[5].icon = 'cloud-offline-outline';
        this.extended_buttons[5].name = this.lang.text['ChatRoom']['Detour'];
        break;
      case 1: // FFS 서버 우선, 실패시 cdn, SQL 순
        this.extended_buttons[5].icon = 'cloud-done-outline';
        this.extended_buttons[5].name = this.lang.text['ChatRoom']['useFSS'];
        break;
      case 2: // SQL 강제
        this.extended_buttons[5].icon = 'server-outline';
        this.extended_buttons[5].name = this.lang.text['ChatRoom']['forceSQL'];
        break;
    }
    setTimeout(() => {
      this.isCDNToggleClicked = false;
    }, 0);
  }

  isButtonClicked = false;
  /** 이 해야할 일 정보를 저장 */
  async saveData() {
    if (!this.userInput.title) {
      this.p5toast.show({
        text: this.lang.text['TodoDetail']['needDisplayName'],
      });
      setTimeout(() => {
        if (this.titleIonInput) this.titleIonInput.focus();
      }, 0);
      return;
    }
    this.isButtonClicked = true;
    if (this.useVoiceRecording) await this.StopAndSaveVoiceRecording();
    let has_attach = Boolean(this.userInput.attach.length);
    delete this.userInput.display_store;
    delete this.userInput.display_creator;
    let server_info = {};
    try {
      let info = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].info;
      server_info['apache_port'] = info.apache_port;
      server_info['cdn_port'] = info.cdn_port;
    } catch (e) {
      server_info = {};
    }
    // 들어올 때와 같은지 검토
    let exactly_same = JSON.stringify(this.userInput) == this.received_data;
    if (exactly_same) {
      this.navCtrl.pop();
      return;
    } // ^ 같으면 저장 동작을 하지 않음
    if (!this.userInput.create_at) // 생성 날짜 기록
      this.userInput.create_at = new Date().getTime();
    // 저장소가 변경되었다면 기존 저장소에서 삭제 시도하고 아래 모든 저장 행동을 새 작업으로 간주하여 실행
    let received_json = this.received_data ? JSON.parse(this.received_data) : undefined;
    let isCDNChanged = received_json?.CDN != this.userInput.CDN;
    if ((this.isStoreAtChanged || isCDNChanged) && this.isModify) {
      // 첨부파일 복제 후 재등록
      for (let i = 0, j = received_json.attach.length; i < j; i++) {
        try {
          let filename = received_json.attach[i].filename;
          let blob = await this.indexed.loadBlobFromUserPath(received_json.attach[i].path, received_json.attach[i].type);
          let tmp_path = `tmp_files/todo/${filename}`;
          await this.indexed.saveBlobToUserPath(blob, tmp_path);
          this.userInput.attach[i].path = tmp_path;
          this.userInput.attach[i].blob = blob;
        } catch (e) {
          if (received_json.attach[i].url) {
            let filename = received_json.attach[i].filename;
            let res = await fetch(received_json.attach[i].url, { signal: this.cont.signal });
            let blob = await res.blob();
            let tmp_path = `tmp_files/todo/${filename}`;
            await this.indexed.saveBlobToUserPath(blob, tmp_path);
            this.userInput.attach[i].path = tmp_path;
            this.userInput.attach[i].blob = blob;
          }
        }
        delete this.userInput.attach[i].thumbnail;
        delete this.userInput.attach[i].alt_path;
        await this.global.remove_file_from_storage(this.userInput.attach[i].url, server_info);
        delete this.userInput.attach[i].url;
        delete this.userInput.attach[i]['exist'];
      }
      await this.nakama.deleteTodoFromStorage(true, received_json);
      this.isModify = false;
    }
    if (!this.userInput.id || !this.isModify) { // 할 일 구분자 생성 (내 기록은 날짜시간, 서버는 서버-시간 (isOfficial/target/DateTime),
      if (!this.userInput.remote) // local
        this.userInput.id = new Date(this.userInput.create_at).toISOString().replace(/[:|.|\/]/g, '_');
      else try {
        let counter = await this.nakama.getRemoteTodoCounter(this.userInput.remote.isOfficial, this.userInput.remote.target);
        this.userInput.id = `RemoteTodo_${counter}`;
      } catch (e) { }
    }
    // 알림 예약 생성
    if (this.userInput.noti_id) {  // 알림 아이디가 있다면 삭제 후 재배정
      this.nakama.RemoveLocalPushSchedule(this.userInput);
      this.nakama.removeRegisteredId(this.userInput.noti_id);
      this.noti.ClearNoti(this.userInput.noti_id);
    } // 알림 아이디가 없다면 새로 배정
    this.userInput.noti_id = this.nakama.get_noti_id();
    let attach_changed = false;
    if (!this.isModify && this.userInput.workers) { // 작업자 지정처리
      this.userInput.workers.length = 0;
      let keys = Object.keys(this.AvailableWorker);
      let check_duplicate = [];
      for (let i = 0, j = keys.length; i < j; i++)
        for (let k = 0, l = this.AvailableWorker[keys[i]].length; k < l; k++) {
          let target_id = this.AvailableWorker[keys[i]][k].id || this.AvailableWorker[keys[i]][k].user_id;
          if (this.AvailableWorker[keys[i]][k].todo_checked && !check_duplicate.includes(target_id)) {
            this.userInput.workers.push({
              id: target_id,
              name: this.nakama.load_other_user(target_id, this.userInput.remote.isOfficial, this.userInput.remote.target)['display_name'],
            });
            check_duplicate.push(target_id);
          }
        }
      if (!this.userInput.workers.length) // 없는 정보라면 무시
        this.userInput.workers = undefined;
    }
    { // 첨부파일의 변경사항 여부 확인
      try {
        received_json.attach.forEach(attach => {
          delete attach['exist'];
          delete attach['thumbnail'];
          delete attach['base64'];
          delete attach['blob'];
        });
        let received = JSON.stringify(received_json.attach);
        let current = JSON.parse(JSON.stringify(this.userInput.attach));
        current.forEach((attach: any) => {
          delete attach['exist'];
          delete attach['thumbnail'];
          delete attach['base64'];
          delete attach['blob'];
        });
        current = JSON.stringify(current);
        attach_changed = received != current;
      } catch (_e) {
        attach_changed = true;
      }
    }
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    if (has_attach && attach_changed) { // 첨부된 파일이 있다면
      if (received_json) { // 진입시 받은 정보가 있다면 수정 전 내용임
        try {
          for (let i = 0, j = received_json.attach.length; i < j; i++) {
            for (let k = 0, l = this.userInput.attach.length; k < l; k++) {
              if (this.userInput.attach[k]['path'] == received_json.attach[i]['path']) {
                received_json.attach[i]['exist'] = true;
                received_json.attach[i]['index'] = k;
                break;
              }
            } // 수정 전에 있던 이미지가 유지되는 경우 삭제하지 않음, 그 외 삭제
            if (!received_json.attach[i]['exist'] ||
              (received_json.attach[i]['exist'] && !this.userInput.attach[received_json.attach[i]['index']])) {
              if (received_json.attach[i]['url']) {
                if (received_json.attach[i].type !== '')
                  this.global.remove_file_from_storage(received_json.attach[i]['url'], server_info);
              } else await this.indexed.removeFileFromUserPath(received_json.attach[i]['path']);
            }
          }
        } catch (e) { }
      }
      let header_image: string; // 대표 이미지로 선정된 경로
      // 모든 파일을 새로 등록/재등록
      for (let i = 0, j = this.userInput.attach.length; i < j; i++) {
        // 이미 존재하는 파일로 알려졌다면 저장 시도하지 않도록 구성, 또는 썸네일 재구성
        let blob: Blob;
        let has_alternative_thumbnail = false;
        try { // 이미지가 아닌 파일이 대안 썸네일을 가지고 있는 경우 동작하기
          if (header_image) throw 'already exist';
          blob = await this.indexed.loadBlobFromUserPath(`${this.userInput.attach[i]['path']}_thumbnail.png`, 'image/png');
          has_alternative_thumbnail = true;
        } catch (e) { }
        if (!this.userInput.attach[i]['exist'] || (!header_image && this.userInput.attach[i]['viewer'] == 'image')) {
          try {
            if (!has_alternative_thumbnail)
              blob = await this.indexed.loadBlobFromUserPath(this.userInput.attach[i]['path'], this.userInput.attach[i]['type']);
          } catch (e) { }
          try { // FFS 업로드 시도
            if (this.userInput.CDN != 1) throw 'FFS 사용 순위에 없음';
            loading.message = `${this.lang.text['AddPost']['SyncAttaches']}: ${this.userInput.attach[i].filename}`;
            let CatchedAddress: string;
            CatchedAddress = await this.global.try_upload_to_user_custom_fs(this.userInput.attach[i], this.nakama.users.self['display_name'], loading);
            if (CatchedAddress) {
              delete this.userInput.attach[i]['partsize'];
              delete this.userInput.attach[i]['size'];
              this.userInput.attach[i]['url'] = CatchedAddress;
            } else throw '업로드 실패';
          } catch (e) {
            try {
              this.userInput.attach[i]['path'] = `todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/${this.userInput.attach[i]['filename']}`;
            } catch (e) {
              this.userInput.attach[i]['path'] = `todo/${this.userInput.id}/${this.userInput.attach[i]['filename']}`;
            }
            try {
              if (!blob) blob = await this.indexed.loadBlobFromUserPath(this.userInput.attach[i]['path'], this.userInput.attach[i]['type']);
              await this.indexed.saveBlobToUserPath(blob, this.userInput.attach[i]['path']);
            } catch (e) { }
          }
        } else delete this.userInput.attach[i]['exist'];
        if (!header_image && (this.userInput.attach[i]['viewer'] == 'image' || has_alternative_thumbnail))
          try {
            header_image = URL.createObjectURL(blob);
          } catch (e) { }
      }
      if (header_image) { // 대표 이미지가 있다면
        await new Promise((done: any) => {
          new p5((p: p5) => {
            p.setup = () => {
              p.noCanvas();
              p.loadImage(header_image, v => {
                let isLandscapeImage = v.width > v.height;
                if (isLandscapeImage)
                  v.resize(v.width / v.height * 128, 128);
                else v.resize(128, v.height / v.width * 128);
                let canvas = p.createCanvas(128, 128);
                canvas.hide();
                p.smooth();
                p.pixelDensity(1);
                p.image(v, -(v.width - 128) / 2, -(v.height - 128) / 2);
                let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
                let path: string;
                try {
                  path = `todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/thumbnail.png`;
                } catch (e) {
                  path = `todo/${this.userInput.id}/thumbnail.png`;
                }
                this.indexed.saveBase64ToUserPath(base64, path, (_) => {
                  done();
                });
                URL.revokeObjectURL(header_image);
                p.remove();
              }, e => {
                console.error('Todo-등록된 이미지 불러오기 실패: ', e);
                done();
                URL.revokeObjectURL(header_image);
                p.remove();
              });
            }
          });
        });
      }
    }
    if (!has_attach && attach_changed) { // 첨부된게 전혀 없다면 모든 이미지 삭제
      if (received_json) { // 진입시 받은 정보가 있다면 수정 전 내용임
        let path: string;
        try {
          path = `todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/thumbnail.png`;
        } catch (e) {
          path = `todo/${this.userInput.id}/thumbnail.png`;
        }
        await this.indexed.removeFileFromUserPath(path);
        if (received_json['attach'])
          for (let i = 0, j = received_json.attach.length; i < j; i++) {
            if (received_json.attach[i]['url']) {
              if (received_json.attach[i].type !== '')
                this.global.remove_file_from_storage(received_json.attach[i]['url'], server_info);
            } else await this.indexed.removeFileFromUserPath(received_json.attach[i]['path']);
          }
      }
    }
    this.userInput.attach.forEach(attach => {
      URL.revokeObjectURL(attach['thumbnail']);
      delete attach['thumbnail'];
      delete attach['exist'];
      delete attach['base64'];
    });
    this.userInput.written = new Date().getTime();
    if (this.userInput.startFrom) {
      let input_value = new Date(this.userInput.startFrom).getTime()
      let current = new Date().getTime();
      if (current > input_value)
        delete this.userInput.startFrom;
      else this.userInput.startFrom = input_value;
    }
    this.userInput.limit = new Date(this.userInput.limit).getTime();
    this.nakama.set_todo_notification(this.userInput);
    if (!this.isModify) { // 새로 만들 때
      if (this.userInput.remote && !this.userInput.remote.creator_id) // 원격 생성이면서 최초 생성
        this.userInput.remote.creator_id = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id;
    }
    if (this.userInput.remote) { // 서버에 저장한다면
      try {
        this.userInput.attach.forEach(file => {
          URL.revokeObjectURL(file['thumbnail']);
          delete file['thumbnail'];
          delete file['exist'];
          delete file['base64'];
        });
        // 파일 올리기 우선
        if (has_attach && attach_changed)
          if (received_json) { // 진입시 받은 정보가 있다면 수정 전 내용임
            for (let i = 0, j = received_json.attach.length; i < j; i++) {
              for (let k = 0, l = this.userInput.attach.length; k < l; k++) {
                if (this.userInput.attach[k]['path'] == received_json.attach[i]['path']) {
                  received_json.attach[i]['exist'] = true;
                  received_json.attach[i]['index'] = k;
                  break;
                }
              } // 수정 전에 있던 이미지가 유지되는 경우 삭제하지 않음, 그 외 삭제
              if (!received_json.attach[i]['exist'] ||
                (received_json.attach[i]['exist'] && !this.userInput.attach[received_json.attach[i]['index']]))
                if (received_json.attach[i]['url']) {
                  if (received_json.attach[i].type !== '')
                    this.global.remove_file_from_storage(received_json.attach[i]['url'], server_info);
                } else try {
                  await this.nakama.sync_remove_file(received_json.attach[i]['path'],
                    this.userInput.remote.isOfficial, this.userInput.remote.target, 'todo_attach');
                } catch (e) { }
            }
          }
        for (let i = 0, j = this.userInput.attach.length; i < j; i++) {
          if (this.userInput.attach[i].url) {
            delete this.userInput.attach[i]['path'];
            delete this.userInput.attach[i]['size'];
            delete this.userInput.attach[i]['partsize']; // 메시지 삭제 등의 업무 효율을 위해 정보 삭제
            continue;
          }
          try { // 서버에 연결된 경우 cdn 서버 업데이트 시도
            if (this.userInput.CDN == 2) throw 'ForceSQL';
            if (!this.userInput.attach[i].blob.size && this.userInput.attach[i].url)
              this.userInput.attach[i].blob = await (await fetch(this.userInput.attach[i].url, { signal: this.cont.signal })).blob();
            let address = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].info.address;
            let protocol = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].info.useSSL ? 'https:' : 'http:';
            let targetname = `${this.userInput.id}_${this.nakama.users.self['display_name']}`;
            try { // 원격인 경우를 위해 재구성 시도
              targetname = `${this.userInput.id}_${this.userInput.remote.creator_id}`;
            } catch (e) { }
            let savedAddress = await this.global.upload_file_to_storage(this.userInput.attach[i],
              { user_id: targetname, apache_port: server_info['apache_port'], cdn_port: server_info['cdn_port'] }, protocol, address, this.userInput.CDN == 1, loading);
            let isURL = Boolean(savedAddress);
            if (!isURL) throw '링크 만들기 실패';
            delete this.userInput.attach[i]['size'];
            delete this.userInput.attach[i]['partsize']; // 메시지 삭제 등의 업무 효율을 위해 정보 삭제
            this.userInput.attach[i]['url'] = savedAddress;
          } catch (e) {
            console.log('cdn 업로드 처리 실패: ', e);
            // url 파일을 SQL 처리하려는 경우 직접 다운받아서 사용하기
            if (e == 'ForceSQL' && this.userInput.attach[i].url)
              this.userInput.attach[i].blob = await (await fetch(this.userInput.attach[i].url, { signal: this.cont.signal })).blob();
            try {
              await this.nakama.sync_save_file(this.userInput.attach[i],
                this.userInput.remote.isOfficial, this.userInput.remote.target, 'todo_attach');
            } catch (e) { }
          }
        }
        if (this.userInput.workers) {
          if (!this.isModify) {
            let task_number = await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].client.rpc(
              this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session,
              'manage_todo_add_fn', this.userInput);
            this.userInput.id = `RemoteTodo_${task_number.payload['value']}`;
            this.nakama.RemoteTodoCounter[this.userInput.remote.isOfficial][this.userInput.remote.target].push(task_number.payload['value']);
            this.nakama.updateRemoteCounter(this.userInput.remote.isOfficial, this.userInput.remote.target);
          }
          for (let i = 0, j = this.userInput.workers.length; i < j; i++) {
            try { // 바보같겠지만 서버에서는 매치에 참여할 수 없기 때문에 사용자가 진입해서 보내줘야 한다
              let match = await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].client.readStorageObjects(
                this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session, {
                object_ids: [{
                  collection: 'self_share',
                  key: 'private_match',
                  user_id: this.userInput.workers[i].id,
                }],
              });
              if (match.objects.length) { // 가용 매치일 경우에 메시지 발송하기
                await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target]
                  .socket.joinMatch(match.objects[0].value['match_id']);
                await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target]
                  .socket.sendMatchState(match.objects[0].value['match_id'], MatchOpCode.MANAGE_TODO,
                    encodeURIComponent(`add,server_todo,${this.userInput.id}`));
                await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target]
                  .socket.leaveMatch(match.objects[0].value['match_id']);
              }
            } catch (e) {
              console.log(e);
            }
          }
        } else {
          let v = await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].client.writeStorageObjects(
            this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session, [{
              collection: 'server_todo',
              key: this.userInput.id,
              permission_read: 2,
              permission_write: 1,
              value: this.userInput,
            }]);
          this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target]
            .socket.sendMatchState(this.nakama.self_match[this.userInput.remote.isOfficial][this.userInput.remote.target].match_id, MatchOpCode.MANAGE_TODO,
              encodeURIComponent(`add,${v.acks[0].collection},${v.acks[0].key}`));
        }
        if (!this.isModify)
          await this.nakama.updateRemoteCounter(this.userInput.remote.isOfficial, this.userInput.remote.target);
      } catch (e) {
        console.error('해야할 일이 서버에 전송되지 않음: ', e);
        // 기존 할 일을 수정하다가 오류가 났다면 로컬에 변경사항을 저장
        if (this.isModify) {
          this.p5toast.show({
            text: this.lang.text['TodoDetail']['SaveAfterConnectServer'],
          });
          this.userInput['modified'] = true;
          if (this.global.p5todoAddtodo)
            this.global.p5todoAddtodo(JSON.stringify(this.userInput));
          let path: string;
          try {
            path = `todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/info.todo`;
          } catch (e) {
            path = `todo/${this.userInput.id}/info.todo`;
          }
          await this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), path);
          this.navCtrl.pop();
        } else this.p5toast.show({
          text: this.lang.text['TodoDetail']['CanAddToServer'],
        });
        this.isButtonClicked = false;
        loading.dismiss();
        return;
      }
    }
    loading.dismiss();
    this.userInput['is_me'] = true;
    if (this.global.p5todoAddtodo)
      this.global.p5todoAddtodo(JSON.stringify(this.userInput));
    let path: string;
    try { // 로컬 상황에 맞는 경로 생성
      path = `todo/${this.userInput.id}_${this.userInput.remote.isOfficial}_${this.userInput.remote.target}/info.todo`;
    } catch (e) {
      path = `todo/${this.userInput.id}/info.todo`;
    }
    await this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), path);
    this.navCtrl.pop();
  }

  /** 이 해야할 일 삭제 (삭제 버튼 전용) */
  deleteData() {
    this.alertCtrl.create({
      header: this.lang.text['TodoDetail']['remove'],
      message: this.lang.text['ChatRoom']['CannotUndone'],
      buttons: [{
        text: this.lang.text['TodoDetail']['remove'],
        handler: async () => {
          this.isButtonClicked = true;
          await this.nakama.deleteTodoFromStorage(true, this.userInput);
          this.navCtrl.pop();
        },
        cssClass: 'redfont',
      }]
    }).then(v => {
      this.global.p5KeyShortCut['Escape'] = () => {
        v.dismiss();
      }
      v.onDidDismiss().then(() => {
        this.global.p5KeyShortCut['Escape'] = () => {
          this.navCtrl.pop();
        }
      });
      v.present();
    });
  }

  WillLeavePage = false;
  async ionViewWillLeave() {
    this.global.RestoreShortCutAct('add-todo');
    this.WillLeavePage = true;
    this.WaitingLoaded = false;
    delete this.global.p5KeyShortCut['EnterAct'];
    this.removeShortCut();
    this.titleIonInput.onblur = null;
    this.titleIonInput.onfocus = null;
    this.noti.Current = '';
    if (this.p5timer)
      this.p5timer.remove();
  }

  ngOnDestroy() {
    this.indexed.GetFileListFromDB('tmp_files/todo', list => list.forEach(path => this.indexed.removeFileFromUserPath(path)));
    delete this.nakama.socket_reactive['add_todo_menu'];
    this.route.queryParams['unsubscribe']();
    this.desc_input.onpaste = null;
    this.cont.abort();
    this.cont = null;
    this.nakama.AddTodoLinkAct = null;
    this.nakama.AddTodoManageUpdateAct = null;
    if (this.p5canvas)
      this.p5canvas.remove();
    delete this.nakama.StatusBarChangedCallback;
  }
}
