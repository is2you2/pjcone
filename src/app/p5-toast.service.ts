import { Injectable } from '@angular/core';
import * as p5 from 'p5';
import { isDarkMode } from './global-act.service';

/** 생성하는 토스트 정보 */
interface ToastInfo {
  /** 안내가 조금 늦어도 됩니까? */
  lateable?: boolean;
  /** 보여지는 문구 */
  text?: string;
  /** 보여지는 시간 강제, 초 단위 */
  duration?: number;
  /** 이미지 경로 */
  img?: string;
  /** 알림이 발생한 시간, 자동으로 생성됩니다 */
  time?: number;
}

enum Status {
  Idle,
  DivFadeIn,
  BorderAlert,
  Reading,
  FadeOut,
}

/** p5js를 이용한 커스텀 토스트  
 * 이 토스트를 이용하여 화면에 알림을 띄운다
 */
@Injectable({
  providedIn: 'root'
})
export class P5ToastService {

  constructor() { }
  /** 현재 보여지는 알림 */
  private CurrentToast: p5;

  /** 토스트가 보여지는 중인지 여부 */
  private isShowing = false;
  /** 앱 사용간 알림 기록 */
  private stack: ToastInfo[] = [];
  /** 현재 진행중인 알림 */
  private AlertNow: ToastInfo;
  private alert: ToastInfo[] = [];

  private status = Status.Idle;

  /** 토스트 알림을 보여줍니다 */
  show(info: ToastInfo) {
    info.time = new Date().getTime();

    if (!info.lateable) { // 강제가 아닌 메시지 선별
      this.AlertNow = info;
      this.status = Status.DivFadeIn;
    }
    // 아래, 동일 알람 누적 방지용
    let last_stack: ToastInfo;
    if (this.alert.length)
      last_stack = this.alert[this.alert.length - 1];
    if (this.AlertNow && this.AlertNow.text == info.text)
      this.status = Status.DivFadeIn; // 현재알림과 같으면 재알림
    else if (last_stack && last_stack.text == info.text) {
      // 마지막 알림과 같으면 스택 무시
    } else this.alert.push(info);

    if (!this.isShowing) {
      let _toast = (p: p5) => {
        /** 사용하는 div개체 */
        let div: p5.Element;
        /** 내용물 개체 */
        let content: p5.Element;
        /** 내부 border 처리용 */
        let border: p5.Element;
        /** 전체 투명도 조정용 */
        let divLerp = 0;
        /** 새 메시지 알림을 위한 외곽선 조정용 */
        let borderLerp = 0;
        /** 읽기 종료 시간 예측 */
        let WillReadEndAt = 0;
        p.setup = () => {
          p.noCanvas();
          div = p.createDiv();
          div.style("position: absolute; left: 0; top: 0; z-index: 2");
          div.style("width: 100%; height: fit-content");
          div.style("padding: 32px;");
          div.style("display: flex; justify-content: center;");
          div.style("pointer-events: none");
          update_div();

          border = p.createDiv();
          border.parent(div);
          border.style("display: flex; justify-content: center;");
          border.style("width: fit-content; height: fit-content");
          border.style("border-radius: 24px");
          border.style('background: var(--toast-background-color)');
          border.style("padding: 4px");

          content = p.createDiv();
          content.parent(border);
          content.style("display: flex; justify-content: center;");
          content.style("width: fit-content; height: fit-content");
          content.style("word-break: break-all");
          content.style('background: var(--toast-background-color)');
          content.style("border-radius: 20px");
          content.style("padding: 12px");
          content.style("color: white");

          if (!this.AlertNow)
            this.AlertNow = this.alert.shift();

          content.html(this.HTMLEncode(this.AlertNow.text));
          update_border();
          this.status = Status.DivFadeIn;
        }
        p.draw = () => {
          switch (this.status) {
            case Status.DivFadeIn:
              if (divLerp < 1)
                divLerp += 1;
              else {
                divLerp = 1;
                borderLerp = 1;
                this.status = Status.BorderAlert;
                content.html(this.HTMLEncode(this.AlertNow.text));
              }
              break;
            case Status.BorderAlert:
              if (borderLerp > 0)
                borderLerp -= .03;
              else {
                borderLerp = 0;
                let duration: number;
                if (this.AlertNow.duration)
                  duration = this.AlertNow.duration * 1000;
                else duration = new TextEncoder().encode(this.AlertNow.text).length * 24;
                WillReadEndAt = p.millis() + duration + 960;
                this.status = Status.Reading;
              }
              break;
            case Status.Reading:
              if (p.millis() > WillReadEndAt) {
                if (this.alert.length) {
                  this.stack.push(this.AlertNow);
                  this.AlertNow = this.alert.shift();
                  content.html(this.HTMLEncode(this.AlertNow.text));
                  this.status = Status.DivFadeIn;
                } else this.status = Status.FadeOut;
              }
              break;
            case Status.FadeOut:
              if (divLerp > 0)
                divLerp -= .04;
              else hide_toast();
              break;
          }
          update_div();
          update_border();
        }
        /** 전체 판넬 조정 */
        let update_div = () => {
          div.style(`opacity: ${divLerp}`);
        }
        /** Toast 외곽 조정 */
        let update_border = () => {
          let calced = p.lerpColor(p.color(`#${isDarkMode ? '30564e88' : 'b9543788'}`), p.color('#ffd94ebb'), borderLerp)['levels'];
          border.style(`padding: ${4 * borderLerp}px`);
          content.style(`padding: ${p.lerp(16, 12, borderLerp)}px`);
          content.style(`border-radius: ${p.lerp(24, 20, borderLerp)}px`);
          border.style(`background: rgba(${calced[0]}, ${calced[1]}, ${calced[2]}, ${calced[3] / 255})`);
        }
        /** 토스트 숨기기 */
        let hide_toast = () => {
          this.stack = [...this.stack, this.AlertNow, ...this.alert];
          this.AlertNow = null;
          this.alert.length = 0;
          this.isShowing = false;
          this.CurrentToast.remove();
        }
      }
      this.CurrentToast = new p5(_toast);
      this.isShowing = true;
    } else if (this.status == Status.FadeOut) {
      this.status = Status.DivFadeIn;
    }
  }

  /** 보여지는 토스트 알림을 숨깁니다 */
  hide() {
    this.status = Status.FadeOut;
  }

  /** HTML 내 특수 문자 허용
   * globalact 에서 관리해주나 순환성 문제로 직접 사용
   */
  HTMLEncode: Function;
}
