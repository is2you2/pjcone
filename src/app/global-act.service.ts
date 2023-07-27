// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';
import { LanguageSettingService } from './language-setting.service';
import { P5ToastService } from './p5-toast.service';
import * as QRCode from "qrcode-svg";
import { DomSanitizer } from '@angular/platform-browser';
import * as p5 from "p5";

export var isDarkMode = false;

/** 컨텐츠 제작자 기록 틀 */
export interface ContentCreatorInfo {
  /** 콘텐츠 작성 당시 사용한 이름 */
  display_name: string;
  /** 등록일자 */
  timestamp: string;
  /** 공유되는 서버 기반 uid */
  user_id?: string;
}

/** 뷰어 동작 호완을 위한 틀 */
export interface FileInfo {
  filename?: string;
  type?: string;
  file_ext?: string;
  /** 전체 파일 크기 */
  size?: number;
  /** 썸네일 구분용 헤더 */
  typeheader?: string;
  /** 작업 참여자, 또는 이 작업과 연관된 사람들 */
  content_related_creator?: ContentCreatorInfo[];
  /** 콘텐츠를 업로드한 사람, 또는 제작자 */
  content_creator?: ContentCreatorInfo;
  /** 파일 분할 크기 */
  partsize?: number;
  path?: string;
  base64?: string;
  /** 간소화 썸네일 (ObjectURL) */
  thumbnail?: any;
  /** 뷰어 구분자 */
  viewer?: string;
}

/** 고도엔진과 공유되는 키값 */
interface GodotFrameKeys {
  /** 외부 패키지 주소 */
  url?: string;
  /** 내부 패키지 주소, url 에 주소를 생성하여 부여 */
  local_url?: string;
  /** 프로젝트 콘 로고 강제 */
  force_logo?: boolean;
  /** 불러와야하는 pck 경로 강제 */
  pck_path?: string;
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

  /** json을 받아서 QR코드 이미지로 돌려주기  
   * 선택적 반환: QRCode 이미지 또는 오류 메시지
   */
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
        text: `${this.lang.text['GlobalAct']['failed_to_gen_qr']}: ${e}`,
      });
    }
  }

  /** 문자열을 받아서 QR코드 이미지로 돌려주기  
   * 선택적 반환: QRCode 이미지 또는 오류 메시지
   */
  readasQRCodeFromString(str: any) {
    try {
      let qr: string = new QRCode({
        content: str,
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
        text: `${this.lang.text['GlobalAct']['failed_to_gen_qr']}: ${e}`,
      });
    }
  }

  godot_splash: p5;
  /** 실행중인 iframe-godot 개체를 기억하여 2개 이상 생성될 경우 이전에 진행중인 객체를 삭제, 마지막 실행기만 기억하기 */
  godot: HTMLIFrameElement;
  godot_window: any;
  /** 마지막에 기록된 프레임 id */
  last_frame_name: string;
  /** 고도엔진이 시작하자마자 로딩할 내용과 고도 결과물을 담을 iframe id를 전달  
   * 이 함수는 고도엔진이 실행되는 페이지의 ionViewWillEnter()에서 진행되어야 합니다
   * @param _act_name 로딩할 pck 파일의 이름
   * @param _frame_name 고도 결과물을 담으려는 div id
   * @param keys 고도엔진 iframe.window에 작성될 값들
   * @returns iframe 개체 돌려주기
   */
  CreateGodotIFrame(_frame_name: string, keys: GodotFrameKeys, waiting_key: string = ''): Promise<any> {
    let ready_to_show = false;
    return new Promise((done: any) => {
      let refresh_it_loading = () => {
        try {
          if (window['godot'] != 'godot')
            throw 'No godot';
          if (waiting_key && !this.godot_window[waiting_key])
            throw 'No act ready';
          ready_to_show = true;
          done();
        } catch (e) {
          setTimeout(() => {
            refresh_it_loading();
          }, 1000);
        }
      }
      if (this.last_frame_name == _frame_name && this.godot.isConnected) {
        done();
        return;
      };
      if (this.godot_splash) this.godot_splash.remove();
      if (this.godot) this.godot.remove();
      window['godot'] = '';
      this.last_frame_name = _frame_name;
      let _godot = document.createElement('iframe');
      _godot.id = 'godot';
      _godot.setAttribute("src", "assets/html/index.html");
      _godot.setAttribute("frameborder", "0");
      _godot.setAttribute('class', 'full_screen');
      _godot.setAttribute('allow', 'fullscreen; encrypted-media');
      _godot.setAttribute('scrolling', 'no');
      _godot.setAttribute('withCredentials', 'true');
      if (keys.local_url) keys['url'] = `${window.location.protocol}//${window.location.host}${window['sub_path']}${keys['local_url']}`;
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
      this.godot_splash = new p5((p: p5) => {
        let icon: p5.Image;
        let loading_size = 8;
        let loading_corner = 2;
        let loading_dist = 6;
        p.setup = () => {
          let canvas = p.createCanvas(frame.clientWidth, frame.clientHeight);
          canvas.parent(frame);
          canvas.style('position: absolute; left: 0;');
          p.imageMode(p.CENTER);
          p.rectMode(p.CENTER);
          p.noStroke();
          p.loadImage(keys.force_logo ? 'assets/icon/favicon.png' : `assets/icon/${_frame_name}.png`, v => {
            icon = v;
          });
        }
        let FadeLerp = 2;
        let loadingRot = 0;
        let splash_bg_color = isDarkMode ? 80 : 200;
        let loading_box = isDarkMode ? 200 : 80;
        p.draw = () => {
          p.clear(255, 255, 255, 255);
          p.background(splash_bg_color, p.constrain(255 * FadeLerp, 0, 255));
          p.tint(255, p.constrain(255 * FadeLerp, 0, 255));
          if (icon) p.image(icon, p.width / 2, p.height / 2);
          p.push();
          p.translate(p.width / 2, p.height / 2 + 80);
          loadingRot += .07;
          p.rotate(loadingRot);
          p.fill(loading_box, p.constrain(255 * FadeLerp, 0, 255));
          p.push();
          p.translate(-loading_dist, -loading_dist);
          p.rotate(-loadingRot * 2);
          p.rect(0, 0, loading_size, loading_size, loading_corner);
          p.pop();
          p.push();
          p.translate(loading_dist, -loading_dist);
          p.rotate(-loadingRot * 2);
          p.rect(0, 0, loading_size, loading_size, loading_corner);
          p.pop();
          p.push();
          p.translate(-loading_dist, loading_dist);
          p.rotate(-loadingRot * 2);
          p.rect(0, 0, loading_size, loading_size, loading_corner);
          p.pop();
          p.push();
          p.translate(loading_dist, loading_dist);
          p.rotate(-loadingRot * 2);
          p.rect(0, 0, loading_size, loading_size, loading_corner);
          p.pop();
          p.pop();
          if (ready_to_show) {
            FadeLerp -= .04;
            if (FadeLerp <= 0)
              p.remove();
          }
        }
        p.windowResized = () => {
          p.resizeCanvas(frame.clientWidth, frame.clientHeight);
        }
      });
      refresh_it_loading();
    });
  }

  /** 메시지에 썸네일 콘텐츠를 생성 */
  modulate_thumbnail(msg_content: any, ObjectURL: string) {
    switch (msg_content['viewer']) {
      case 'image':
        msg_content['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(ObjectURL);
        setTimeout(() => {
          URL.revokeObjectURL(ObjectURL);
        }, 100);
        break;
      case 'text':
        new p5((p: p5) => {
          p.setup = () => {
            p.loadStrings(ObjectURL, v => {
              msg_content['text'] = v;
              URL.revokeObjectURL(ObjectURL);
              p.remove();
            }, e => {
              console.log('텍스트 열람 불가: ', e);
              msg_content['text'] = [this.lang.text['ChatRoom']['downloaded']];
              URL.revokeObjectURL(ObjectURL);
              p.remove();
            });
          }
        });
        break;
      default:
        URL.revokeObjectURL(ObjectURL);
        break;
    }
  }

  /** 콘텐츠 카테고리 분류  
   * type 키를 검토한 후 file_ext 를 이용하여 검토
   */
  set_viewer_category(msg_content: any) {
    try { // 자동지정 타입이 있는 경우
      if (msg_content['type'].indexOf('image/') == 0) // 분류상 이미지
        msg_content['viewer'] = 'image';
      else if (msg_content['type'].indexOf('audio/') == 0) // 분류상 소리
        msg_content['viewer'] = 'audio';
      else if (msg_content['type'].indexOf('video/') == 0) // 분류상 비디오
        msg_content['viewer'] = 'video';
      else if (msg_content['type'].indexOf('text/') == 0) // 분류상 텍스트 문서
        msg_content['viewer'] = 'text';
      else throw "자동지정되지 않은 타입";
    } catch (_e) { // 자동지정 타입이 없는 경우
      this.set_viewer_category_from_ext(msg_content);
    }
  }

  /** 파일 이름의 확장자 부분으로부터 뷰어 카테고리를 분류 */
  set_viewer_category_from_ext(info: any) {
    switch (info['file_ext']) {
      // 모델링류
      // case 'obj':
      // case 'stl':
      // case 'glb':
      // case 'gltf':
      // 고도엔진 패키지 파일
      case 'pck':
        info['viewer'] = 'godot';
        break;
      // 이미지류
      case 'png':
      case 'jpeg':
      case 'jpg':
      case 'webp':
      case 'gif':
        info['viewer'] = 'image';
        break;
      // 사운드류
      case 'wav':
      case 'ogg':
      case 'mp3':
        info['viewer'] = 'audio';
        break;
      // 비디오류
      case 'mp4':
      case 'ogv':
      case 'webm':
        info['viewer'] = 'video';
        break;
      // 마크다운
      case 'md':
      // 텍스트류
      case 'txt':
      case 'cs':
      case 'gd':
      case 'py':
      case 'yml':
      case 'gitignore':
      case 'json':
      case 'csv':
      case 'ts':
      case 'js':
      case 'shader':
        info['viewer'] = 'text';
        break;
      default: // 뷰어 제한 파일
        info['viewer'] = 'disabled';
        break;
    }
  }

  /** base64 정보를 반환하는 간단한 코드 */
  GetBase64ThroughFileReader(file: any): Promise<string> {
    return new Promise((done, error) => {
      let reader: any = new FileReader();
      reader = reader._realReader ?? reader;
      reader.onload = (ev: any) => {
        done(ev.target.result.replace(/"|\\|=/g, ''));
      }
      reader.onerror = (ev: any) => {
        error(ev);
      }
      reader.readAsDataURL(file);
    });
  }
}
