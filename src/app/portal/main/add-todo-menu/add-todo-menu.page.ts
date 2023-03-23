// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import * as p5 from "p5";
import { P5ToastService } from 'src/app/p5-toast.service';
import { IonicViewerPage } from '../../subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { DomSanitizer } from '@angular/platform-browser';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService } from 'src/app/nakama.service';
import { LocalNotiService } from 'src/app/local-noti.service';
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { StatusManageService } from 'src/app/status-manage.service';

interface LogForm {
  /** 이 로그를 발생시킨 사람, 리모트인 경우에만 넣기, 로컬일 경우 비워두기 */
  creator?: string;
  /** 로그 생성 시점 */
  createTime?: number;
  /** 번역코드 */
  translateCode?: string;
  /** 사용자에게 보여지는 문자열 */
  displayText?: string;
}

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
export class AddTodoMenuPage implements OnInit {
  @ViewChild('Calendar') Calendar: any;

  constructor(
    private navParams: NavParams,
    public modalCtrl: ModalController,
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
    private sanitizer: DomSanitizer,
    private indexed: IndexedDBService,
    private nakama: NakamaService,
    private alertCtrl: AlertController,
    private noti: LocalNotiService,
    private global: GlobalActService,
    private statusBar: StatusManageService,
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
    /** 기한 */
    limit: undefined,
    /** 필터용 태그 */
    tags: [],
    /** 일의 중요도, 가시화 기한의 색상에 영향을 줌 */
    importance: '0',
    /** 이 업무가 연동되어 행해진 기록들 */
    logs: [] as LogForm[],
    /** 상세 내용 */
    description: undefined,
    /** 서버에 저장된 경우 필요한 정보를 기입 */
    remote: undefined as RemoteInfo,
    /** 제작자 표시명 */
    display_creator: undefined,
    /** 첨부 이미지 정보 */
    attach: {},
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

  /** 사용자에게 보여지는 기한 문자열, 저장시 삭제됨 */
  limitDisplay: string;
  ImageURL: any;
  ngOnInit() {
    this.nakama.removeBanner();
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
    let groups: RemoteInfo[] = [];
    let isOfficial = Object.keys(this.nakama.servers);
    isOfficial.forEach(_is_official => {
      let Target = Object.keys(this.nakama.servers[_is_official]);
      Target.forEach(_target => { // 온라인 그룹만 수집
        if (this.statusBar.groupServer[_is_official][_target] == 'online') {
          let serverInfo: RemoteInfo = {
            name: `${this.nakama.servers[_is_official][_target].info.name} (${this.lang.text['TodoDetail']['Server']})`,
            isOfficial: _is_official,
            target: _target,
            type: `${_is_official}/${_target}`,
          }
          servers.push(serverInfo);
          let GroupId = Object.keys(this.nakama.groups[_is_official][_target]);
          GroupId.forEach(_gid => {
            let groupInfo: RemoteInfo = {
              name: `${this.nakama.groups[_is_official][_target][_gid]['name']} (${this.lang.text['TodoDetail']['Group']})`,
              isOfficial: _is_official,
              target: _target,
              group_id: _gid,
              channel_id: this.nakama.groups[_is_official][_target][_gid]['channel_id'],
              type: `${_is_official}/${_target}/${_gid}`,
            };
            groups.push(groupInfo);
          });
        }
      });
    });
    let merge = [...servers, ...groups];
    merge.forEach(info => {
      this.AvailableStorageList.push(info);
    });
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
  isModifiable = true;
  received_data: string;
  ionViewWillEnter() {
    // 미리 지정된 데이터 정보가 있는지 검토
    this.received_data = this.navParams.get('data');
    if (this.received_data) { // 이미 있는 데이터 조회
      this.buttonDisplay.saveTodo = this.lang.text['TodoDetail']['buttonDisplay_modify'];
      this.isModify = true;
    } else { // 새로 만드는 경우
      let tomorrow = new Date(new Date().getTime() + 86400000);
      this.userInput.limit = tomorrow.getTime();
    }
    if (this.received_data)
      this.userInput = { ...this.userInput, ...JSON.parse(this.received_data) };
    // 첨부 이미지가 있음
    if (this.userInput.attach['type'])
      this.indexed.loadBlobFromUserPath(`todo/${this.userInput.id}/${this.userInput.attach['filename']}`, this.userInput.attach['type'], (b) => {
        if (this.ImageURL)
          URL.revokeObjectURL(this.ImageURL);
        this.ImageURL = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(b));
      });
    // 저장소 표기 적용
    if (this.userInput.storeAt == 'local') {
      this.StoreAt.value = this.userInput.storeAt;
      this.userInput.display_store = this.lang.text['TodoDetail']['OnThisDevice'];
      this.userInput.display_creator = this.lang.text['TodoDetail']['WrittenByMe'];
      this.userInput.display_manager = this.lang.text['TodoDetail']['WrittenByMe'];
    } else if (this.userInput.remote) {
      this.userInput.remote.name = `${this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].info.name} (${this.lang.text['TodoDetail']['Server']})`;
      this.StoreAt.value = this.userInput.remote;
      this.StoreAt.placeholder = this.userInput.remote.name;
      this.userInput.display_store = this.userInput.remote.name;
      this.AmICreator =
        this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id == this.userInput.remote.creator_id;
      this.userInput.display_creator = this.AmICreator ? this.lang.text['TodoDetail']['WrittenByMe'] : this.nakama.load_other_user(this.userInput.remote.creator_id, this.userInput.remote.isOfficial, this.userInput.remote.target)['display_name'];
      let AmIManager = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id == this.userInput.manager;
      this.userInput.display_manager = AmIManager ? this.nakama.users.self['display_name'] : this.nakama.load_other_user(this.userInput.manager, this.userInput.remote.isOfficial, this.userInput.remote.target)['display_name'];
      if (this.userInput.remote.group_id) {
        this.isModifiable = this.nakama.groups[this.userInput.remote.isOfficial][this.userInput.remote.target][this.userInput.remote.group_id]['status'] == 'online';
      } else this.isModifiable = this.statusBar.groupServer[this.userInput.remote.isOfficial][this.userInput.remote.target] == 'online';
    }
    // 로그 정보 게시
    if (this.userInput.logs.length) {
      this.userInput.logs.forEach(_log => _log.displayText = this.lang.text['TodoDetail'][_log.translateCode] || _log.translateCode);
    }
    this.noti.Current = this.userInput.id;
    let date_limit = new Date(this.userInput.limit);
    this.Calendar.value = new Date(date_limit.getTime() - date_limit.getTimezoneOffset() * 60 * 1000).toISOString();
    this.limitDisplay = date_limit.toLocaleString(this.lang.lang);
    this.limitDisplay = this.limitDisplay.substring(0, this.limitDisplay.lastIndexOf(':'));
    this.isLimitChangable = true;
    this.follow_resize();
  }

  ionViewDidEnter() {
    this.show_count_timer();
  }

  isCalendarHidden = true;
  /** 달력 켜기끄기 */
  toggle_calendar() {
    this.p5resize.windowResized();
    this.isCalendarHidden = !this.isCalendarHidden;
  }

  isLogsHidden = true;
  /** 기록 리스트 켜고 끄기 */
  toggle_logs() {
    this.isLogsHidden = !this.isLogsHidden;
    if (!this.isLogsHidden) {
      let bottom_logs = document.getElementById('content');
      setTimeout(() => {
        bottom_logs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
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

  p5resize: p5;
  /** 창 조절에 따른 최대 화면 크기 조정 */
  follow_resize() {
    setTimeout(() => {
      let sketch = (p: p5) => {
        let mainTable = document.getElementById('main_table');
        let mainDiv = document.getElementById('main_div');
        let buttons_table = document.getElementById('bottom_buttons');
        p.setup = () => {
          setTimeout(() => {
            p.windowResized();
          }, 100);
          p.noLoop();
        }
        p.windowResized = () => {
          setTimeout(() => {
            mainDiv.setAttribute('style', `max-width: ${mainTable.parentElement.offsetWidth}px; max-height: ${mainTable.parentElement.clientHeight - buttons_table.offsetHeight}px`);
          }, 0);
        }
      }
      this.p5resize = new p5(sketch);
    }, 50);
  }

  /** 이름이 없으면 지울 이미지 없음, 이름이 있으면 존재하던 파일을 삭제함 */
  isImageRemoved = '';
  /** 첨부파일 삭제 */
  remove_attach() {
    this.indexed.removeFileFromUserPath('todo/add_tmp.attach');
    this.isImageRemoved = this.userInput.attach['filename'];
    delete this.userInput.attach;
    URL.revokeObjectURL(this.ImageURL);
    this.ImageURL = undefined;
    this.userInput.attach = {};
  }

  p5timer: p5;
  limitTimeP5Display: number;
  /** 평소 기한 가시화 색상 */
  normal_color = '#888b';
  alert_color = '#0bbb';
  AlertLerpStartFrom = .8;
  show_count_timer() {
    this.p5timer = new p5((p: p5) => {
      let startAnimLerp = 0;
      let startTime = new Date(this.userInput.written).getTime();
      this.limitTimeP5Display = new Date(this.userInput.limit).getTime();
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
        else lerpVal = p.map(currentTime, startTime, this.limitTimeP5Display, 0, 1, true);
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

  /** 참조 이미지 첨부 */
  select_attach_image() {
    document.getElementById('file_sel').click();
  }
  AvailableStorageList: RemoteInfo[] = [];
  @ViewChild('StoreAt') StoreAt: any;
  StoreAtSelClicked() {
    this.StoreAt.open();
  }
  /** 중요도 변경됨 */
  StoreAtSelChanged(ev: any) {
    let value: RemoteInfo = ev.detail.value;
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

  /** 파일 선택시 로컬에서 반영 */
  inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    this.userInput.attach['filename'] = ev.target.files[0]['name'];
    this.userInput.attach['file_ext'] = ev.target.files[0]['name'].substring(ev.target.files[0]['name'].lastIndexOf('.'));
    this.userInput.attach['filesize'] = ev.target.files[0]['size'];
    this.userInput.attach['type'] = ev.target.files[0]['type'];
    this.userInput.attach['viewer'] = 'image';
    reader.onload = (ev: any) => {
      this.userInput.attach['img'] = ev.target.result.replace(/"|\\|=/g, '');
      this.indexed.saveFileToUserPath(this.userInput.attach['img'], 'todo/add_tmp.attach');
    };
    if (this.ImageURL)
      URL.revokeObjectURL(this.ImageURL);
    this.ImageURL = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(ev.target.files[0]));
    reader.readAsDataURL(ev.target.files[0]);
  }

  /** 이미지를 뷰어에서 보기 */
  go_to_ionic_viewer() {
    this.modalCtrl.create({
      component: IonicViewerPage,
      componentProps: {
        info: this.userInput.attach,
        path: this.userInput.attach['img'] ? 'todo/add_tmp.attach' : `todo/${this.userInput.id}/${this.userInput.attach['filename']}`,
      }
    }).then(v => v.present());
  }

  /** 이 일을 완료했습니다 */
  doneTodo() {
    this.userInput.done = true;
    // done.todo 를 생성한 후 기록을 남기는 방식
    // if (this.userInput.noti_id)
    //   if (isPlatform == 'DesktopPWA') {
    //     clearTimeout(this.nakama.web_noti_id[this.userInput.noti_id]);
    //     delete this.nakama.web_noti_id[this.userInput.noti_id];
    //   }
    // this.noti.ClearNoti(this.userInput.noti_id);
    // if (this.userInput.importance != '0')
    //   this.indexed.saveTextFileToUserPath('', `todo/${this.userInput.id}/done.todo`, () => {
    //     this.saveData();
    //   });
    // else { // 메모는 이펙트만 생성하고 삭제
    this.navParams.get('godot')['add_todo'](JSON.stringify(this.userInput));
    this.deleteFromStorage();
    // }
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
    let copy_img = this.userInput.attach['img'];
    delete this.userInput.attach['img'];
    delete this.userInput.display_store;
    delete this.userInput.display_manager;
    delete this.userInput.display_creator;
    this.userInput.logs.forEach(log => {
      delete log.displayText;
    });
    // 새 태그구성이 완료된 경우
    let trim_tag = this.InputNewTag.trim();
    if (trim_tag) {
      if (!this.userInput.tags.includes(trim_tag))
        this.userInput.tags.push(trim_tag);
    }
    // 들어올 때와 같은지 검토
    let exactly_same = JSON.stringify(this.userInput) == this.received_data;
    if (exactly_same) {
      this.modalCtrl.dismiss();
      return;
    } // ^ 같으면 저장 동작을 하지 않음
    if (!this.userInput.create_at) // 생성 날짜 기록
      this.userInput.create_at = new Date().getTime();
    if (!this.userInput.id) { // 할 일 구분자 생성 (내 기록은 날짜시간, 서버는 서버-시간 (isOfficial/target/DateTime),
      //그룹채널 기록은 채널-메시지: isOfficial/target/channel_id/msg_id)
      if (!this.userInput.remote) // local
        this.userInput.id = new Date(this.userInput.create_at).toISOString().replace(/[:|.]/g, '_');
      else if (!this.userInput.remote.channel_id) // server
        this.userInput.id = `${this.userInput.remote.isOfficial}_${this.userInput.remote.target}_${new Date(this.userInput.create_at).toISOString().replace(/[:|.]/g, '_')}`;
      else {// group
        this.userInput.id = `${this.userInput.remote.isOfficial}_${this.userInput.remote.target}_${this.userInput.remote.channel_id}_${this.userInput.remote.message_id}`;
      }
    }
    if (this.userInput.noti_id) {  // 알림 아이디가 있다면 삭제 후 재배정
      if (isPlatform == 'DesktopPWA') {
        clearTimeout(this.nakama.web_noti_id[this.userInput.noti_id]);
        delete this.nakama.web_noti_id[this.userInput.noti_id];
      }
      this.noti.ClearNoti(this.userInput.noti_id);
    } // 알림 아이디가 없다면 새로 배정
    this.userInput.noti_id = this.nakama.get_noti_id();
    // 알림 예약 생성
    if (isPlatform == 'DesktopPWA') { // 웹은 예약 발송이 없으므로 지금부터 수를 세야함
      let schedule = setTimeout(() => {
        this.noti.PushLocal({
          id: this.userInput.noti_id,
          title: this.userInput.title,
          body: this.userInput.description,
        }, undefined, (_ev) => {
          this.modalCtrl.create({
            component: AddTodoMenuPage,
            componentProps: {
              godot: this.global.godot.contentWindow || this.global.godot.contentDocument,
              data: JSON.stringify(this.userInput),
            },
          }).then(v => v.present());
        });
      }, new Date(this.userInput.limit).getTime() - new Date().getTime());
      this.nakama.web_noti_id[this.userInput.noti_id] = schedule;
    } else if (isPlatform != 'MobilePWA') { // 모바일은 예약 발송을 설정
      let color = '00bbbb'; // 메모
      switch (this.userInput.importance) {
        case '1': // 기억해야 함
          color = 'dddd0c';
          break;
        case '2': // 중요함
          color = '880000';
          break;
      }
      this.noti.PushLocal({
        id: this.userInput.noti_id,
        title: this.userInput.title,
        body: this.userInput.description,
        smallIcon_ln: 'todo',
        iconColor_ln: color,
        group_ln: 'todo',
        triggerWhen_ln: {
          at: new Date(this.userInput.limit),
        },
        extra_ln: {
          page: {
            component: 'AddTodoMenuPage',
            componentProps: {
              data: JSON.stringify(this.userInput),
            },
          },
        },
      });
    }
    let received_json = this.received_data ? JSON.parse(this.received_data) : undefined;
    if (copy_img) {
      if (received_json)
        this.indexed.removeFileFromUserPath(`todo/${this.userInput.id}/${received_json.attach['filename']}`);
      this.indexed.saveFileToUserPath(copy_img, `todo/${this.userInput.id}/${this.userInput.attach['filename']}`);
      new p5((p: p5) => {
        p.setup = () => {
          p.loadImage(copy_img, v => {
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
                `todo/${this.userInput.id}/thumbnail.png`);
              p.remove();
            });
          }, e => {
            console.error('Todo-등록된 이미지 불러오기 실패: ', e);
            p.remove();
          });
        }
      });
    }
    this.userInput.written = new Date().getTime();
    this.userInput.limit = new Date(this.userInput.limit).getTime();
    this.userInput.logs.push({
      creator: this.userInput.remote ?
        this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id
        : '',
      createTime: new Date().getTime(),
      translateCode: this.isModify ? 'ModifyTodo' : 'CreateTodo',
    });
    if (this.isModify) {
      if (this.isImageRemoved) { // 이미지가 삭제된 경우, 파일 삭제
        this.indexed.removeFileFromUserPath(`todo/${this.userInput.id}/${this.isImageRemoved}`);
        this.indexed.removeFileFromUserPath(`todo/${this.userInput.id}/thumbnail.png`);
      }
    } else { // 새로 만들기
      if (this.userInput.remote && !this.userInput.remote.creator_id) { // 원격 생성이면서 최초 생성
        this.userInput.remote.creator_id = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id;
        this.userInput.manager = this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id;
      }
    }
    this.isLogsHidden = true;
    this.navParams.get('godot')['add_todo'](JSON.stringify(this.userInput));
    if (this.userInput.remote) {
      let request = {};
      if (this.userInput.remote.channel_id) {
        request = {
          collection: 'group_todo',
          key: this.userInput.id,
          permission_read: 2,
          permission_write: 2,
          value: this.userInput,
        };
      } else {
        request = {
          collection: 'server_todo',
          key: this.userInput.id,
          permission_read: 1,
          permission_write: 1,
          value: this.userInput,
        };
      }
      try {
        await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].client.writeStorageObjects(
          this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session, [request]);
      } catch (e) {
        console.error('해야할 일이 서버에 전송되지 않음: ', e);
        this.modalCtrl.dismiss();
        return;
      }
    }
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), `todo/${this.userInput.id}/info.todo`, (_ev) => {
      this.saveTagInfo();
      this.modalCtrl.dismiss();
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

  /** 저장소로부터 데이터를 삭제하는 명령 모음 */
  async deleteFromStorage() {
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
        await this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].client.deleteStorageObjects(
          this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session, {
          object_ids: [request],
        });
      } catch (e) {
        console.error('해야할 일 삭제 요청이 서버에 전송되지 않음: ', e);
      }
    }
    this.indexed.GetFileListFromDB(`todo/${this.userInput.id}`, (v) => {
      v.forEach(_path => this.indexed.removeFileFromUserPath(_path));
      if (this.userInput.noti_id)
        if (isPlatform == 'DesktopPWA') {
          clearTimeout(this.nakama.web_noti_id[this.userInput.noti_id]);
          delete this.nakama.web_noti_id[this.userInput.noti_id];
        }
      this.noti.ClearNoti(this.userInput.noti_id);
      this.navParams.get('godot')['remove_todo'](JSON.stringify(this.userInput));
      this.removeTagInfo();
      this.modalCtrl.dismiss();
    });
  }

  ionViewWillLeave() {
    this.indexed.removeFileFromUserPath('todo/add_tmp.attach');
    if (this.ImageURL)
      URL.revokeObjectURL(this.ImageURL);
    this.noti.Current = '';
    this.p5resize.remove();
    this.p5timer.remove();
  }
}
