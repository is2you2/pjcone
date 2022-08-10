import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';
import { ActionPerformed, Attachment, CancelOptions, Channel, LocalNotifications, LocalNotificationSchema, RegisterActionTypesOptions, Schedule } from "@capacitor/local-notifications";
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';

/** 웹에서도, 앱에서도 동작하는 요소로 구성된 알림폼 재구성  
 * 실험을 거쳐 차례로 병합해가기
 */
interface TotalNotiForm {
  /** LocalNoti: 알림 아이디  
   * 웹에서도 활용하는 구조로 변경됨
   */
  id: number,
  /** 타이틀 */
  title: string;
  /** LocalNoti: 경우가 좀 있다.  
   * 1. body만 쓰는 경우: 알림이 접혀있든 펴져있든 보인다.
   * 2. largeBody와 같이 쓰는 경우: 접혀있을 때만 보인다.
   */
  body?: string;
  /** LocalNoti: 알림을 펼쳤을 때 보여지는 내용.  
   * body 없이 얘만 설정하면 알림이 접힌 상태에서 내용이 없다.
   */
  largeBody_ln?: string;
  /** LocalNoti: 안드로이드 전용: 최상단 제목 옆 추가 글귀  
   * *body, largeBody가 사용되지 않는다면 동작하지 않음
   */
  summaryText_ln?: string;
  /** LocalNoti: 나중에 이 알림을 예약하세요 */
  schedule_ln?: Schedule;
  /** 알림 펼치면 있는 아이콘, 칼라임 */
  icon_wm?: string;
  /** LocalNoti: 상태바 들어가는 아이콘, 기본 아이콘보다 우선처리  
   * res/drawable 폴더에 포함되어 있는 이름. 안드로이드 전용
   */
  smallIcon_ln?: string;
  /** LocalNoti: 알림에 사용되는 큰 아이콘  
   * 우측에 좀 더 큰 모양으로 뜬다.  
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
   * 근데 안되더라 ㅡㅡ
   */
  autoCancel_ln?: boolean;
  /** LocalNoti: 안드로이드 전용.  
   * 받은 편지함 스타일 알림에 표시할 문자열 목록 표기....라는데  
   * 그냥 문자열 최대 5개가 줄줄줄 적히는 스타일이다..  
   * 이 녀석도 largeBody와 동일하게 동작하는 것 같다. summartText가 살아남
   * 실시간으로 리스트를 변경시킬 수 있는 녀석은 아니다
   */
  inboxList_ln?: string[];
  /** LocalNoti: 알림에 저장될 추가 데이터, 미확인 */
  extra_ln?: any;
  /** Web.Noti: 미확인 */
  badge_wn?: string;
  /** Web.Noti: 이미지 첨부, 가로폭에 맞추어 보여짐 */
  image_wn?: string;
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
  silent_wn?: boolean;
  /** Web.Noti: 미확인 */
  tag_wn?: string;
}

/** 로컬 알림 */
@Injectable({
  providedIn: 'root'
})
export class LocalNotiService {

  constructor(
    private bgmode: BackgroundMode,
  ) { }

  /** 현재 바라보고 있는 화면 이름, 비교하여 같으면 알림을 보내지 않음 */
  Current: string;
  /** 웹에서 앱 아이디를 따라 알림 관리  
   * { id: Notification }
   */
  WebNoties = {} as { [id: string]: Notification };

  /** 권한 요청 처리 */
  initialize() {
    if (isPlatform == 'DesktopPWA') {
      if (!("Notification" in window)) {
        console.error('Notification 미지원 브라우저입니다');
      }
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
   * @param header 지금 바라보고 있는 화면의 이름
   * @param opt 알림 옵션s
   * @param _action_wm 클릭시 행동 (Web.Noti)
   */
  PushLocal(opt: TotalNotiForm, header: string = 'favicon', _action_wm: Function = () => { }) {
    if (isPlatform == 'DesktopPWA') {
      // 창을 바라보는 중이라면 무시됨, 바라보는 중이면서 같은 화면이면 무시됨
      if (document.hasFocus() && this.Current == header) return;
      /** 기본 알림 옵션 (교체될 수 있음) */
      const input: NotificationOptions = {
        badge: opt.badge_wn,
        body: opt.body,
        icon: opt.icon_wm || `assets/icon/${header}.png` || `assets/icon/favicon.png`,
        image: opt.image_wn,
        lang: opt.lang_wn,
        silent: opt.silent_wn,
        tag: opt.tag_wn,
        actions: opt.actions_wn,
        data: opt.data_wn,
        renotify: opt.renotify_wn,
        requireInteraction: opt.requireInteraction_wn,
        dir: opt.dir_wn,
      }
      this.WebNoties[opt.id] = new Notification(opt.title, { ...input });

      this.WebNoties[opt.id].onclick = () => {
        _action_wm();
        window.focus();
      };
      this.WebNoties[opt.id].onshow = (e) => console.error(`WebNoties 동작 오류_${opt.id}: ${e}`)
    } else if (isPlatform != 'MobilePWA') { // 모바일 로컬 푸쉬
      // 포어그라운드일 때 동작 안함, 포어그라운드면서 해당 화면이면 동작 안함
      if (!this.bgmode.isActive() && this.Current == header) return;
      const input: LocalNotificationSchema = {
        id: opt.id,
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
        smallIcon: opt.smallIcon_ln || header || 'icon_mono',
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

  CancelNoti(opt: CancelOptions) {
    if (isPlatform == 'DesktopPWA') {
      if (this.WebNoties[opt.notifications[0].id])
        this.WebNoties[opt.notifications[0].id].close();
    } else if (isPlatform != 'MobilePWA')
      LocalNotifications.cancel(opt);
  }

  /** 채널 만들기_안드로이드 */
  create_channel(channel_info: Channel) {
    if (isPlatform == 'Android' || isPlatform == 'iOS')
      LocalNotifications.createChannel(channel_info);
  }

  /** 채널 삭제 */
  remove_channel(channel_info: Channel) {
    if (isPlatform == 'Android' || isPlatform == 'iOS')
      LocalNotifications.deleteChannel(channel_info);
  }

  /** 액션 설정 */
  register_action(_action: RegisterActionTypesOptions) {
    if (isPlatform == 'Android' || isPlatform == 'iOS')
      LocalNotifications.registerActionTypes(_action);
  }

  /**
   * Listener를 추가하여 알림과 상호작용한다
   * @param evType Listener 타입: 알림이 떳을 때(Received)와 알림으로 행동했을 때(Performed)
   * @param act 등록하는 행동
   */
  addNotiListener(evType: 'Received' | 'Performed', act: Function = () => { }) {
    if (isPlatform == 'Android' || isPlatform == 'iOS')
      if (evType == 'Received')
        LocalNotifications.addListener('localNotificationReceived', (v: LocalNotificationSchema) => {
          act(v);
        });
      else if (evType == 'Performed')
        LocalNotifications.addListener('localNotificationActionPerformed', (v: ActionPerformed) => {
          act(v);
        });
  }

  removeNotiListener() {
    if (isPlatform == 'Android' || isPlatform == 'iOS')
      LocalNotifications.removeAllListeners();
  }
}
