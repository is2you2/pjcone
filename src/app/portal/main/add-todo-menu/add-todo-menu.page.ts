// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import * as p5 from "p5";
import { P5ToastService } from 'src/app/p5-toast.service';
import { IonicViewerPage } from '../../subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { DomSanitizer } from '@angular/platform-browser';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService, MatchOpCode } from 'src/app/nakama.service';
import { LocalNotiService } from 'src/app/local-noti.service';
import { isPlatform } from 'src/app/app.component';
import { StatusManageService } from 'src/app/status-manage.service';
import { ContentCreatorInfo, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { VoidDrawPage } from '../../subscribes/chat-room/void-draw/void-draw.page';
import { GodotViewerPage } from '../../subscribes/chat-room/godot-viewer/godot-viewer.page';
import { Camera } from '@awesome-cordova-plugins/camera/ngx';
import { ActivatedRoute, Router } from '@angular/router';

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
    public modalCtrl: ModalController,
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
    private sanitizer: DomSanitizer,
    private indexed: IndexedDBService,
    private nakama: NakamaService,
    private alertCtrl: AlertController,
    private noti: LocalNotiService,
    private statusBar: StatusManageService,
    private loadingCtrl: LoadingController,
    private global: GlobalActService,
    private camera: Camera,
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
    /** 필터용 태그 */
    tags: [],
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
    /** 책임자 id  
     * remote 정보인 경우 uid, local 정보인 경우 이 정보를 무시 (undefined 로 변경)
     */
    manager: undefined,
    /** 보여지는 책임자 이름 */
    display_manager: undefined,
    /** 업무 집중 여부 */
    is_focus: undefined,
    /** 알림 아이디 저장 */
    noti_id: undefined,
  };

  /** 저장된 태그 정보 */
  saved_tag: any[] = [];
  /** { key: count } */
  saved_tag_orig = {};

  /** 사용자에게 보여지는 시작일시 문자열 */
  startDisplay: string;
  /** 사용자에게 보여지는 기한 문자열, 저장시 삭제됨 */
  limitDisplay: string;
  /** 플랫폼 구분 */
  can_cordova: boolean;

  ngOnInit() {
    this.can_cordova = isPlatform == 'Android' || isPlatform == 'iOS';
    this.nakama.removeBanner();
    // 미리 지정된 데이터 정보가 있는지 검토
    this.route.queryParams.subscribe(_p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      if (navParams) this.received_data = navParams.data;
    })
    this.nakama.AddTodoLinkAct = async (info: string) => {
      this.nakama.removeBanner();
      this.p5timer.remove();
      this.received_data = info;
      this.userInput = JSON.parse(this.received_data);
      await this.ionViewWillEnter();
      this.show_count_timer();
    };
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
  async ionViewWillEnter() {
    this.indexed.loadTextFromUserPath('todo/tags.json', (e, v) => {
      if (e && v) {
        this.saved_tag_orig = JSON.parse(v);
        this.saved_tag = Object.keys(this.saved_tag_orig);
        if (this.saved_tag.length)
          this.needInputNewTagName = false;
      }
    });
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
    let received_json: any;
    if (this.received_data) { // 이미 있는 데이터 조회
      this.buttonDisplay.saveTodo = this.lang.text['TodoDetail']['buttonDisplay_modify'];
      received_json = JSON.parse(this.received_data);
      this.userInput = { ...this.userInput, ...received_json };
      this.isModify = true;
    } else { // 새로 만드는 경우
      let tomorrow = new Date(new Date().getTime() + 86400000);
      this.userInput.limit = tomorrow.getTime();
    }
    this.file_sel_id = `todo_${this.userInput.id || 'new_todo_id'}_${new Date().getTime()}`;
    // 첨부 이미지가 있음
    if (this.userInput.attach.length)
      for (let i = 0, j = this.userInput.attach.length; i < j; i++) {
        try {
          let blob: Blob;
          if (this.userInput.remote) {
            let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
            loading.present();
            blob = await this.nakama.sync_load_file(this.userInput.attach[i],
              this.userInput.remote.isOfficial, this.userInput.remote.target, 'todo_attach');
            loading.dismiss();
          } else if (this.userInput.attach[i].viewer == 'image' || this.userInput.attach[i].viewer == 'text')
            blob = await this.indexed.loadBlobFromUserPath(this.userInput.attach[i]['path'], this.userInput.attach[i]['type']);
          if (!blob) continue;
          let url = URL.createObjectURL(blob);
          this.global.modulate_thumbnail(this.userInput.attach[i], url);
        } catch (e) {
          console.log('첨부파일 불러오기 실패: ', e);
        }
        this.userInput.attach[i]['exist'] = true;
      }
    // 저장소 표기 적용
    try {
      if (this.userInput.storeAt == 'local') {
        if (!this.isModify)
          this.StoreAt.value = this.userInput.storeAt;
        this.userInput.display_store = this.lang.text['TodoDetail']['OnThisDevice'];
        this.userInput.display_creator = this.lang.text['TodoDetail']['WrittenByMe'];
        this.userInput.display_manager = this.lang.text['TodoDetail']['WrittenByMe'];
        this.isModifiable = true;
      } else if (this.userInput.remote) {
        if (!this.isModify)
          this.StoreAt.value = this.userInput.remote;
        this.userInput.display_store = this.userInput.remote.name;
        this.userInput.display_creator = this.lang.text['TodoDetail']['Disconnected'];
        this.userInput.display_manager = this.lang.text['TodoDetail']['Disconnected'];
        if (!this.nakama.servers[this.userInput.remote.isOfficial] || !this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target]) {
          this.userInput.display_creator = this.lang.text['TodoDetail']['DeletedServer'];
          throw { text: 'Server Deleted', isModifiable: true };
        }
        if (this.statusBar.groupServer[this.userInput.remote.isOfficial]
          && this.statusBar.groupServer[this.userInput.remote.isOfficial][this.userInput.remote.target] != 'online') {
          throw { text: "Server disconnected", isModifiable: false };
        } else if (this.statusBar.groupServer[this.userInput.remote.isOfficial][this.userInput.remote.target] == 'online')
          this.isModifiable = true;
        this.AmICreator =
          this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id == this.userInput.remote.creator_id;
        this.userInput.display_creator = this.AmICreator ? this.lang.text['TodoDetail']['WrittenByMe'] : this.nakama.load_other_user(this.userInput.remote.creator_id, this.userInput.remote.isOfficial, this.userInput.remote.target)['display_name'];
        let AmIManager = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id == this.userInput.manager;
        this.userInput.display_manager = AmIManager ? this.nakama.users.self['display_name'] : this.nakama.load_other_user(this.userInput.manager, this.userInput.remote.isOfficial, this.userInput.remote.target)['display_name'];
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
    this.limitDisplay = date_limit.toLocaleString(this.lang.lang);
    this.limitDisplay = this.limitDisplay.substring(0, this.limitDisplay.lastIndexOf(':'));
    this.isLimitChangable = true;
  }

  ionViewDidEnter() {
    this.show_count_timer();
  }

  isStartCalendarHidden = true;
  /** 달력 켜기끄기 */
  toggle_start_calendar() {
    this.isStartCalendarHidden = !this.isStartCalendarHidden;
    this.isCalendarHidden = true;
  }

  isCalendarHidden = true;
  /** 달력 켜기끄기 */
  toggle_calendar() {
    this.isCalendarHidden = !this.isCalendarHidden;
    this.isStartCalendarHidden = true;
  }

  start_change(ev: any) {
    if (!this.isLimitChangable) return;
    this.userInput.startFrom = ev.detail.value;
    this.startDisplay = new Date(ev.detail.value).toLocaleString(this.lang.lang);
    this.startDisplay = this.startDisplay.substring(0, this.startDisplay.lastIndexOf(':'))
    this.startTimeP5Display = new Date(this.userInput.startFrom).getTime();
  }

  isLimitChangable = false;
  /** 기한 변경됨 */
  limit_change(ev: any) {
    if (!this.isLimitChangable) return;
    this.userInput.limit = ev.detail.value;
    this.limitDisplay = new Date(ev.detail.value).toLocaleString(this.lang.lang);
    this.limitDisplay = this.limitDisplay.substring(0, this.limitDisplay.lastIndexOf(':'))
    this.limitTimeP5Display = new Date(this.userInput.limit).getTime();
  }

  /** 첨부파일 삭제 */
  remove_attach(i: number) {
    this.userInput.attach.splice(i, 1);
  }

  p5timer: p5;
  startTimeP5Display: number;
  limitTimeP5Display: number;
  /** 평소 기한 가시화 색상 */
  normal_color = '#888b';
  alert_color = '#0bbb';
  AlertLerpStartFrom = .8;
  show_count_timer() {
    this.p5timer = new p5((p: p5) => {
      let startAnimLerp = 0;
      this.startTimeP5Display = new Date(this.userInput.startFrom || this.userInput.written).getTime();
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
          color = p.color(this.normal_color);
        } else if (lerpVal > this.AlertLerpStartFrom)
          color = p.lerpColor(p.color(this.normal_color), p.color(this.alert_color), p.map(lerpVal, this.AlertLerpStartFrom, 1, 0, 1) * startAnimLerp);
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

  from_camera() {
    this.camera.getPicture({
      destinationType: 0,
      correctOrientation: true,
    }).then(async v => {
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      let this_file: FileInfo = {};
      let time = new Date();
      this_file.filename = `Camera_${time.toLocaleString().replace(/[:|.|\/]/g, '_')}.jpeg`;
      this_file.file_ext = 'jpeg';
      this_file.base64 = 'data:image/jpeg;base64,' + v;
      this_file.thumbnail = this.sanitizer.bypassSecurityTrustUrl(this_file.base64);
      this_file.type = 'image/jpeg';
      this_file.typeheader = 'image';
      this_file.content_related_creator = [{
        // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
        timestamp: new Date().toLocaleString(),
        display_name: this.nakama.users.self['display_name'],
      }];
      this_file.content_creator = {
        // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
        timestamp: new Date().toLocaleString(),
        display_name: this.nakama.users.self['display_name'],
      };
      this_file['path'] = `tmp_files/todo/${this_file['filename']}`;
      this_file['viewer'] = 'image';
      await this.indexed.saveFileToUserPath(this_file.base64, this_file['path']);
      loading.dismiss();
      this.userInput.attach.push(this_file);
    });
  }

  /** 새 그림 만들기 */
  new_attach() {
    this.modalCtrl.create({
      component: VoidDrawPage,
    }).then(v => {
      v.onWillDismiss().then(async v => {
        if (v.data) {
          let this_file: FileInfo = {};
          this_file['filename'] = v.data['name'];
          this_file['file_ext'] = 'png';
          this_file['type'] = 'image/png';
          this_file['content_related_creator'] = [{
            // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().toLocaleString(),
            display_name: this.nakama.users.self['display_name'],
          }];
          this_file['content_creator'] = {
            // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().toLocaleString(),
            display_name: this.nakama.users.self['display_name'],
          };
          this_file['viewer'] = 'image';
          this_file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
          this_file['path'] = `tmp_files/todo/${this_file['filename']}`;
          await this.indexed.saveFileToUserPath(v.data['img'], this_file['path']);
          v.data['loadingCtrl'].dismiss();
          this.userInput.attach.push(this_file);
        }
      });
      v.present();
    });
  }
  file_sel_id = '';
  /** 파일 첨부 */
  select_attach() {
    document.getElementById(this.file_sel_id).click();
  }
  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    if (!ev.target.files.length) return;
    let saving_file = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    saving_file.present();
    let this_file: FileInfo = {};
    this_file['filename'] = ev.target.files[0]['name'];
    this_file['file_ext'] = ev.target.files[0]['name'].substring(ev.target.files[0]['name'].lastIndexOf('.') + 1);
    this_file['size'] = ev.target.files[0]['size'];
    this_file['type'] = ev.target.files[0]['type'];
    this_file['path'] = `tmp_files/todo/${this_file['filename']}`;
    this_file['content_related_creator'] = [{
      timestamp: new Date().toLocaleString(),
      display_name: this.lang.text['GlobalAct']['UnCheckableCreator'],
    }];
    this_file['content_creator'] = {
      // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
      timestamp: new Date().toLocaleString(),
      display_name: this.nakama.users.self['display_name'],
    };
    let has_same_named_file = false;
    has_same_named_file = await this.indexed.checkIfFileExist(this_file.path)
    if (this.userInput.id && !has_same_named_file) has_same_named_file = await this.indexed.checkIfFileExist(`todo/${this.userInput.id}/${this_file.filename}`);
    if (has_same_named_file) // 동명의 파일 등록시 파일 이름 변형
      this_file.filename = `${this_file.filename.substring(0, this_file.filename.lastIndexOf('.'))}_.${this_file.file_ext}`;
    this.global.set_viewer_category(this_file);
    this.userInput.attach.push(this_file);
    this_file.base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    if (this_file['viewer'] == 'image')
      this_file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(this_file.base64);
    this.indexed.saveFileToUserPath(this_file.base64, this_file['path'], (_) => {
      saving_file.dismiss();
    });
  }
  AvailableStorageList: RemoteInfo[] = [];
  @ViewChild('StoreAt') StoreAt: any;
  StoreAtSelClicked() {
    this.StoreAt.open();
  }
  /** 중요도 변경됨 */
  StoreAtSelChanged(ev: any) {
    let value: any = ev.detail.value;
    if (value == 'local') {
      this.userInput.storeAt = 'local';
      this.userInput.remote = undefined;
      this.userInput.manager = undefined;
    } else {
      this.userInput.storeAt = value.type;
      this.userInput.remote = value;
    }
  }
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
        this.alert_color = '#0bbb';
        this.AlertLerpStartFrom = .8;
        break;
      case '1': // 기억해야함
        this.normal_color = '#888b';
        this.alert_color = '#dddd0cbb';
        this.AlertLerpStartFrom = .5;
        break;
      case '2': // 중요함
        this.normal_color = '#dddd0cbb';
        this.alert_color = '#800b';
        this.AlertLerpStartFrom = .4;
        break;
    }
  }
  @ViewChild('TagSel') TagSel: any;
  /** 새로 지정된 태그가 임시로 기억됨 */
  NewTagName: string = '';
  TagSelClicked() {
    this.TagSel.open();
  }
  needInputNewTagName = true;
  TagSelChanged(ev: any) {
    let selected: string[] = ev.detail.value;
    this.needInputNewTagName = selected.includes('@new_tag');
    if (this.needInputNewTagName)
      selected.splice(selected.lastIndexOf('@new_tag'), 1);
    this.userInput.tags = selected;
  }
  InputNewTag = '';
  AddNewTag() {
    this.InputNewTag = this.InputNewTag.trim();
    if (!this.InputNewTag) {
      setTimeout(() => {
        this.needInputNewTagName = false;
        this.InputNewTag = '';
      }, 0);
      return;
    }
    let exactly_new = true;
    for (let i = 0, j = this.saved_tag.length; i < j; i++)
      if (this.saved_tag[i] == this.InputNewTag) {
        exactly_new = false;
        break;
      }
    if (exactly_new) {
      this.saved_tag.push(this.InputNewTag);
      this.userInput.tags.push(this.InputNewTag);
    }
    setTimeout(() => {
      this.needInputNewTagName = false;
      this.InputNewTag = '';
    }, 0);
  }

  /** 태그 정보를 저장하기 */
  saveTagInfo() {
    // 원본 정보 대비했을 때 대비 가감처리
    let get_tags_from_orig = this.received_data ? JSON.parse(this.received_data) : {};
    let orig_data: string[] = get_tags_from_orig['tags'] ?? [];
    let input_data: string[] = this.userInput.tags ? JSON.parse(JSON.stringify(this.userInput.tags)) : [];
    let additive = [];
    let subtractive = [];
    orig_data.sort();
    input_data.sort();
    if (input_data.length) // 비교군이 있는 경우
      for (let i = 0, j = input_data.length; i < j; i++) {
        let index = orig_data.indexOf(input_data[i]);
        if (index >= 0) // 유지되는 값은 무시함
          orig_data.splice(index, 1);
        else // 기존에 없던 값이 생겼다면 추가로 판단
          additive.push(input_data[i]);
      }
    // 비교군이 없다면 기존 정보는 삭제된 것으로 판단
    subtractive = orig_data;
    // 더 이상 사용하지 않는다면 삭제
    additive.forEach(added_tag => {
      if (!this.saved_tag_orig[added_tag])
        this.saved_tag_orig[added_tag] = 0;
      this.saved_tag_orig[added_tag] = this.saved_tag_orig[added_tag] + 1;
    });
    subtractive.forEach(removed_tag => {
      if (this.saved_tag_orig[removed_tag])
        this.saved_tag_orig[removed_tag] = this.saved_tag_orig[removed_tag] - 1;
      if (this.saved_tag_orig[removed_tag] <= 0)
        delete this.saved_tag_orig[removed_tag];
    });
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.saved_tag_orig), 'todo/tags.json');
  }

  /** 완료 또는 삭제시 이 할 일에 적용된 태그를 제거 */
  removeTagInfo() {
    let input_data: string[] = this.userInput.tags ? JSON.parse(JSON.stringify(this.userInput.tags)) : [];
    input_data.forEach(removed_tag => {
      if (this.saved_tag_orig[removed_tag])
        this.saved_tag_orig[removed_tag] = this.saved_tag_orig[removed_tag] - 1;
      if (this.saved_tag_orig[removed_tag] <= 0)
        delete this.saved_tag_orig[removed_tag];
    });
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.saved_tag_orig), 'todo/tags.json');
  }

  open_ionic_viewer(index: number) {
    this.modalCtrl.create({
      component: IonicViewerPage,
      componentProps: {
        info: this.userInput.attach[index],
        path: this.userInput.attach[index]['path'],
      },
    }).then(v => {
      v.onDidDismiss().then((v) => {
        if (v.data) { // 파일 편집하기를 누른 경우
          let related_creators: ContentCreatorInfo[] = [];
          if (this.userInput.attach[index]['content_related_creator'])
            related_creators.push(...this.userInput.attach[index]['content_related_creator']);
          if (this.userInput.attach[index]['content_creator']) { // 마지막 제작자가 이미 작업 참여자로 표시되어 있다면 추가하지 않음
            let is_already_exist = false;
            for (let i = 0, j = related_creators.length; i < j; i++)
              if (related_creators[i].user_id == this.userInput.attach[index]['content_creator']['user_id']) {
                is_already_exist = true;
                break;
              }
            if (!is_already_exist) related_creators.push(...this.userInput.attach['content_creator']);
          }
          delete this.userInput.attach[index]['exist'];
          this.modalCtrl.create({
            component: VoidDrawPage,
            componentProps: {
              path: this.userInput.attach[index]['path'],
              width: v.data.width,
              height: v.data.height,
            },
          }).then(v => {
            v.onWillDismiss().then(v => {
              if (v.data) {
                let this_file: FileInfo = this.userInput.attach[index];
                this_file['filename'] = v.data['name'];
                this_file['file_ext'] = 'png';
                this_file['type'] = 'image/png';
                this_file['viewer'] = 'image';
                if (v.data['is_modify']) {
                  this_file['content_related_creator'] = related_creators;
                  this_file['content_creator'] = {
                    // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                    timestamp: new Date().toLocaleString(),
                    display_name: this.nakama.users.self['display_name'],
                  };
                } else {
                  this_file['content_related_creator'] = [{
                    // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                    timestamp: new Date().toLocaleString(),
                    display_name: this.nakama.users.self['display_name'],
                  }];
                  this_file['content_creator'] = {
                    // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                    timestamp: new Date().toLocaleString(),
                    display_name: this.nakama.users.self['display_name'],
                  };
                }
                this_file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
                this_file['path'] = `tmp_files/todo/${this_file['filename']}`;
                this.indexed.saveFileToUserPath(v.data['img'], this_file['path'], (_) => {
                  v.data['loadingCtrl'].dismiss();
                });
              }
            });
            v.present();
          });
          return;
        }
      });
      this.noti.Current = 'IonicViewerPage';
      v.present();
    });
  }

  open_godot_viewer(i: number) {
    this.modalCtrl.create({
      component: GodotViewerPage,
      componentProps: {
        info: this.userInput.attach[i],
        path: this.userInput.attach[i]['path'],
      },
    }).then(v => {
      v.onDidDismiss().then(v => {
        if (v.data) { // 파일 편집하기를 누른 경우
          let related_creators: ContentCreatorInfo[] = [];
          if (this.userInput.attach[i]['content_related_creator'])
            related_creators.push(...this.userInput.attach[i]['content_related_creator']);
          if (this.userInput.attach[i]['content_creator']) { // 마지막 제작자가 이미 작업 참여자로 표시되어 있다면 추가하지 않음
            let is_already_exist = false;
            for (let i = 0, j = related_creators.length; i < j; i++)
              if (related_creators[i].user_id == this.userInput.attach[i]['content_creator']['user_id']) {
                is_already_exist = true;
                break;
              }
            if (!is_already_exist) related_creators.push(...this.userInput.attach['content_creator']);
          }
          delete this.userInput.attach[i]['exist'];
          this.modalCtrl.create({
            component: VoidDrawPage,
            componentProps: {
              path: v.data.path,
              width: v.data.width,
              height: v.data.height,
            },
          }).then(v => {
            v.onWillDismiss().then(v => {
              if (v.data) {
                let this_file: FileInfo = {};
                this.userInput.attach.push(this_file);
                this_file['filename'] = v.data['name'];
                this_file['file_ext'] = 'png';
                this_file['type'] = 'image/png';
                this_file['viewer'] = 'image';
                if (v.data['is_modify']) {
                  this_file['content_related_creator'] = related_creators;
                  this_file['content_creator'] = {
                    // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                    timestamp: new Date().toLocaleString(),
                    display_name: this.nakama.users.self['display_name'],
                  };
                } else {
                  this_file['content_related_creator'] = [{
                    // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                    timestamp: new Date().toLocaleString(),
                    display_name: this.nakama.users.self['display_name'],
                  }];
                  this_file['content_creator'] = {
                    // user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                    timestamp: new Date().toLocaleString(),
                    display_name: this.nakama.users.self['display_name'],
                  };
                }
                this_file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
                this_file['path'] = `tmp_files/todo/${this_file['filename']}`;
                this.indexed.saveFileToUserPath(v.data['img'], this_file['path'], (_) => {
                  v.data['loadingCtrl'].dismiss();
                });
              }
            });
            v.present();
          });
        }
      });
      this.noti.Current = 'GodotViewerPage';
      v.present();
    });
  }

  /** 이 일을 완료했습니다 */
  async doneTodo() {
    this.isButtonClicked = true;
    this.userInput.done = true;
    if (this.global.godot_window['add_todo'])
      this.global.godot_window['add_todo'](JSON.stringify(this.userInput));
    if (this.userInput.remote) {
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      if (this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target])
        await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target]
          .socket.sendMatchState(this.nakama.self_match[this.userInput.remote.isOfficial][this.userInput.remote.target].match_id, MatchOpCode.ADD_TODO,
            encodeURIComponent(`done,${this.userInput.id}`));
      loading.dismiss();
    }
    this.deleteFromStorage(false);
  }

  /** 다른 사람에게 일을 부탁합니다 */
  moveTodo() {
    console.warn('업무 이관 행동 필요');
  }

  /** 이 일을 집중적으로 하고 있음을 알립니다 */
  focusTodo() {
    console.warn('업무 집중 행동 필요... 집중 말고 다른게 필요');
  }

  isButtonClicked = false;
  /** 이 해야할 일 정보를 저장 */
  async saveData() {
    if (!this.userInput.title) {
      this.p5toast.show({
        text: this.lang.text['TodoDetail']['needDisplayName'],
      });
      return;
    }
    this.isButtonClicked = true;
    let has_attach = Boolean(this.userInput.attach.length);
    delete this.userInput.display_store;
    delete this.userInput.display_manager;
    delete this.userInput.display_creator;
    // 새 태그구성이 완료된 경우
    let trim_tag = this.InputNewTag.trim();
    if (trim_tag) {
      if (!this.userInput.tags.includes(trim_tag))
        this.userInput.tags.push(trim_tag);
    }
    // 들어올 때와 같은지 검토
    let exactly_same = JSON.stringify(this.userInput) == this.received_data;
    if (exactly_same) {
      this.navCtrl.back();
      return;
    } // ^ 같으면 저장 동작을 하지 않음
    if (!this.userInput.create_at) // 생성 날짜 기록
      this.userInput.create_at = new Date().getTime();
    if (!this.userInput.id || !this.isModify) { // 할 일 구분자 생성 (내 기록은 날짜시간, 서버는 서버-시간 (isOfficial/target/DateTime),
      //그룹채널 기록은 채널-메시지: isOfficial/target/channel_id/msg_id)
      if (!this.userInput.remote) // local
        this.userInput.id = new Date(this.userInput.create_at).toISOString().replace(/[:|.|\/]/g, '_');
      else if (!this.userInput.remote.channel_id) // server
        this.userInput.id = `${this.userInput.remote.isOfficial}_${this.userInput.remote.target}_${new Date(this.userInput.create_at).toISOString().replace(/[:|.|\/]/g, '_')}`;
      else {// group
        this.userInput.id = `${this.userInput.remote.isOfficial}_${this.userInput.remote.target}_${this.userInput.remote.channel_id}_${this.userInput.remote.message_id}`;
      }
    }
    // 알림 예약 생성
    if (this.userInput.noti_id) {  // 알림 아이디가 있다면 삭제 후 재배정
      if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
        clearTimeout(this.nakama.web_noti_id[this.userInput.noti_id]);
        delete this.nakama.web_noti_id[this.userInput.noti_id];
      }
      this.noti.ClearNoti(this.userInput.noti_id);
    } // 알림 아이디가 없다면 새로 배정
    this.userInput.noti_id = this.nakama.get_noti_id();
    this.nakama.set_todo_notification(this.userInput);
    let received_json = this.received_data ? JSON.parse(this.received_data) : undefined;
    let attach_changed = false;
    { // 첨부파일의 변경사항 여부 확인
      try {
        let received = JSON.stringify(received_json.attach);
        let current = JSON.parse(JSON.stringify(this.userInput.attach));
        current.forEach((attach: any) => {
          delete attach['exist'];
          delete attach['thumbnail'];
          delete attach['base64'];
        });
        current = JSON.stringify(current);
        attach_changed = received != current;
      } catch (_e) {
        attach_changed = true;
      }
    }
    if (has_attach && attach_changed) { // 첨부된 파일이 있다면
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      if (received_json) { // 진입시 받은 정보가 있다면 수정 전 내용임
        await this.indexed.removeFileFromUserPath(`todo/${this.userInput.id}/thumbnail.png`);
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
            await this.indexed.removeFileFromUserPath(received_json.attach[i]['path']);
        }
      }
      let header_image: string; // 대표 이미지로 선정된 경로 (base64)
      // 모든 파일을 새로 등록/재등록
      for (let i = 0, j = this.userInput.attach.length; i < j; i++) {
        // 이미 존재하는 파일로 알려졌다면 저장 시도하지 않도록 구성, 또는 썸네일 재구성
        if (!this.userInput.attach[i]['exist'] || (!header_image && this.userInput.attach[i]['viewer'] == 'image')) {
          let blob = await this.indexed.loadBlobFromUserPath(this.userInput.attach[i]['path'], this.userInput.attach[i]['type']);
          this.userInput.attach[i].base64 = await this.global.GetBase64ThroughFileReader(blob);
          this.userInput.attach[i]['path'] = `todo/${this.userInput.id}/${this.userInput.attach[i]['filename']}`;
          await this.indexed.saveFileToUserPath(this.userInput.attach[i].base64, this.userInput.attach[i]['path']);
        } else delete this.userInput.attach[i]['exist'];
        if (!header_image && this.userInput.attach[i]['viewer'] == 'image')
          header_image = this.userInput.attach[i].base64;
      }
      if (header_image) // 대표 이미지가 있다면
        await new Promise((done: any) => {
          new p5((p: p5) => {
            p.setup = () => {
              p.loadImage(header_image, v => {
                let isLandscapeImage = v.width > v.height;
                if (isLandscapeImage)
                  v.resize(v.width / v.height * 128, 128);
                else v.resize(128, v.height / v.width * 128);
                let canvas = p.createCanvas(128, 128);
                canvas.hide();
                p.smooth();
                p.image(v, -(v.width - 128) / 2, -(v.height - 128) / 2);
                p.saveFrames('', 'png', 1, 1, c => {
                  this.indexed.saveFileToUserPath(c[0]['imageData'].replace(/"|=|\\/g, ''),
                    `todo/${this.userInput.id}/thumbnail.png`, (_) => {
                      done();
                    });
                  p.remove();
                });
              }, e => {
                console.error('Todo-등록된 이미지 불러오기 실패: ', e);
                done();
                p.remove();
              });
            }
          });
        });
      this.global.last_frame_name = '';
      loading.dismiss();
    } else if (!has_attach) { // 첨부된게 전혀 없다면 모든 이미지 삭제
      if (received_json) { // 진입시 받은 정보가 있다면 수정 전 내용임
        await this.indexed.removeFileFromUserPath(`todo/${this.userInput.id}/thumbnail.png`);
        for (let i = 0, j = received_json.attach.length; i < j; i++)
          await this.indexed.removeFileFromUserPath(received_json.attach[i]['path']);
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
    if (!this.isModify) { // 새로 만들 때
      if (this.userInput.remote && !this.userInput.remote.creator_id) { // 원격 생성이면서 최초 생성
        this.userInput.remote.creator_id = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id;
        this.userInput.manager = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id;
      }
    }
    if (this.userInput.remote) { // 서버에 저장한다면
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      let request = {};
      if (this.userInput.remote.channel_id) {
        request = {
          collection: 'group_todo',
          key: this.userInput.id,
          permission_read: 2,
          permission_write: 1,
          value: this.userInput,
        };
      } else {
        request = {
          collection: 'server_todo',
          key: this.userInput.id,
          permission_read: 2,
          permission_write: 1,
          value: this.userInput,
        };
      }
      try {
        this.userInput.attach.forEach(file => delete file.base64);
        await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].client.writeStorageObjects(
          this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session, [request]).then(async v => {
            await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target]
              .socket.sendMatchState(this.nakama.self_match[this.userInput.remote.isOfficial][this.userInput.remote.target].match_id, MatchOpCode.ADD_TODO,
                encodeURIComponent(`add,${v.acks[0].collection},${v.acks[0].key}`));
          });
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
                await this.nakama.sync_remove_file(received_json.attach[i]['path'],
                  this.userInput.remote.isOfficial, this.userInput.remote.target, 'todo_attach');
            }
          }
        for (let i = 0, j = this.userInput.attach.length; i < j; i++) {
          await this.nakama.sync_save_file(this.userInput.attach[i],
            this.userInput.remote.isOfficial, this.userInput.remote.target, 'todo_attach');
          delete this.userInput.attach[i].base64;
        }
        loading.dismiss();
      } catch (e) {
        console.error('해야할 일이 서버에 전송되지 않음: ', e);
        this.p5toast.show({
          text: this.lang.text['TodoDetail']['CanAddToServer'],
        });
        this.isButtonClicked = false;
        loading.dismiss();
        return;
      }
    }
    if (this.global.godot_window['add_todo'])
      this.global.godot_window['add_todo'](JSON.stringify(this.userInput));
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), `todo/${this.userInput.id}/info.todo`, (_ev) => {
      this.saveTagInfo();
      this.navCtrl.back();
    });
  }

  /** 이 해야할 일 삭제 */
  deleteData() {
    this.alertCtrl.create({
      header: this.lang.text['TodoDetail']['removeTodo'],
      message: this.lang.text['TodoDetail']['terminateTodo'],
      buttons: [{
        text: this.lang.text['TodoDetail']['remove'],
        handler: () => {
          this.deleteFromStorage();
        },
      }]
    }).then(v => v.present());
  }

  /** 저장소로부터 데이터를 삭제하는 명령 모음  
   * @param isDelete 삭제 여부를 검토하여 셀프 계정 공유에 활용
   */
  async deleteFromStorage(isDelete = true) {
    this.isButtonClicked = true;
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    if (this.userInput.remote) {
      let request = {};
      if (this.userInput.remote.channel_id) {
        request = {
          collection: 'group_todo',
          key: this.userInput.id,
        };
      } else {
        request = {
          collection: 'server_todo',
          key: this.userInput.id,
        };
      }
      try {
        if (!this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target])
          throw 'Server deleted.';
        let isOfficial = this.userInput.remote.isOfficial;
        let target = this.userInput.remote.target;
        await this.nakama.servers[isOfficial][target].client.deleteStorageObjects(
          this.nakama.servers[isOfficial][target].session, {
          object_ids: [request],
        });
        for (let i = 0, j = this.userInput.attach.length; i < j; i++)
          await this.nakama.sync_remove_file(this.userInput.attach[i].path, isOfficial, target, 'todo_attach');
        if (isDelete) await this.nakama.servers[isOfficial][target]
          .socket.sendMatchState(this.nakama.self_match[isOfficial][target].match_id, MatchOpCode.ADD_TODO,
            encodeURIComponent(`delete,${this.userInput.id}`));
      } catch (e) {
        console.error('해야할 일 삭제 요청이 서버에 전송되지 않음: ', e);
      }
    }
    this.indexed.GetFileListFromDB(`todo/${this.userInput.id}`, async (v) => {
      v.forEach(_path => this.indexed.removeFileFromUserPath(_path));
      if (this.userInput.noti_id)
        if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
          clearTimeout(this.nakama.web_noti_id[this.userInput.noti_id]);
          delete this.nakama.web_noti_id[this.userInput.noti_id];
        }
      this.noti.ClearNoti(this.userInput.noti_id);
      this.removeTagInfo();
      if (isDelete && this.global.godot_window['remove_todo'])
        this.global.godot_window['remove_todo'](JSON.stringify(this.userInput));
      loading.dismiss();
      this.navCtrl.back();
    });
  }

  async ionViewWillLeave() {
    this.indexed.GetFileListFromDB('tmp_files/', list => {
      list.forEach(path => this.indexed.removeFileFromUserPath(path));
    });
    this.noti.Current = '';
    if (this.p5timer)
      this.p5timer.remove();
    this.global.CreateGodotIFrame('todo', {
      local_url: 'assets/data/godot/todo.pck',
      title: 'Todo',
      add_todo_menu: (_data: string) => {
        this.nakama.open_add_todo_page(_data);
      }
    });
  }

  ngOnDestroy(): void {
    this.nakama.AddTodoLinkAct = undefined;
  }
}
