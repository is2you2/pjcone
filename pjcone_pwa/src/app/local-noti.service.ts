import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';
import { Attachment, LocalNotifications, LocalNotificationSchema, Schedule } from "@capacitor/local-notifications";
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';

/** 웹에서도, 앱에서도 동작하는 요소로 구성된 알림폼 재구성  
 * 실험을 거쳐 차례로 병합해가기
 */
interface TotalNotiForm {
  /** LocalNoti: 알림 아이디 */
  id_ln: number,
  /** 타이틀 */
  title: string;
  /** 주 내용자리 */
  body?: string;
  /** LocalNoti: 큰 텍스트 블럭용 자리, 미확인 */
  largeBody_ln?: string;
  /** LocalNoti:안드로이드 전용: 큰 텍스트 알림 스타일의 요약 텍스트 세부정보 표시용, 미확인 */
  summaryText_ln?: string;
  /** LocalNoti: 나중에 이 알림을 예약하세요 */
  schedule_ln?: Schedule;
  /** 알림 펼치면 있는 아이콘, 칼라임 */
  icon?: string;
  /** LocalNoti: 상태바 들어가는 아이콘, 기본 아이콘보다 우선처리  
   * res/drawable 폴더에 포함되어 있는 이름. 안드로이드 전용
   */
  smallIcon_ln?: string;
  /** LocalNoti: 알림에 사용되는 큰 아이콘  
   * res/drawable 폴더에 포함되어 있는 이름. 안드로이드 전용
   */
  largeIcon_ln?: string;
  /** LocalNoti: 알림 아이콘의 색상 */
  iconColor_ln?: string;
  /** LocalNoti: 첨부파일, 미확인 */
  attachments_ln?: Attachment[];
  /** LocalNoti: 알림과 작업유형 연결 ID, 미확인 */
  actionTypeId_ln?: string;
  /** LocalNoti: 안드로이드 전용. 그룹알림  
   * Used to group multiple notifications.
   *
   * Calls `setGroup()` on
   * [`NotificationCompat.Builder`](https://developer.android.com/reference/androidx/core/app/NotificationCompat.Builder)
   * with the provided value.
   * @since 1.0.0
   */
  group_ln?: string;
  /** LocalNoti: 안드로이드 전용, 그룹을 사용할 때 그룹 요약  
   * If true, this notification becomes the summary for a group of
   * notifications.
   *
   * Calls `setGroupSummary()` on
   * [`NotificationCompat.Builder`](https://developer.android.com/reference/androidx/core/app/NotificationCompat.Builder)
   * with the provided value.
   *
   * Only available for Android when using `group`.
   */
  groupSummary_ln?: boolean;
  /** LocalNoti: 알림 채널 설정  
   * Specifies the channel the notification should be delivered on.
   *
   * If channel with the given name does not exist then the notification will
   * not fire. If not provided, it will use the default channel.
   *
   * Calls `setChannelId()` on
   * [`NotificationCompat.Builder`](https://developer.android.com/reference/androidx/core/app/NotificationCompat.Builder)
   * with the provided value.
   */
  channelId_ln?: string;
  /** LocalNoti: 안드로이드 전용.  
   * 알림을 밀어서 제거할 수 있는지 여부
   */
  ongoing_ln?: boolean;
  /** LocalNoti: 안드로이드 전용.  
   * 알림을 클릭해서 알림이 취소됩니다.
   */
  autoCancel_ln?: boolean;
  /** LocalNoti: 안드로이드 전용.  
   * 받은 편지함 스타일 알림에 표시할 문자열 목록 표기
   */
  inboxList_ln?: string[];
  /** LocalNoti: 알림에 저장될 추가 데이터, 미확인 */
  extra_ln?: any;
  /** Web.Noti: 미확인 */
  badge_wn?: string;
  /** 이미지 첨부, 겁나크게 보여잠 */
  image?: string;
  /** Web.Noti: 미확인 */
  renotify_wn?: boolean;
  /** Web.Noti: 미확인 */
  actions_nw?: NotificationAction[];
  /** Web.Noti: 미확인 */
  data_wn?: any;
  /** Web.Noti: 미확인 */
  dir_wn?: NotificationDirection;
  /** Web.Noti: 미확인 */
  lang_wn?: string;
  /** Web.Noti: 미확인 */
  requireInteraction_wn?: boolean;
  /** Web.Noti: 미확인 */
  silent_wn?: boolean;
  /** Web.Noti: 미확인 */
  tag_wn?: string;
}

/** ### 로컬 알림
 * 알림 신호를 받으면 로컬 알림을 생성함
 */
@Injectable({
  providedIn: 'root'
})
export class LocalNotiService {

  constructor(
    private bgmode: BackgroundMode,
  ) { }

  /** 권한 요청 처리 */
  initialize() {
    if (isPlatform == 'DesktopPWA') {
      Notification.requestPermission().then(v => {
        if (v != 'granted')
          console.warn('알림 거절', v);
      }, e => {
        console.error('지원하지 않는 브라우저:', e);
      });
    } // 모바일은 별도 초기화 과정 없음
  }
  /**
   * 로컬 푸쉬 알림을 동작시킵니다
   * @param opt 알림 옵션
   * @param _action 클릭시 행동
   */
  PushLocal(opt: TotalNotiForm, _action: Function = () => { }) {
    if (isPlatform == 'DesktopPWA') {
      // 창일 바라보는 중이라면 무시됨
      if (document.hasFocus()) return;
      /** 기본 알림 옵션 (교체될 수 있음) */
      const input: NotificationOptions = {
        badge: opt.badge_wn,
        body: opt.body,
        icon: opt.icon || 'assets/icon/favicon.png',
        image: opt.image,
        lang: opt.lang_wn,
        silent: opt.silent_wn,
        tag: opt.tag_wn,
        actions: opt.actions_nw,
        data: opt.data_wn,
        renotify: opt.renotify_wn,
        requireInteraction: opt.requireInteraction_wn,
        dir: opt.dir_wn,
      }
      const _noti = new Notification(opt.title, { ...input });

      _noti.onclick = () => {
        _action();
        window.focus();
      };
    } else { // 모바일 로컬 푸쉬
      if (!this.bgmode.isActive()) return; // 포어그라운드일 때 동작 안함
      const input: LocalNotificationSchema = {
        id: opt.id_ln,
        title: opt.title,
        body: opt.body,
        actionTypeId: opt.actionTypeId_ln,
        autoCancel: opt.autoCancel_ln,
        attachments: opt.attachments_ln,
        channelId: opt.channelId_ln,
        extra: opt.extra_ln,
        group: opt.group_ln,
        groupSummary: opt.groupSummary_ln,
        iconColor: opt.iconColor_ln,
        inboxList: opt.inboxList_ln,
        largeBody: opt.largeBody_ln,
        largeIcon: opt.largeIcon_ln,
        ongoing: opt.ongoing_ln,
        schedule: opt.schedule_ln,
        smallIcon: opt.smallIcon_ln,
        summaryText: opt.summaryText_ln,
        summaryArgument: opt.summaryText_ln,
      };
      LocalNotifications.schedule({
        notifications: [{
          ...input
        }]
      });
    }
  }
}
