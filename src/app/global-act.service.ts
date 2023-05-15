// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';
import { LanguageSettingService } from './language-setting.service';
import { P5ToastService } from './p5-toast.service';
import * as QRCode from "qrcode-svg";
import { DomSanitizer } from '@angular/platform-browser';

export var isDarkMode = false;

/** 고도엔진과 공유되는 키값 */
interface GodotFrameKeys {
  /** 공식 패키지 이름 */
  act: string;
  /** 패키지 이름 입력(영문), 고도 프로젝트에서는 메인 씬 이름이어야함 */
  title: string;
  /** 패키지 불러오기 행동 실패시 실행됨, 사용금지 */
  failed?: any;
  /** 고도엔진과 상호작용하기 위한 값들, 고도엔진에서 JavaScript.get_interface('window')[id]로 접근 */
  [id: string]: any;
}

/** 어느 페이지에든 행동할 가능성이 있는 공용 함수 모음 */
@Injectable({
  providedIn: 'root'
})
export class GlobalActService {

  constructor(
    private p5toast: P5ToastService,
    private lang: LanguageSettingService,
    private sanitizer: DomSanitizer,
  ) {
    isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

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

  /** json을 받아서 QR코드 이미지로 돌려주기 */
  readasQRCodeFromId(json: any) {
    try {
      let qr: string = new QRCode({
        content: `[${JSON.stringify(json)}]`,
        padding: 4,
        width: 8,
        height: 8,
        color: isDarkMode ? "#bbb" : '#444',
        background: isDarkMode ? "#111" : '#fff',
        ecl: "M",
      }).svg();
      return this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;base64,${btoa(qr)}`);
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['LinkAccount']['failed_to_gen_qr']}: ${e}`,
      });
    }
  }

  /** 실행중인 iframe-godot 개체를 기억하여 2개 이상 생성될 경우 이전에 진행중인 객체를 삭제, 마지막 실행기만 기억하기 */
  godot: HTMLIFrameElement;
  godot_window: any;
  /** 마지막에 기록된 프레임 id */
  private last_frame_name: string;
  /** 고도엔진이 시작하자마자 로딩할 내용과 고도 결과물을 담을 iframe id를 전달  
   * 이 함수는 고도엔진이 실행되는 페이지의 ionViewWillEnter()에서 진행되어야 합니다
   * @param _act_name 로딩할 pck 파일의 이름
   * @param _frame_name 고도 결과물을 담으려는 div id
   * @param keys 고도엔진 iframe.window에 작성될 값들
   * @returns iframe 개체 돌려주기
   */
  CreateGodotIFrame(_frame_name: string, keys: GodotFrameKeys) {
    if (this.last_frame_name == _frame_name && this.godot.isConnected) return;
    if (this.godot) this.godot.remove();
    this.last_frame_name = _frame_name;
    let _godot = document.createElement('iframe');
    _godot.id = 'godot';
    _godot.setAttribute("src", "assets/html/index.html");
    _godot.setAttribute("frameborder", "0");
    _godot.setAttribute('class', 'full_screen');
    _godot.setAttribute('allow', 'fullscreen; encrypted-media');
    _godot.setAttribute('scrolling', 'no');
    _godot.setAttribute('withCredentials', 'true');
    keys['failed'] = () => {
      this.p5toast.show({
        text: `${this.lang.text['GlobalAct']['FailedToDownloadGodot']}: ${keys.title}`,
        lateable: true,
      });
    }
    let frame = document.getElementById(_frame_name);
    frame.appendChild(_godot);
    this.godot_window = _godot.contentWindow || _godot.contentDocument;
    let _keys = Object.keys(keys);
    _keys.forEach(key => this.godot_window[key] = keys[key]);
    this.godot = _godot;
    return _godot;
  }
}
