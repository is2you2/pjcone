// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { ILocalNotification, ILocalNotificationAction, ILocalNotificationProgressBar, ILocalNotificationTrigger, LocalNotifications } from '@awesome-cordova-plugins/local-notifications/ngx';
import { IndexedDBService } from './indexed-db.service';

declare var cordova: any;

/** 웹에서도, 앱에서도 동작하는 요소로 구성된 알림폼 재구성  
 * 실험을 거쳐 차례로 병합해가기
 */
interface TotalNotiForm {
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
  /** 하단 행동 추가용 (예를 들어 답장, 읽기 등) */
  actions_ln?: ILocalNotificationAction[];
  /** 알림 중요도. -2 ~ 2 */
  priority_ln?: number;
  /** 안드로이드 전용.  
   * 잠금화면에서 보이기 여부
   */
  lockscreen_ln?: boolean;
  /** 앱을 클릭하여 포어그라운드로 넘어갈지 여부 */
  launch_ln?: boolean;
  /** 미확인  
   * ANDROID ONLY If and how the notification shall show the when date. Possbile values: boolean: true equals 'clock', false disable a watch/counter 'clock': Show the when date in the content view 'chronometer': Show a stopwatch
   */
  clock_ln?: boolean;
  /** 진행바 표기 */
  progressBar_ln?: boolean | ILocalNotificationProgressBar;
  /** 알림 펼치면 있는 아이콘, 칼라임  
   * 모바일은 안드로이드 전용. 우측에 대형을 들어가는 아이콘
   */
  icon?: string;
  /** 상단바와 알림 좌측에 보이는 작은 아이콘  
   * res/drawable 폴더에 포함되어 있는 이름. 안드로이드 전용
   */
  smallIcon_ln?: string;
  /** 안드로이드 전용. 알림에 화면이 켜지는지 여부  
   * 기본적으로 켜지게 되어있으나 false로 끌 수 있음
  */
  wakeup_ln?: boolean;
  /** 안드로이드 전용. 테스트 안됨  
   * ANDROID ONLY Define the blinking of the LED on the device. If set to true, the LED will blink in the default color with timings for on and off set to 1000 ms. If set to a string, the LED will blink in this ARGB value with timings for on and off set to 1000 ms. If set to an array, the value of the key 0 will be used as the color, the value of the key 1 will be used as the 'on' timing, the value of the key 2 will be used as the 'off' timing
   */
  led_ln?: string | boolean | any[] | {
    color: string;
    on: number;
    off: number;
  }
  /** 안드로이드 전용, 테스트 안됨  
   * ANDROID ONLY Set the token for the media session
   */
  mediaSesion_ln?: string;
  /** 언제 발동할까요? */
  triggerWhen_ln?: ILocalNotificationTrigger;
  /** 안드로이드 전용. 테스트 안됨  
   * 이 알림이 나타내는 항목 수
   */
  number_ln?: number;
  /** 알림 아이콘의 색상. 안드로이드 전용  
   * '#' 없이 hex 코드만 (ex. ff0000)
   */
  iconColor_ln?: string;
  /** 안드로이드 전용. 그룹알림시 그룹 이름. 테스트 안됨  
   * Used to group multiple notifications.
   *
   * Calls `setGroup()` on
   * [`NotificationCompat.Builder`](https://developer.android.com/reference/androidx/core/app/NotificationCompat.Builder)
   * with the provided value.
   * @since 1.0.0
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
  /** 소리 설정 */
  sound_ln?: string;
  /** 안드로이드 전용. 알아서 꺼지기 시간(단위/밀리초) */
  timeoutAfter_ln?: number | false;
  /** 알림에 저장될 추가 데이터, Json 형태로 저장됩니다 */
  extra_ln?: any;
  /** Web.Noti: 미확인  
   * Mobile: 알림에 같이 보여지는 뱃지 숫자
   */
  badge?: number;
  /** 이미지 첨부, 가로폭에 맞추어 보여짐 */
  image?: string;
  /** Web.Noti: 미확인 */
  renotify_wn?: boolean;
  /** Web.Noti: 미확인 */
  actions_wn?: NotificationAction[];
  /** Web.Noti: 미확인 */
  data_wn?: any;
  /** Web.Noti: 미확인 */
  dir_wn?: NotificationDirection;
  /** Web.Noti: 미확인 */
  lang_wn?: string;
  /** Web.Noti: 미확인 */
  requireInteraction_wn?: boolean;
  /** Web.Noti: 미확인 */
  tag_wn?: string;
  /** 기본 진동 모드 여부 */
  vibrate_ln?: boolean;
}

/** 로컬 알림 */
@Injectable({
  providedIn: 'root'
})
export class LocalNotiService {

  constructor(
    public noti: LocalNotifications,
    private bgmode: BackgroundMode,
    private indexed: IndexedDBService,
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
    /** 조용한 알림 */
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
  WebNoties = {} as { [id: string]: any };

  /** 권한 요청 처리 */
  async initialize() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
      if (!("Notification" in window)) {
        console.error('Notification 미지원 브라우저입니다');
      }
      Notification.requestPermission().then(v => {
        if (v != 'granted')
          console.log('알림 거절', v);
      }, e => {
        console.error('지원하지 않는 브라우저:', e);
      });
    } // 안드로이드라면 app.component.ts 에서 권한 처리
    // 사설 그룹 채팅 알림은 즉시 무시하기
    this.ClearNoti(11);
  }
  /**
   * 로컬 푸쉬 알림을 동작시킵니다
   * @param header 지금 바라보고 있는 화면의 이름
   * @param _action_wm 클릭시 행동 (Web.Noti)
   */
  PushLocal(opt: TotalNotiForm, header: string = 'favicon', _action_wm: Function = () => { }) {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
      // 창을 바라보는 중이라면 무시됨, 바라보는 중이면서 같은 화면이면 무시됨
      if (document.hasFocus() && this.Current == header) return;
      if (opt.triggerWhen_ln) return; // 웹에는 예약 기능이 없음
      /** 기본 알림 옵션 (교체될 수 있음) */
      const input: NotificationOptions = {
        badge: `${opt.badge}`,
        body: opt.body,
        icon: `assets/icon/${opt.icon || opt.smallIcon_ln || header || 'favicon'}.png`,
        image: opt.image,
        lang: opt.lang_wn,
        silent: !this.settings.silent[opt.icon || opt.smallIcon_ln] || false,
        tag: opt.tag_wn,
        actions: opt.actions_wn,
        data: opt.data_wn,
        renotify: opt.renotify_wn,
        requireInteraction: opt.requireInteraction_wn,
        dir: opt.dir_wn,
      }
      if (isPlatform == 'DesktopPWA') {
        if (this.WebNoties[opt.id]) {
          this.WebNoties[opt.id].close();
          delete this.WebNoties[opt.id];
        }
        this.WebNoties[opt.id] = new Notification(opt.title, { ...input });
        this.WebNoties[opt.id].onclick = () => {
          _action_wm();
          window.focus();
          this.WebNoties[opt.id].close();
        };
      } else if (window['swReg'] && window['swReg'].active) {
        if (this.WebNoties[opt.id]) {
          try {
            this.WebNoties[opt.id].close();
          } catch (e) { }
          delete this.WebNoties[opt.id];
        }
        try {
          this.WebNoties[opt.id] = window['swReg'].showNotification(opt.title, { ...input });
        } catch (e) { }
        try {
          this.WebNoties[opt.id].onclick = () => {
            _action_wm();
            window.focus();
            this.WebNoties[opt.id].close();
          };
        } catch (e) { }
      }
    } else { // 모바일 로컬 푸쉬
      // 포어그라운드면서 해당 화면이면 동작 안함
      if (!this.bgmode.isActive() && this.Current == header) return;
      let input: ILocalNotification = {};
      input['id'] = opt.id;
      input['title'] = opt.title;
      if (opt.body)
        input['text'] = opt.body;
      if (opt.actions_ln)
        input['actions'] = opt.actions_ln;
      if (opt.autoCancel_ln)
        input['autoClear'] = opt.autoCancel_ln;
      if (opt.launch_ln)
        input['launch'] = opt.launch_ln;
      if (opt.badge)
        input['badge'] = opt.badge;
      if (opt.image)
        input['attachments'] = [opt.image];
      if (opt.clock_ln)
        input['clock'] = opt.clock_ln;
      if (opt.iconColor_ln)
        input['color'] = opt.iconColor_ln || 'ffd94e';
      if (opt.extra_ln)
        input['data'] = opt.extra_ln;
      if (opt.group_ln)
        input['group'] = opt.group_ln;
      if (opt.groupSummary_ln)
        input['groupSummary'] = opt.groupSummary_ln;
      if (opt.groupSummaryText_ln)
        input['summary'] = opt.groupSummaryText_ln;
      if (opt.led_ln)
        input['led'] = opt.led_ln;
      if (opt.lockscreen_ln)
        input['lockscreen'] = opt.lockscreen_ln;
      if (opt.mediaSesion_ln)
        input['mediaSession'] = opt.mediaSesion_ln;
      if (opt.number_ln)
        input['number'] = opt.number_ln;
      if (opt.progressBar_ln)
        input['progressBar'] = opt.progressBar_ln;
      if (opt.priority_ln)
        input['priority'] = opt.priority_ln;
      input['silent'] = !this.settings.silent[opt.smallIcon_ln] || false;
      if (opt.timeoutAfter_ln)
        input['timeoutAfter'] = opt.timeoutAfter_ln;
      if (opt.wakeup_ln)
        input['wakeup'] = opt.wakeup_ln;
      if (opt.ongoing_ln)
        input['sticky'] = opt.ongoing_ln;
      if (opt.triggerWhen_ln)
        input['trigger'] = opt.triggerWhen_ln;
      if (opt.vibrate_ln)
        input['vibrate'] = opt.vibrate_ln;
      if (opt.icon)
        input['icon'] = opt.icon;
      input['smallIcon'] = `res://${opt.smallIcon_ln || header || 'icon_mono'}`;
      input['sound'] = `res://${opt.sound_ln || 'platform_default'}`;
      input['foreground'] = true;
      this.noti.schedule(input);
    }
  }

  /** 기등록 id 불러오기 (Android: 예약된 알림) */
  GetNotificationIds(_CallBack = (_list: number[]) => { }) {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
    } else {
      this.noti.getScheduledIds().then((ids) => {
        _CallBack(ids);
      });
    }
  }

  /** 알림 제거하기 */
  ClearNoti(id: any) {
    if (isPlatform == 'DesktopPWA') {
      if (this.WebNoties[id])
        this.WebNoties[id].close();
    } else if (isPlatform != 'MobilePWA')
      this.noti.clear(id);
  }

  /** 알림 행동 등록시 기록 */
  listeners = {};
  /** 알림 행동 받기  
   * eventName — The name of the event. Available events: schedule(예약됨), trigger(발생됨), click(눌렀을 때), update, clear, clearall, cancel, cancelall. Custom event names are possible for actions 
   */
  SetListener(ev: string, subscribe: Function = (v: any, eopts: any) => console.warn(`${ev}: ${v}/${eopts}`)) {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
    } else {
      this.listeners[ev] = (v: any, eopts: any) => {
        subscribe(v, eopts);
      }
      cordova.plugins.notification.local.on(ev, this.listeners[ev]);
    }
  }

  /** 알림 행동 지우기  
   * eventName — The name of the event. Available events: schedule(예약됨), trigger(발생됨), click(눌렀을 때), update, clear, clearall, cancel, cancelall. Custom event names are possible for actions 
   */
  RemoveListener(ev: string) {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
    } else {
      cordova.plugins.notification.local.un(ev, this.listeners[ev]);
      delete this.listeners[ev];
    }
  }
}
