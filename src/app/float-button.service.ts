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

  /** float-button 생성하기 */
  private CreateFloatButton() {
    this.p5canvas = new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
      }
    });
  }

  /** 새로운 FloatButton 생성
   * @returns 생성된 FloatButton: p5.Element
   */
  AddFloatButton(key: string, icon: string) {
    // 캔버스가 없으면 생성
    if (!this.p5canvas)
      this.CreateFloatButton();
    // 기존 버튼들의 위치 재조정
    for (let btn of this.ArrayKeys) {
      let top = this.Buttons[btn].style('right').split('px').shift();
      this.Buttons[btn].style(`right: ${top + 80}px`);
    }
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
    this.Buttons[key] = float_button;
    this.ArrayKeys.push(key);
    return float_button;
  }

  RemoveFloatButton(key: string) {
    // 버튼 개체 삭제
    if (this.Buttons[key])
      this.Buttons[key].remove();
    // 남아있는 버튼 개체들 재조정
    let RemovedIndex = -1;
    for (let i = this.ArrayKeys.length; i >= 0; i--) {
      if (RemovedIndex >= 0) {
        let top = this.Buttons[this.ArrayKeys[i]].style('right').split('px').shift();
        this.Buttons[this.ArrayKeys[i]].style(`right: ${top - 80}px`);
      }
      // 해당 키 정보 삭제하기
      if (this.ArrayKeys[i] == key) {
        this.ArrayKeys.splice(i, 1);
        RemovedIndex = i;
      }
    }
    if (!this.ArrayKeys.length && this.p5canvas)
      this.p5canvas.remove();
  }
}
