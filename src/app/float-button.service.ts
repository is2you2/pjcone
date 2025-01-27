import { Injectable } from '@angular/core';
import * as p5 from 'p5';

@Injectable({
  providedIn: 'root'
})
export class FloatButtonService {

  constructor() { }

  p5canvas: p5;
  /** 준비된 버튼들 */
  Buttons = {};
  /** 버튼이 추가된 순서 */
  ArrayKeys = [];
  /** 애니메이션 행동을 p5에 보내기 */
  private AddAnimateActFunc: Function;
  /** 이 버튼을 추가하고 추가 애니메이션 재생 */
  private AddButtonQueue: Function;
  /** 이 버튼을 제거하고 제거 애니메이션 재생 */
  private RemoveButtonQueue: Function;
  /** 마지막에 삭제하려는 버튼 정보 표시 */
  private LastRemoveKey: string;
  /** 마지막에 지우게될 버튼 개체 기억 */
  private LastRemoveQueue: p5.Element;

  /** float-button 생성하기 */
  private CreateFloatButton() {
    this.p5canvas = new p5((p: p5) => {
      /** 이 버튼들은 애니메이션에 사용됩니다 */
      let AnimatedButton = [];
      let AddButtonOtherAct = (info: any) => {
        AnimatedButton.push(info);
        AnimLerp = 0;
        p.loop();
      }
      let LastAddedQueue: p5.Element;
      let AddButtonAnim = (button: p5.Element) => {
        LastAddedQueue = button;
        button.style('transform-origin', '50% 50%');
        button.style('opacity', '0');
        button.style('transform', 'scale(0)')
        AnimLerp = 0;
        p.loop();
      }
      let RemoveButtonAnim = () => {
        this.LastRemoveQueue.style('transform-origin', '50% 50%');
        this.LastRemoveQueue.style('opacity', '1');
        this.LastRemoveQueue.style('transform', 'scale(1)')
        AnimLerp = 0;
        p.loop();
      }
      p.setup = () => {
        p.noCanvas();
        this.AddAnimateActFunc = AddButtonOtherAct;
        this.AddButtonQueue = AddButtonAnim;
        this.RemoveButtonQueue = RemoveButtonAnim;
        p.noLoop();
      }
      let AnimLerp = 0;
      let asSineGraph = (t: number) => {
        return p.sin(t * p.PI / 2);
      }
      p.draw = () => {
        AnimLerp += .07;
        let EndAnim = AnimLerp >= 1;
        if (EndAnim) {
          AnimLerp = 1;
          if (LastAddedQueue)
            LastAddedQueue = null;
          if (this.LastRemoveQueue) {
            this.LastRemoveQueue.remove();
            this.LastRemoveQueue = null;
            this.LastRemoveKey = null;
            this.RemoveLock = false;
            if (!this.ArrayKeys.length && this.p5canvas)
              this.p5canvas.remove();
          }
          p.noLoop();
        }
        if (LastAddedQueue) {
          LastAddedQueue.style('opacity', `${AnimLerp}`);
          LastAddedQueue.style('transform', `scale(${asSineGraph(AnimLerp)})`);
        }
        if (this.LastRemoveQueue) {
          this.LastRemoveQueue.style('opacity', `${1 - AnimLerp}`);
          this.LastRemoveQueue.style('transform', `scale(${asSineGraph(1 - AnimLerp)})`);
        }
        for (let i = AnimatedButton.length - 1; i >= 0; i--) {
          let right = p.lerp(AnimatedButton[i].start, AnimatedButton[i].end, asSineGraph(AnimLerp))
          AnimatedButton[i].button.style(`right: ${right}px`);
        }
        if (EndAnim) AnimatedButton.length = 0;
      }
    });
  }

  /** 새로운 FloatButton 생성
   * @returns 생성된 FloatButton: p5.Element
   */
  AddFloatButton(key: string, icon: string) {
    if (this.LastRemoveKey == key) return;
    // 캔버스가 없으면 생성
    if (!this.p5canvas)
      this.CreateFloatButton();
    // 기존 버튼들의 위치 재조정
    for (let i = this.ArrayKeys.length - 1; i >= 0; i--)
      this.AddAnimateActFunc({
        type: 'add',
        button: this.Buttons[this.ArrayKeys[i]],
        start: (i + 1),
        end: (i + 1) + 80,
      });
    // 새 버튼 생성
    let float_button = this.p5canvas.createDiv(`<ion-icon style="width: 36px; height: 36px" name="${icon}"></ion-icon>`);
    float_button.style("position: absolute; right: 0; bottom: 56px; z-index: 1");
    float_button.style("width: 64px; height: 64px");
    float_button.style("text-align: center; align-content: center");
    float_button.style("cursor: pointer");
    float_button.style("margin: 16px");
    float_button.style("padding-top: 6px");
    float_button.style("background-color: #8888");
    float_button.style("border-radius: 24px");
    this.AddButtonQueue(float_button);
    this.Buttons[key] = float_button;
    this.ArrayKeys.push(key);
    return float_button;
  }

  /** 버튼 삭제 관리 */
  RemoveLock = false;
  RemoveFloatButton(key: string) {
    // 버튼 개체 삭제
    if (!this.Buttons[key]) return;
    if (this.RemoveLock) return;
    this.RemoveLock = true;
    this.LastRemoveKey = key;
    this.LastRemoveQueue = this.Buttons[key];
    delete this.Buttons[key];
    // 남아있는 버튼 개체들 재조정
    let RemovedIndex = -1;
    for (let i = this.ArrayKeys.length - 1; i >= 0; i--) {
      if (RemovedIndex >= 0)
        this.AddAnimateActFunc({
          type: 'remove',
          button: this.Buttons[this.ArrayKeys[i]],
          start: (i + 1) * 80,
          end: (i + 1) * 80 - 80,
        });
      // 해당 키 정보 삭제하기
      if (this.ArrayKeys[i] == key) {
        this.RemoveButtonQueue();
        this.ArrayKeys.splice(i, 1);
        RemovedIndex = i;
      }
    }
  }
}
