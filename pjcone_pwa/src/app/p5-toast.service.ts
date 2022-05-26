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

  /** 토스트 만들기 */
  CreateToast(_msg: string) {
    if (this.CurrentToast != null) return; // 이미 토스트가 있다면 누적시키기
    let toast = (p: p5) => {
      p.setup = () => {
        p.remove();
      }
    }
    this.CurrentToast = new p5(toast);
  }
}
