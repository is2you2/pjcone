import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import * as p5 from "p5";
import { LanguageSettingService } from '../language-setting.service';
import { NakamaService } from '../nakama.service';
import { P5ToastService } from '../p5-toast.service';
import { StatusManageService } from "../status-manage.service";
import { GlobalActService } from '../global-act.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-others-profile',
  templateUrl: './others-profile.page.html',
  styleUrls: ['./others-profile.page.scss'],
})
export class OthersProfilePage implements OnInit, OnDestroy {

  constructor(
    private nakama: NakamaService,
    public statusBar: StatusManageService,
    private p5toast: P5ToastService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private route: ActivatedRoute,
    private router: Router,
    private navCtrl: NavController,
  ) { }

  /** 다른 사용자의 정보 */
  info = {};
  group_info = {};
  /** 추가 생성 버튼 (알림 검토의 결과물) */
  additional_buttons = {};
  /** 사용자 이미지 */
  tmp_img: any;
  /** 그룹 관리자여부에 따라 그룹 관리 버튼 추가 */
  has_admin = false;
  /** 1:1 대화 버튼 생성여부 */

  lerpVal: number;
  p5canvas: p5;

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    try {
      window.history.replaceState(null, null, window.location.href);
      if (window.onpopstate) window.onpopstate = null;
      window.onpopstate = () => {
        if (this.BackButtonPressed) return;
        this.BackButtonPressed = true;
        window.onpopstate = null;
        this.navCtrl.pop();
      };
    } catch (e) {
      console.log('탐색 기록 변경시 오류 발생: ', e);
    }
  }
  async ngOnInit() {
    this.route.queryParams.subscribe(_p => {
      try {
        const navParams = this.router.getCurrentNavigation().extras.state;
        this.InitBrowserBackButtonOverride();
        this.info = navParams.info;
        this.has_admin = navParams.has_admin;
        this.group_info = navParams.group;
        this.isOfficial = this.group_info['server']['isOfficial'];
        this.target = this.group_info['server']['target'];
        this.nakama.load_other_user(this.info['user']['id'], this.isOfficial, this.target);
        this.nakama.socket_reactive['others-profile'] = (img_url: string) => {
          this.p5canvas['ChangeImageSmooth'](img_url);
        };
        this.nakama.socket_reactive['others-online'] = () => {
          this.p5canvas.loop();
        };
        this.catch_user_noties();
      } catch (e) {
        console.log('다른 사람의 프로필 열기 실패: ', e);
      }
    });
  }

  isClickDisplayNameEdit = false;
  OtherCanvasDiv: any;
  ionViewWillEnter() {
    this.OtherCanvasDiv = document.getElementById('OtherUserCanvasDiv');
    this.p5canvas = new p5((p: p5) => {
      const LERP_SIZE = .025;
      let nameDiv: p5.Element;
      let nameEditDiv: p5.Element;
      let selected_image: p5.Element;
      /** 변경 전 이미지 */
      let trashed_image: p5.Element;
      let FadeOutTrashedLerp = 1;
      /** 사용자 색상 표시 */
      let UserColorGradient: p5.Element;
      let user_rgb_color = '0, 0, 0';
      let userColorLerp = 0;
      let imgDiv: p5.Element;
      p.setup = () => {
        let user_color = p.color(`#${(this.info['user']['id'].replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6)}`);
        user_rgb_color = `${p.red(user_color)}, ${p.green(user_color)}, ${p.blue(user_color)}`;
        UserColorGradient = p.createDiv();
        UserColorGradient.style('width', '100%');
        UserColorGradient.style('height', '100%');
        UserColorGradient.style('background-image', `linear-gradient(to top, rgba(${user_rgb_color}, 0), rgba(${user_rgb_color}, 0))`);
        UserColorGradient.parent(this.OtherCanvasDiv);
        p.noCanvas();
        p.pixelDensity(1);
        imgDiv = p.createDiv();
        const IMAGE_SIZE = '156px';
        // 사용자 이미지
        imgDiv.style('width', IMAGE_SIZE);
        imgDiv.style('height', IMAGE_SIZE);
        imgDiv.style('position', 'absolute');
        imgDiv.style('top', '120px');
        imgDiv.style('left', '50%');
        imgDiv.style('transform', 'translateX(-50%)');
        imgDiv.style('border-radius', IMAGE_SIZE);
        imgDiv.style('background-image', 'url(assets/data/avatar.svg)');
        imgDiv.style('background-position', 'center');
        imgDiv.style('background-repeat', 'no-repeat');
        imgDiv.style('background-size', 'cover');
        imgDiv.parent(this.OtherCanvasDiv);
        // 온라인 표시등
        let OnlineLamp = p.createDiv();
        const LAMP_SIZE = '36px';
        OnlineLamp.style('background-color', this.info['user']['online'] ? this.statusBar.colors['online'] : this.statusBar.colors['offline']);
        OnlineLamp.style('width', LAMP_SIZE);
        OnlineLamp.style('height', LAMP_SIZE);
        OnlineLamp.style('position', 'absolute');
        OnlineLamp.style('top', '128px');
        OnlineLamp.style('left', `${this.OtherCanvasDiv.clientWidth / 2 + 38}px`);
        OnlineLamp.style('border-radius', LAMP_SIZE);
        OnlineLamp.parent(this.OtherCanvasDiv);
        p['OnlineLamp'] = OnlineLamp;
        // 부드러운 이미지 전환
        selected_image = p.createImg(this.info['user'].img, 'profile_img');
        selected_image.style('width', IMAGE_SIZE);
        selected_image.style('height', IMAGE_SIZE);
        selected_image.style('border-radius', IMAGE_SIZE);
        selected_image.style('position', 'absolute');
        selected_image.style('object-fit', 'cover');
        if (!this.info['user'].img)
          selected_image.hide();
        selected_image.parent(imgDiv);
        trashed_image = p.createImg(undefined, 'before_img');
        trashed_image.style('width', IMAGE_SIZE);
        trashed_image.style('height', IMAGE_SIZE);
        trashed_image.style('border-radius', IMAGE_SIZE);
        trashed_image.style('position', 'absolute');
        trashed_image.style('object-fit', 'cover');
        trashed_image.hide();
        trashed_image.parent(imgDiv);
        p['ChangeImageSmooth'] = (url: string) => {
          imgDiv.style('background-image', 'url(assets/data/avatar.svg)');
          if (!url) {
            trashed_image.elt.src = selected_image.elt.src;
            trashed_image.show();
          } else {
            trashed_image.elt.src = undefined;
            trashed_image.hide();
          }
          selected_image.elt.src = url;
          FadeOutTrashedLerp = 1;
          p.loop();
          this.info['user'].img = url;
          if (url) {
            selected_image.show();
          } else selected_image.hide();
        }
        const NAME_SIZE = '36px';
        // 사용자 정보 모음 div (밀림 구성 방지용)
        let ExceptPic = p.createDiv();
        ExceptPic.style('width', '100%');
        ExceptPic.style('position', 'absolute');
        ExceptPic.style('top', '330px');
        ExceptPic.style('display', 'flex');
        ExceptPic.style('flex-direction', 'column');
        ExceptPic.parent(this.OtherCanvasDiv);
        // 사용자 이름 (display)
        let override = this.nakama.GetOverrideName(this.info['user']['id'], this.isOfficial, this.target);
        nameDiv = p.createDiv(override || this.info['user']['display_name'] || this.lang.text['Profile']['noname_user']);
        nameDiv.style('font-size', NAME_SIZE);
        nameDiv.style('font-weight', 'bold');
        nameDiv.style('align-self', 'center');
        nameDiv.style('width', '80%');
        nameDiv.style('text-align', 'center');
        nameDiv.elt.onclick = () => { // 편집 모드로 변경
          nameEditDiv.value('');
          nameEditDiv.attribute('placeholder', this.info['user']['display_name'] || this.lang.text['Profile']['noname_user']);
          nameEditDiv.show();
          nameDiv.hide();
          nameEditDiv.elt.focus();
          this.isClickDisplayNameEdit = true;
        }
        nameDiv.parent(ExceptPic);
        // 사용자 이름 (input)
        nameEditDiv = p.createInput();
        nameEditDiv.style('font-size', NAME_SIZE);
        nameEditDiv.style('font-weight', 'bold');
        nameEditDiv.style('align-self', 'center');
        nameEditDiv.style('width', '80%');
        nameEditDiv.style('text-align', 'center');
        nameEditDiv.attribute('placeholder', this.lang.text['Profile']['name_placeholder'])
        nameDiv.style('text-align', 'center');
        nameEditDiv.parent(ExceptPic);
        nameEditDiv.hide();
        nameEditDiv.elt.addEventListener('focusout', () => {
          let input_value = `${nameEditDiv.value()}`;
          this.nakama.SaveOverrideName(this.info['user']['id'], input_value, this.isOfficial, this.target);
          if (input_value) originalName.removeAttribute('hidden');
          else originalName.attribute('hidden', 'true');
          nameDiv.html(`${input_value || this.info['user']['display_name'] || this.lang.text['Profile']['noname_user']}`);
          nameEditDiv.hide();
          nameDiv.show();
        });
        // 사용자 이름 원본 표기
        let originalName = p.createDiv(this.info['user']['display_name']);
        originalName.style('color', 'var(--ion-color-medium)');
        originalName.style('align-self', 'center');
        originalName.style('margin-top', '36px');
        originalName.style('width', '80%');
        originalName.style('text-align', 'center');
        if (!override) originalName.attribute('hidden', 'true');
        originalName.parent(ExceptPic);
        // 사용자 UID
        let uuidDiv = p.createDiv(this.info['user']['id']);
        uuidDiv.style('color', 'var(--ion-color-medium)');
        uuidDiv.style('align-self', 'center');
        uuidDiv.style('margin-top', '36px');
        uuidDiv.style('width', '80%');
        uuidDiv.style('text-align', 'center');
        uuidDiv.style('cursor', 'copy');
        uuidDiv.parent(ExceptPic);
        uuidDiv.elt.onclick = () => {
          this.copy_id();
        }
        setTimeout(() => {
          p.windowResized();
        }, 0);
      }
      p.draw = () => {
        if (FadeOutTrashedLerp > 0) {
          FadeOutTrashedLerp -= LERP_SIZE;
          trashed_image.style('opacity', `${FadeOutTrashedLerp}`);
          selected_image.style('opacity', `${1 - FadeOutTrashedLerp}`);
        }
        if (this.info['user']['online']) {
          if (this.lerpVal < 1) {
            this.lerpVal += LERP_SIZE;
          } else {
            this.lerpVal = 1;
          }
        } else {
          if (this.lerpVal > 0) {
            this.lerpVal -= LERP_SIZE;
          } else {
            this.lerpVal = 0;
          }
        }
        if (userColorLerp < 1)
          userColorLerp += LERP_SIZE;
        selected_image.style('filter', `grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)})`);
        trashed_image.style('filter', `grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)})`);
        UserColorGradient.style('background-image', `linear-gradient(to top, rgba(${user_rgb_color}, ${p.min(1, userColorLerp) / 2}), rgba(${user_rgb_color}, 0))`);
        if (FadeOutTrashedLerp <= 0 && (this.lerpVal >= 1 || this.lerpVal <= 0) && userColorLerp >= 1) {
          // 이미지가 있다면 배경 지우기
          if (this.info['user'].img) imgDiv.style('background-image', '');
          this.p5canvas['OnlineLamp'].style('background-color', this.info['user']['online'] ? this.statusBar.colors['online'] : this.statusBar.colors['offline']);
          p.noLoop();
        }
      }
      p.windowResized = () => {
        p['OnlineLamp'].style('left', `${this.OtherCanvasDiv.clientWidth / 2 + 38}px`);
      }
    });
  }

  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    };
  }

  isOfficial: string;
  target: string;
  /** 이 사용자와 관련된 알림 검토 (그룹 리액션 검토용) */
  catch_user_noties() {
    let hasNotifications = this.nakama.noti_origin[this.isOfficial] && this.nakama.noti_origin[this.isOfficial][this.target];
    if (hasNotifications) {
      let noti_ids = Object.keys(this.nakama.noti_origin[this.isOfficial][this.target]);
      noti_ids.forEach(noti_id => {
        if (this.nakama.noti_origin[this.isOfficial][this.target][noti_id]['sender_id'] == this.info['user']['id'])
          this.additional_buttons[this.nakama.noti_origin[this.isOfficial][this.target][noti_id]['code'].toString()] = noti_id;
      });
    }
  }

  /** 알림에 의해 생성된 버튼들의 반응 */
  notification_react(code: number) {
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
          this.group_info['group_id'] || this.group_info['id'], [this.info['user']['id']]
        ).then(v => {
          if (!v) console.warn('밴 유저에 대한것 같음, 확인 필요');
          this.p5toast.show({
            text: `${this.lang.text['OtherProfile']['added_to_group']}: ${this.info['user']['display_name'] || this.lang.text['Profile']['noname_user']}`,
          });
          this.nakama.servers[this.isOfficial][this.target].client.deleteNotifications(
            this.nakama.servers[this.isOfficial][this.target].session,
            [this.additional_buttons[code.toString()]]
          ).then(v => {
            if (!v) console.warn('알림 부정 검토 필요');
            delete this.additional_buttons[code.toString()];
            this.nakama.update_notifications(this.isOfficial, this.target);
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

  lock_create_chat = false;
  /** 1:1 대화 생성하기 */
  async create_chat() {
    if (!this.lock_create_chat) {
      this.lock_create_chat = true;
      try {
        let c = await this.nakama.join_chat_with_modulation(this.info['user']['id'], 2, this.isOfficial, this.target, true);
        this.nakama.go_to_chatroom_without_admob_act(c);
        this.lock_create_chat = false;
        this.navCtrl.pop();
      } catch (e) {
        this.lock_create_chat = false;
        console.error(e);
      }
    }
  }

  /** 그룹장이 이 사용자를 퇴출 */
  kick_user_from_group() {
    switch (this.info['state']) {
      case 0:
      case 1:
      case 2: // 그룹원을 강제 탈퇴
        this.after_announce_kick();
        break;
      case 3: // 그룹 입장 대기중인 경우
        this.nakama.servers[this.isOfficial][this.target].client.deleteNotifications(
          this.nakama.servers[this.isOfficial][this.target].session,
          [this.additional_buttons['-5']]
        ).then(v => {
          if (!v) console.warn('알림 부정 검토 필요');
          this.after_announce_kick();
          delete this.additional_buttons['-5'];
          this.nakama.update_notifications(this.isOfficial, this.target);
          this.info['status'] = 'missing';
          this.p5canvas.loop();
        });
        break;
      default:
        console.warn('예상하지 못한 그룹 사용자 상태: ', this.info);
        break;
    }
  }

  /** 사용자 퇴출 알림 후 */
  after_announce_kick() {
    this.nakama.servers[this.isOfficial][this.target].client.kickGroupUsers(
      this.nakama.servers[this.isOfficial][this.target].session,
      this.group_info['group_id'] || this.group_info['id'], [this.info['user']['id']]
    ).then(_v => {
      this.p5toast.show({
        text: `${this.lang.text['OtherProfile']['kicked_from_group']}: ${this.info['user']['display_name'] || this.lang.text['Profile']['noname_user']}`,
      });
      this.navCtrl.pop();
    });
  }

  copy_id() {
    this.global.WriteValueToClipboard('text/plain', this.info['user'].id);
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
  }

  ngOnDestroy(): void {
    this.route.queryParams['unsubscribe']();
    delete this.nakama.socket_reactive['others-profile'];
    delete this.nakama.socket_reactive['others-online'];
    this.p5canvas.remove();
  }
}
