import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';

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
    }
  }
}
