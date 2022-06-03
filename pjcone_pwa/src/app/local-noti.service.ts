import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';
import { LocalNotifications } from "@capacitor/local-notifications";

/** ### 로컬 알림
 * 알림 신호를 받으면 로컬 알림을 생성함
 */
@Injectable({
  providedIn: 'root'
})
export class LocalNotiService {

  constructor() { }

  /** 권한 요청 처리 */
  initialize() {
    if (isPlatform == 'Browser') {
      Notification.requestPermission().then(v => {
        if (v != 'granted')
          console.warn('알림 거절', v);
      }, e => {
        console.error('지원하지 않는 브라우저:', e);
      });
    } else {
      console.warn('모바일 액션 준비중: LocalNotification 예정');
      LocalNotifications.schedule({
        notifications: [
          {
            title: 'title',
            body: 'text',
            id: 0
          }
        ]
      });
    }
  }
  /**
   * 로컬 푸쉬 알림을 동작시킵니다
   * @param _title 알림 타이틀
   * @param _opt 알림 옵션
   * @param _action 클릭시 행동
   */
  PushLocal(_title: string, _opt: NotificationOptions = null, _action: Function = null) {
    if (isPlatform == 'Browser') {
      /** 기본 알림 옵션 (교체될 수 있음) */
      const _default_opt: NotificationOptions = {
        icon: 'assets/icon/favicon.png',
      }
      const _noti = new Notification(_title, { ..._default_opt, ..._opt });
      _noti.onclick = () => {
        _action;
        window.focus();
      };
    } else {
      console.log('모바일 알림 준비중');
    }
  }
}
