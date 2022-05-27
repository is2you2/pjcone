import { Injectable } from '@angular/core';
import * as p5 from 'p5';

/** ### p5js를 이용한 커스텀 토스트
 * 이 토스트를 이용하여 화면에 알림을 띄운다
 */
@Injectable({
  providedIn: 'root'
})
export class P5ToastService {

  constructor() { }
  /** 현재 보여지는 알림 */
  private CurrentToast: p5;
  /**
   * 토스트 알림을 보여줍니다
   * @param _Msg 문자열 메시지
   * @param _duration 보여지는 시간
   * @param _img 이미지 경로
   */
  CreateToast(_Msg: string, _duration: number = 6, _img: string = '') {
    let _toast = (p: p5) => {
      p.setup = () => {
        console.log('p5 동작 로그');
        this.CurrentToast.remove();
      }
    }
    this.CurrentToast = new p5(_toast);
  }
}
