import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GlobalActService {

  constructor() { }


  /** 브라우저에서 딥 링크마냥 행동하기
   * @returns GET 으로 작성된 key-value 쌍
  */
  CatchGETs() {
    /** 입력된 주소 */
    const ADDRESS = location.href;
    const sepElement = ADDRESS.split('?');
    if (sepElement.length > 1) {
      const CatchGETs = sepElement[1].split('&');
      let gets = {};
      for (let i = 0, j = CatchGETs.length; i < j; i++) {
        const KeyVal = CatchGETs[i].split('=');
        if (!gets[KeyVal[0]])
          gets[KeyVal[0]] = [];
        gets[KeyVal[0]].push(KeyVal[1]);
      }
      return gets;
    }
  }

  /** 실행중인 iframe-godot 개체를 기억하여 2개 이상 생성될 경우 이전에 진행중인 객체를 삭제, 마지막 실행기만 기억하기 */
  private godot: HTMLIFrameElement;
  /** 마지막에 기록된 프레임 id */
  private last_frame_name: string;
  /** 고도엔진이 시작하자마자 로딩할 내용과 고도 결과물을 담을 iframe id를 전달  
   * 이 함수는 고도엔진이 실행되는 페이지의 ionViewWillEnter()에서 진행되어야 합니다
   * @param _act_name 로딩할 pck 파일의 이름
   * @param _frame_name 고도 결과물을 담으려는 div id
   * @returns iframe 개체 돌려주기
   */
  CreateGodotIFrame(_act_name: string, _frame_name: string) {
    localStorage.setItem('godot', _act_name);
    if (this.last_frame_name == _frame_name) return;
    if (this.godot) this.godot.remove();
    this.last_frame_name = _frame_name;
    let _godot: HTMLIFrameElement = document.createElement('iframe');
    _godot.id = 'godot';
    _godot.setAttribute("src", "assets/html/index.html");
    _godot.setAttribute("frameborder", "0");
    _godot.setAttribute('class', 'full_screen');
    let frame = document.getElementById(_frame_name);
    frame.appendChild(_godot);
    this.godot = _godot;
    return _godot;
  }
}
