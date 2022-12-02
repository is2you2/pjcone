import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import * as p5 from "p5";
import { NakamaService } from '../nakama.service';
import { P5ToastService } from '../p5-toast.service';
import { ChatRoomPage } from '../portal/subscribes/chat-room/chat-room.page';
import { StatusManageService } from "../status-manage.service";

@Component({
  selector: 'app-others-profile',
  templateUrl: './others-profile.page.html',
  styleUrls: ['./others-profile.page.scss'],
})
export class OthersProfilePage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    private nakama: NakamaService,
    public statusBar: StatusManageService,
    private p5toast: P5ToastService,
  ) { }

  info = {};
  group_info = {};
  /** 추가 생성 버튼 (알림 검토의 결과물) */
  additional_buttons = {};
  /** 사용자 이미지 */
  tmp_img: any;
  /** 그룹 관리자여부에 따라 그룹 관리 버튼 추가 */
  has_admin = false;
  /** 1:1 대화 버튼 생성여부 */
  CanCreateChat = true;

  lerpVal: number;
  p5canvas: p5;
  ngOnInit() {
    this.info = this.navParams.get('info');
    this.has_admin = this.navParams.get('has_admin');
    this.catch_user_noties();
    let sketch = (p: p5) => {
      let img = document.getElementById('profile_img');
      let tmp_img = document.getElementById('profile_tmp_img');
      const LERP_SIZE = .025;
      p.draw = () => {
        if (this.info['status'] == 'online' || this.info['status'] == 'certified') {
          if (this.lerpVal < 1) {
            this.lerpVal += LERP_SIZE;
          } else {
            this.lerpVal = 1;
            p.noLoop();
          }
        } else {
          if (this.lerpVal > 0) {
            this.lerpVal -= LERP_SIZE;
          } else {
            this.lerpVal = 0;
            p.noLoop();
          }
        }
        img.setAttribute('style', `filter: grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)});`);
        tmp_img.setAttribute('style', `filter: grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)});`);
      }
    }
    this.p5canvas = new p5(sketch);
  }

  isOfficial: string;
  target: string;
  /** 이 사용자와 관련된 알림 검토 (그룹 리액션 검토용) */
  catch_user_noties() {
    this.group_info = this.navParams.get('group');
    this.isOfficial = this.group_info['server']['isOfficial'];
    this.target = this.group_info['server']['target'];
    let hasNotifications = true;
    hasNotifications = hasNotifications && this.nakama.noti_origin[this.isOfficial] && this.nakama.noti_origin[this.isOfficial][this.target];
    if (hasNotifications) {
      let noti_ids = Object.keys(this.nakama.noti_origin[this.isOfficial][this.target]);
      noti_ids.forEach(noti_id => {
        if (this.nakama.noti_origin[this.isOfficial][this.target][noti_id]['sender_id'] == this.info['user']['id'])
          this.additional_buttons[this.nakama.noti_origin[this.isOfficial][this.target][noti_id]['code'].toString()] = noti_id;
      });
    }
  }

  /** 부드러운 이미지 변환 */
  change_img_smoothly(_url: string) {
    this.tmp_img = _url;
    new p5((p: p5) => {
      let profile_tmp_img = document.getElementById('profile_tmp_img');
      let file_sel = document.getElementById('file_sel');
      const LERP_SIZE = .035;
      let lerpVal = 0;
      p.setup = () => {
        file_sel['value'] = '';
        profile_tmp_img.setAttribute('style', `filter: grayscale(${this.info['state'] ? 0 : .9}) contrast(${this.info['state'] ? 1 : 1.4}) opacity(${lerpVal})`);
      }
      p.draw = () => {
        if (lerpVal < 1) {
          lerpVal += LERP_SIZE;
        } else {
          lerpVal = 1;
          this.info['img'] = this.tmp_img;
          this.tmp_img = '';
          p.remove();
        }
        profile_tmp_img.setAttribute('style', `filter: grayscale(${this.info['state'] ? 0 : .9}) contrast(${this.info['state'] ? 1 : 1.4}) opacity(${lerpVal})`);
      }
    });
  }

  onDismissData = {};
  /** 알림에 의해 생성된 버튼들의 반응 */
  notification_react(code: number) {
    console.log('알림에 따른 행동: ', code);
    switch (code) {
      case 0: // 예약된 메시지
        break;
      case -1: // 오프라인이거나 채널에 없을 때 알림 받음
        // 모든 채팅에 대한건지, 1:1에 한정인지 검토 필요
        break;
      case -2: // 친구 요청 받음
        break;
      case -5: // 그룹 참가 요청 받음
        this.nakama.servers[this.isOfficial][this.target].client.addGroupUsers(
          this.nakama.servers[this.isOfficial][this.target].session,
          this.group_info['id'], [this.info['user']['id']]
        ).then(v => {
          if (!v) console.warn('밴 유저에 대한것 같음, 확인 필요');
          this.p5toast.show({
            text: `그룹원이 추가되었습니다: ${this.info['user']['display_name'] || '이름 없는 사용자'}`,
          });
          this.nakama.servers[this.isOfficial][this.target].client.deleteNotifications(
            this.nakama.servers[this.isOfficial][this.target].session,
            [this.additional_buttons[code.toString()]]
          ).then(v => {
            if (!v) console.warn('알림 부정 검토 필요');
            delete this.additional_buttons[code.toString()];
            this.nakama.update_notifications(this.isOfficial, this.target);
            this.onDismissData = {
              id: this.info['user']['id'],
              act: 'accept_join',
            };
            this.info['status'] = 'online';
            this.p5canvas.loop();
          });
        });
        break;
      default:
        console.warn('예상하지 못한 알림 반응: ', code);
        break;
    }
  }

  /** 1:1 대화 생성하기 */
  create_chat() {
    this.nakama.servers[this.isOfficial][this.target].socket.joinChat(
      this.info['user']['id'], 2, true, false
    ).then(c => {
      c['redirect'] = {
        id: this.info['user']['id'],
        type: 2,
        persistence: true,
      };
      // 방 이미지를 상대방 이미지로 설정
      this.nakama.load_other_user_profile_image(this.info['user']['id'], this.isOfficial, this.target)
        .then(v => {
          c['img'] = v;
        });
      // 방 이름을 상대방 이름으로 설정
      this.nakama.load_other_user_profile_info(this.info['user']['id'], this.isOfficial, this.target)
        .then(v => {
          c['title'] = v['display_name'];
        });
      this.nakama.add_channels(c, this.isOfficial, this.target);
      this.modalCtrl.create({
        component: ChatRoomPage,
        componentProps: {
          info: c,
        },
      }).then(v => v.present());
    });
  }

  /** 그룹장이 이 사용자를 퇴출 */
  kick_user_from_group() {
    this.nakama.servers[this.isOfficial][this.target].socket.writeChatMessage(
      this.group_info['id'], {
      msg: `사용자 퇴출: ${this.info['id']}-테스트 로그`,
    }).then(_m => {
      this.nakama.servers[this.isOfficial][this.target].client.kickGroupUsers(
        this.nakama.servers[this.isOfficial][this.target].session,
        this.group_info['id'], [this.info['user']['id']]
      ).then(_v => {
        this.p5toast.show({
          text: `사용자를 내보냈습니다: ${this.info['user']['display_name'] || '이름 없는 사용자'}`,
        });
        this.modalCtrl.dismiss({
          id: this.info['user']['id'],
          act: 'kick',
        });
      });
    });
  }

  ionViewDidLeave() {
    this.p5canvas.remove();
  }
}
