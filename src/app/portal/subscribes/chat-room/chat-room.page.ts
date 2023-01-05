import { Component, OnInit } from '@angular/core';
import { Channel, ChannelMessage, WriteStorageObject } from '@heroiclabs/nakama-js';
import { ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from 'src/app/local-noti.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import * as p5 from "p5";
import { ProfilePage } from '../../settings/profile/profile.page';
import { OthersProfilePage } from 'src/app/others-profile/others-profile.page';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';

interface FileInfo {
  id?: string;
  name?: string;
  type?: string;
  ext?: string;
  /** 전체 파일 크기 */
  size?: number;
  result?: string;
}

interface ExtendButtonForm {
  title: string;
  /** 버튼 숨기기 */
  isHide?: boolean;
  /** 아이콘 상대경로-이름, 크기: 64 x 64 px */
  icon?: string;
  /** 마우스 커서 스타일 */
  cursor?: string;
  act: Function;
}

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.page.html',
  styleUrls: ['./chat-room.page.scss'],
})
export class ChatRoomPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    public nakama: NakamaService,
    private noti: LocalNotiService,
    private p5toast: P5ToastService,
    private statusBar: StatusManageService,
    private indexed: IndexedDBService,
  ) { }

  /** 채널 정보 */
  info: Channel;
  isOfficial: string;
  target: string;

  messages = [];
  /** 확장 버튼 행동들 */
  extended_buttons: ExtendButtonForm[] = [{
    title: '삭제',
    act: () => {
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']];
      this.nakama.rearrange_channels();
      this.modalCtrl.dismiss();
    }
  },
  {
    title: '나가기',
    act: () => {
      if (this.info['redirect']['type'] != 3) {
        this.nakama.servers[this.isOfficial][this.target].socket.leaveChat(this.info['id']);
        this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['status'] = 'missing';
        this.nakama.rearrange_channels();
        this.extended_buttons[0].isHide = false;
        this.extended_buttons[1].isHide = true;
      } else {
        this.p5toast.show({
          text: '이 채널은 그룹에 귀속되어 있습니다.',
        });
        return;
      }
    }
  },
  {
    title: '파일 첨부',
    icon: '',
    cursor: 'copy',
    act: () => {
      document.getElementById('file_sel').click();
    }
  },
  ];

  /** 파일 첨부하기 */
  inputFileSelected(ev: any) {
    this.userInput['file'] = {};
    this.userInput.file['name'] = ev.target.files[0].name;
    this.userInput.file['ext'] = ev.target.files[0].name.split('.')[1] || ev.target.files[0].type || '검토 불가';
    this.userInput.file['size'] = ev.target.files[0].size;
    this.userInput.file['type'] = ev.target.files[0].type;
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.userInput.file['result'] = ev.target.result.replace(/"|\\|=/g, '');
      this.inputPlaceholder = `(첨부파일: ${this.userInput.file.name})`;
    }
    reader.readAsDataURL(ev.target.files[0]);
  }

  /** 옛날로 가는 커서 */
  next_cursor = '';
  /** 최근으로 가는 커서 */
  prev_cursor = '';
  content_panel: HTMLElement;

  ngOnInit() {
    this.info = this.navParams.get('info');
    this.noti.Current = this.info['cnoti_id'];
    if (this.info['cnoti_id'])
      this.noti.CancelNotificationById(this.info['cnoti_id']);
    this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
    this.isOfficial = this.info['server']['isOfficial'];
    this.target = this.info['server']['target'];
    console.log(this.info);
    // 1:1 대화라면
    if (this.info['redirect']['type'] == 2) {
      if (!this.info['redirect']) // 채널 최초 생성 오류 방지용
        this.info['status'] = this.info['info']['online'] ? 'online' : 'pending';
      else if (this.statusBar.groupServer[this.isOfficial][this.target] == 'online')
        this.info['status'] = this.nakama.load_other_user(this.info['redirect']['id'], this.isOfficial, this.target)['online'] ? 'online' : 'pending';
    }
    this.content_panel = document.getElementById('content');
    console.warn('이 자리에서 로컬 채팅 기록 불러오기');
    // 실시간 채팅을 받는 경우 행동처리
    this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'] = (c: any) => {
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.check_sender_and_show_name(c);
      this.messages.push(c);
      setTimeout(() => {
        this.content_panel.scrollIntoView({ block: 'start' });
      }, 0);
    }
    this.extended_buttons[0].isHide = this.info['status'] != 'missing';
    this.extended_buttons[1].isHide = this.info['status'] == 'missing';
    // 온라인이라면 마지막 대화 기록을 받아온다
    this.pull_msg_from_server();
    this.follow_resize();
  }

  /** 발신인 표시를 위한 메시지 추가 가공 */
  check_sender_and_show_name(c: ChannelMessage) {
    c['color'] = (c.sender_id.replace(/[^8-9a-f]/g, '') + 'abcdef').substring(0, 6);
    if (c.sender_id == this.nakama.servers[this.isOfficial][this.target].session.user_id)
      c['user_display_name'] = this.nakama.users.self['display_name'];
    else c['user_display_name'] = this.nakama.load_other_user(c.sender_id, this.isOfficial, this.target)['display_name'];
    c['user_display_name'] = c['user_display_name'] || '이름 없는 사용자';
  }

  p5canvas: p5;
  /** 창 조절에 따른 최대 화면 크기 조정 */
  follow_resize() {
    let sketch = (p: p5) => {
      let mainTable = document.getElementById('main_table');
      let mainDiv = document.getElementById('main_div');
      let inputTable = document.getElementById('input_table');
      let ext_menu = document.getElementById('ext_menu');
      p.setup = () => {
        setTimeout(() => {
          p.windowResized();
        }, 100);
        p.noLoop();
      }
      p.windowResized = () => {
        setTimeout(() => {
          mainDiv.setAttribute('style', `max-width: ${mainTable.parentElement.offsetWidth}px; max-height: ${mainTable.parentElement.clientHeight - inputTable.offsetHeight - ext_menu.offsetHeight}px`);
        }, 0);
      }
    }
    this.p5canvas = new p5(sketch);
  }

  /** 사용자 입력 */
  userInput = {
    file: undefined as FileInfo,
    text: '',
  }
  inputPlaceholder = '메시지 입력...';

  pullable = true;
  /** 서버로부터 메시지 더 받아오기
   * @param isHistory 옛날 정보 불러오기 유무, false면 최신정보 불러오기 진행
   */
  pull_msg_from_server(isHistory = true) {
    if (!this.pullable) return;
    this.pullable = false;
    if (isHistory) {
      if ((this.info['status'] == 'online' || this.info['status'] == 'pending')) // 온라인 기반 리스트 받아오기
        this.nakama.servers[this.isOfficial][this.target].client.listChannelMessages(
          this.nakama.servers[this.isOfficial][this.target].session,
          this.info['id'], 15, false, this.next_cursor).then(v => {
            console.warn('로컬 채팅id 기록과 대조하여 내용이 다르다면 계속해서 불러오기처리 필요');
            v.messages.forEach(msg => {
              msg = this.nakama.modulation_channel_message(msg, this.isOfficial, this.target);
              this.check_sender_and_show_name(msg);
              if (!this.info['last_comment']) {
                let hasFile = msg['content']['file'] ? '(첨부파일) ' : '';
                this.info['last_comment'] = hasFile + (msg['content']['msg'] || msg['content']['noti'] || '');
              }
              if (msg.content['filename']) // 파일 포함 메시지는 자동 썸네일 생성 시도
                this.indexed.loadTextFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.file`, async (e, v) => {
                  if (e && v) this.modulate_thumbnail(msg, v);
                });
              this.messages.unshift(msg);
            });
            this.next_cursor = v.next_cursor;
            this.prev_cursor = v.prev_cursor;
            this.pullable = true;
          });
      else { // 오프라인 기반 리스트 알려주기
        let tmp = [{
          content: {
            msg: '이 채널이 온라인 상태여야 합니다.',
          }
        }, {
          content: {
            msg: '오프라인 기록 열람 기능 준비중',
          }
        }];
        this.next_cursor = undefined;
        tmp.forEach(tmsg => this.messages.push(tmsg));
      }
    } else {
      console.log('현 상태보다 최근 기록 불러오기');
    }
  }

  isHidden = true;

  /** 핸드폰 가상키보드의 움직임을 고려하여 눈이 덜 불편하도록 지연 */
  open_ext_with_delay(force?: boolean) {
    this.isHidden = force || !this.isHidden;
    setTimeout(() => {
      this.p5canvas.windowResized();
      setTimeout(() => {
        this.content_panel.scrollIntoView({ block: 'start' });
      }, 0);
    }, 120);
  }

  send() {
    if (!this.userInput.text && !this.userInput['file']) return;
    let result = {};
    result['msg'] = this.userInput.text;
    let upload: string[] = [];
    if (this.userInput.file) { // 파일 첨부시
      result['filename'] = this.userInput.file.name;
      result['filesize'] = this.userInput.file.size;
      result['file_ext'] = this.userInput.file.ext;
      result['type'] = this.userInput.file.type;
      result['msg'] = result['msg'];
      const SIZE_LIMIT = 240000;
      let seek = 0;
      const RESULT_LIMIT = this.userInput.file.result.length;
      while (seek < RESULT_LIMIT) {
        let next = seek + SIZE_LIMIT;
        if (next > RESULT_LIMIT)
          next = RESULT_LIMIT;
        upload.push(this.userInput.file.result.substring(seek, next));
        seek = next;
      }
      result['partsize'] = upload.length;
    }
    this.nakama.servers[this.isOfficial][this.target].socket
      .writeChatMessage(this.info['id'], result).then(async v => {
        /** 업로드가 진행중인 메시지 개체 */
        if (upload.length) { // 첨부 파일이 포함된 경우
          // 로컬에 파일을 저장
          this.indexed.saveTextFileToUserPath(this.userInput.file.result, `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${v.message_id}.file`);
          // 서버에 파일을 업로드
          for (let i = 0, j = upload.length; i < j; i++)
            await this.nakama.servers[this.isOfficial][this.target].client.writeStorageObjects(
              this.nakama.servers[this.isOfficial][this.target].session, [{
                collection: `file_${v.channel_id.replace(/[.]/g, '_')}`,
                key: `msg_${v.message_id}_${i}`,
                permission_read: 2,
                permission_write: 1,
                value: { data: upload[i] },
              }]).then(_f => {
                console.warn('업로드 경과 게시하기: ', i + 1, '/', j);
              }).catch(e => {
                console.warn(`${i + 1}번째 파일 올리기 오류`, e);
                this.retry_upload_part({
                  collection: `file_${v.channel_id.replace(/[.]/g, '_')}`,
                  key: `msg_${v.message_id}_${i}`,
                  permission_read: 2,
                  permission_write: 1,
                  value: { data: upload[i] },
                }, i, j);
              });
        }
        delete this.userInput.file;
        this.userInput.text = '';
        this.inputPlaceholder = '메시지 입력...';
      });
  }

  /** 업로드 실패한 파트 다시 올리기 */
  retry_upload_part(info: WriteStorageObject, i: number, j: number, _try_left = 5) {
    this.nakama.servers[this.isOfficial][this.target].client.writeStorageObjects(
      this.nakama.servers[this.isOfficial][this.target].session, [info]).then(_f => {
        console.warn('재업로드 경과 게시하기: ', i + 1, '/', j);
      }).catch(e => {
        console.warn(`${i}번째 파일 다시 올리기 오류`, e, `try_left: ${_try_left}`);
        if (_try_left > 0)
          this.retry_upload_part(info, i, j, _try_left - 1);
        else {
          console.error('파일 다시 올리기 실패: ', info, i);
        }
      });
  }

  /** 메시지 정보 상세 */
  message_detail(msg: any) {
    console.warn('긴 클릭시 행동.. 메시지 상세 정보 표시: ', msg);
  }

  /** 메시지 내 파일 정보, 파일 다운받기 */
  file_detail(msg: any) {
    console.warn('짧은 클릭으로 첨부파일 다운받기: ', msg);
    this.indexed.loadTextFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.file`, async (e, v) => {
      if (e && v) {
        this.modulate_thumbnail(msg, v.replace(/"|\\|=/g, ''));
        this.open_viewer(msg);
      } else { // 가지고 있는 파일이 아닐 경우
        let result = [];
        for (let i = 0, j = msg.content['partsize']; i < j; i++)
          await this.nakama.servers[this.isOfficial][this.target].client.readStorageObjects(
            this.nakama.servers[this.isOfficial][this.target].session, {
            object_ids: [{
              collection: `file_${msg.channel_id.replace(/[.]/g, '_')}`,
              key: `msg_${msg.message_id}_${i}`,
              user_id: msg['sender_id'],
            }]
          }).then(v => {
            if (v.objects.length) {
              console.warn('다운로드 경과 게시하기: ', i + 1, '/', j);
              result[i] = v.objects[0].value['data'];
            }
          });
        let resultModified = result.join('').replace(/"|\\|=/g, '');
        if (resultModified) {
          this.indexed.saveTextFileToUserPath(resultModified, `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.file`);
          this.modulate_thumbnail(msg, resultModified);
          this.open_viewer(msg);
        } else this.p5toast.show({
          text: '이 파일은 서버에서 삭제되었습니다.',
        });
      }
    });
  }

  /** 메시지에 썸네일 콘텐츠를 생성 */
  modulate_thumbnail(msg: any, dataURL: string) {
    if (msg.content['img']) return; // 이미 썸네일이 있다면 제외
    if (msg.content['type']) {
      if (msg.content['type'].indexOf('image/') == 0) // 자동분류상 이미지라면 썸네일 이미지 생성
        new p5((p: p5) => {
          p.setup = () => {
            p.smooth();
            p.loadImage(dataURL, v => {
              const SIDE_LIMIT = 192;
              if (v.width > v.height) {
                if (v.width > SIDE_LIMIT)
                  v.resize(SIDE_LIMIT, v.height / v.width * SIDE_LIMIT);
              } else if (v.height > SIDE_LIMIT)
                v.resize(v.width / v.height * SIDE_LIMIT, SIDE_LIMIT);
              msg.content['img'] = v['canvas'].toDataURL();
              p.remove();
            }, e => {
              console.error('이미지 불러오기 실패: ', e);
              p.remove();
            });
          }
        });
    } else if (msg.content['file_ext']) { // 자동 분류가 없는 경우
      switch (msg.content['file_ext']) {
        case 'stl':
        case 'obj': // dataURL로부터 모델 받아오기 불가능
          new p5((p: p5) => {
            p.setup = () => {
              p.loadModel(dataURL, v => { // 불러오기 단계를 지원하지 않음
                p.createCanvas(160, 160, p.WEBGL);
                p.model(v);
                p.saveFrames('out', 'png', 1, 1, data => {
                  msg.content['img'] = data[0]['imageData'].replace(/"|\\|=/g, '');
                  p.remove();
                });
              }, e => {
                console.error('모델 파일 불러오기 실패: ', e);
                p.remove();
              });
            }
          });
          break;
        default:
          console.warn('썸네일 구성을 지원하지 않거나 준비중인 형식: ', msg.content['file_ext']);
          break;
      }
    }
  }

  /** 콘텐츠 상세보기 뷰어 띄우기 */
  open_viewer(msg: any) {
    console.warn('콘텐츠 뷰어 열기: ', msg);
  }

  /** 사용자 정보보기 */
  user_detail(msg: ChannelMessage) {
    if (this.nakama.servers[this.isOfficial][this.target].session.user_id == msg.sender_id) // 내 정보
      this.modalCtrl.create({
        component: ProfilePage,
      }).then(v => v.present());
    else { // 다른 사용자 정보
      this.modalCtrl.create({
        component: OthersProfilePage,
        componentProps: {
          info: { user: this.nakama.load_other_user(msg.sender_id, this.isOfficial, this.target) },
          group: this.info,
          has_admin: false,
        },
      }).then(v => v.present());
    }
  }

  ionViewWillLeave() {
    if (this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']])
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'];
    this.noti.Current = undefined;
    this.p5canvas.remove();
  }
}