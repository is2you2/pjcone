import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';
import { LocalNotificationSchema, LocalNotifications, PendingLocalNotificationSchema, Schedule } from "@capacitor/local-notifications";
import { IndexedDBService } from './indexed-db.service';
import { LanguageSettingService } from './language-setting.service';

/** 웹에서도, 앱에서도 동작하는 요소로 구성된 알림폼 재구성  
 * 실험을 거쳐 차례로 병합해가기
 */
export interface TotalNotiForm {
  /** 알림 아이디  
   * 웹에서도 알림 취소로 활용할 수 있음
   */
  id: number,
  /** 타이틀 */
  title: string;
  /** 내용 글귀  
   * ~~1. body만 쓰는 경우: 알림이 접혀있든 펴져있든 보인다.~~  
   * ~~2. largeBody와 같이 쓰는 경우: 접혀있을 때만 보인다.~~
   */
  body?: string;
  /** 알림 펼치면 있는 아이콘, 칼라임  
   * 모바일은 안드로이드 전용. 우측에 대형을 들어가는 아이콘
   */
  icon?: string;
  /** 상단바와 알림 좌측에 보이는 작은 아이콘  
   * res/drawable 폴더에 포함되어 있는 이름. 안드로이드 전용
   */
  smallIcon_ln?: string;
  /** 언제 발동할까요? */
  triggerWhen_ln?: Schedule;
  /** 알림 아이콘의 색상. 안드로이드 전용  
   * '#' 없이 hex 코드만 (ex. ff0000)
   */
  iconColor_ln?: string;
  /** 안드로이드 전용. 그룹알림시 그룹 이름. 테스트 안됨  
   * 
   * Used to group multiple notifications.
   *
   * Calls setGroup() on NotificationCompat.Builder with the provided value.
   *
   * Only available for Android.
   */
  group_ln?: string;
  /** 안드로이드 전용, 그룹 요약 사용여부 */
  groupSummary_ln?: boolean;
  /** 안드로이드 전용: 그룹요약 사용시 요약내용 */
  groupSummaryText_ln?: string;
  /** 안드로이드 전용.  
   * 알림을 밀어서 제거할 수 있는지 여부
   */
  ongoing_ln?: boolean;
  /** 안드로이드 전용.  
   * 앱을 진입할 때 알림이 삭제됩니다  
   */
  autoCancel_ln?: boolean;
  /** 알림에 저장될 추가 데이터, Json 형태로 저장됩니다 */
  extra_ln?: any;
  /** 이미지 첨부, 가로폭에 맞추어 보여짐 */
  image?: string;
  /** Android: 알림 액션 id (string) / 하나만 받으므로 [0]만 사용 */
  actions_ln?: any[];
  /** 웹 알림 내 알림 행동 */
  actions_wm?: any[];
  /** 알림 내장 데이터 */
  data_wm?: any;
}

/** 로컬 알림 */
@Injectable({
  providedIn: 'root'
})
export class LocalNotiService {

  constructor(
    private indexed: IndexedDBService,
    private lang: LanguageSettingService,
  ) { }

  /** settings에 해당하는 값을 변경한 후 저장함 */
  change_silent_settings(key: string) {
    this.settings.silent[key] = !this.settings.silent[key];
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.settings), 'notification_settings.json');
  }

  /** 설정값 복구 */
  load_settings() {
    this.indexed.loadTextFromUserPath('notification_settings.json', (e, v) => {
      if (e && v) this.settings = JSON.parse(v);
      // 아래, 구 버전 호환성 코드
      if (typeof this.settings.silent == 'boolean')
        this.settings.silent = {
          icon_mono: this.settings.silent,
          diychat: this.settings.silent,
          simplechat: this.settings.silent,
          todo: this.settings.silent,
          engineppt: this.settings.silent,
        };
      // 여기까지, 전부 호환된다고 판단되는 경우 삭제
    });
  }

  settings = {
    /** 조용한 알림 (slient)  
     * 원래 slient 옵션에 대응하는데 그냥 이 옵션의 아이콘 이름이 같으면 알림 토글처리
     */
    silent: {
      icon_mono: true,
      diychat: true,
      simplechat: true,
      todo: true,
      engineppt: true,
    },
    /** 알림 진동 사용 여부 */
    vibrate: false,
  }
  /** 현재 바라보고 있는 화면 이름, 비교하여 같으면 알림을 보내지 않음 */
  Current: string;
  /** 웹에서 앱 아이디를 따라 알림 관리  
   * { id: Notification }
   */
  WebNoties = {} as { [id: string]: Notification };

  /** 모바일 웹 로컬 푸쉬를 위해 서비스워커를 기억함 */
  MobileSWReg: ServiceWorkerRegistration;
  /** 광장 채널 채팅 클라이언트, 순환 코드 참조 우회용 */
  Sq_client: any;
  /** 권한 요청 처리 */
  async initialize() {
    // 사설 그룹 채팅 알림은 즉시 무시하기
    this.ClearNoti(11);
    if ('serviceWorker' in navigator) {
      this.MobileSWReg = window['swReg'];
      navigator.serviceWorker.addEventListener('message', ev => {
        if (window['swRegListenerCallback'][ev.data.data])
          window['swRegListenerCallback'][ev.data.data]();
        delete window['swRegListenerCallback'][ev.data.data];
        // 인라인 텍스트 입력이 있는 경우
        if (ev.data.reply) {
          switch (ev.data.data) {
            case '12': // 광장 채널 답장하기
              let data = {
                msg: ev.data.reply,
              }
              if (!data.msg.trim()) return;
              data['name'] = this.Sq_client.MyUserName;
              this.Sq_client.send(JSON.stringify(data));
              break;
          }
        }
      });
    } else {
      console.log('Service Worker is not supported in this browser.');
    }
  }
  /** 알림 액션 추가하기 */
  RegisterNofiticationActionType() {
    // 모바일 알림 행동에 대한 것으로 웹은 무시함
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') return;
    LocalNotifications.registerActionTypes({
      types: [{
        // 그룹 채널용 답장보내기
        id: 'group_dedi',
        actions: [{
          id: 'reply',
          title: this.lang.text['MinimalChat']['Noti_Reply'],
          input: true,
        }],
      }, {
        // 채널 채팅용 답장보내기
        id: 'chatroom_reply',
        actions: [{
          id: 'reply',
          title: this.lang.text['MinimalChat']['Noti_Reply'],
          input: true,
        }],
      }]
    });
  }
  /**
   * 로컬 푸쉬 알림을 동작시킵니다
   * @param header 지금 바라보고 있는 화면의 이름
   * @param _action_wm 클릭시 행동 (Web.Noti)
   */
  async PushLocal(opt: TotalNotiForm, header: string = 'favicon', _action_wm: Function = () => { }) {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
      // 창을 바라보는 중이라면 무시됨, 바라보는 중이면서 같은 화면이면 무시됨
      if (document.hasFocus() && this.Current == header) return;
      if (!this.settings.silent[opt.icon || opt.smallIcon_ln || header || 'icon_mono']) return;
      if (opt.triggerWhen_ln) return; // 웹에는 예약 기능이 없음
      /** 기본 알림 옵션 (교체될 수 있음) */
      const input: any = {
        badge: `assets/badge/${opt.icon || opt.smallIcon_ln || header || 'favicon'}.png`,
        body: opt.body,
        icon: `assets/icon/${opt.icon || opt.smallIcon_ln || header || 'favicon'}.png`,
        image: opt.image,
        silent: !this.settings.silent[opt.icon || opt.smallIcon_ln] || false,
        tag: `${opt.id}`,
        actions: opt.actions_wm,
        data: opt.data_wm,
        requireInteraction: Boolean(opt.actions_wm),
      }
      try {
        if (this.WebNoties[opt.id]) {
          try {
            this.WebNoties[opt.id].close();
          } catch (e) { }
          delete this.WebNoties[opt.id];
        }
        await this.MobileSWReg.showNotification(opt.title, { ...input });
        let getNoties = await this.MobileSWReg.getNotifications();
        for (let i = 0, j = getNoties.length; i < j; i++)
          if (getNoties[i].tag == `${opt.id}`) {
            this.WebNoties[opt.id] = getNoties[i];
            break;
          }
        window['swRegListenerCallback'][opt.id] = () => {
          _action_wm();
          window.focus();
          this.WebNoties[opt.id].close();
        }
      } catch (e) { }
    } else { // 모바일 로컬 푸쉬
      if (this.Current == header) return;
      if (!this.settings.silent[opt.icon || opt.smallIcon_ln || header || 'icon_mono']) return;
      let input: LocalNotificationSchema = {
        id: opt.id,
        title: opt.title,
        body: opt.body,
        schedule: opt.triggerWhen_ln,
        iconColor: `#${opt.iconColor_ln || 'ffd94e'}`,
        extra: opt.extra_ln,
        autoCancel: opt.autoCancel_ln,
        largeIcon: opt.icon,
        smallIcon: opt.smallIcon_ln || header || 'icon_mono',
        group: opt.group_ln,
        groupSummary: opt.groupSummary_ln,
        summaryText: opt.groupSummaryText_ln,
        ongoing: opt.ongoing_ln,
        actionTypeId: opt.actions_ln?.shift(),
      };
      if (opt.image)
        input['attachments'] = [{
          id: '0',
          url: opt.image,
        }];
      let keys = Object.keys(input);
      for (let i = 0, j = keys.length; i < j; i++)
        if (input[keys[i]] === undefined)
          delete input[keys[i]];
      LocalNotifications.schedule({ notifications: [input] });
    }
  }

  /** 기등록 id 불러오기 (Android: 예약된 알림) */
  GetNotificationIds(_CallBack = (_list: PendingLocalNotificationSchema[]) => { }) {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
    } else {
      LocalNotifications.getPending().then((ids) => {
        _CallBack(ids.notifications);
      });
    }
  }

  /** 알림 제거하기 */
  ClearNoti(id: any) {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
      if (this.WebNoties[id]) this.WebNoties[id].close();
    } else LocalNotifications.cancel({ notifications: [{ id: id }] });
  }
}
