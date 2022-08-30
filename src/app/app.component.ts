import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Platform } from '@ionic/angular';
import { LocalNotiService } from './local-noti.service';
import { NakamaService } from './nakama.service';
import { WscService } from './wsc.service';
/** 페이지가 돌고 있는 플렛폼 구분자 */
export var isPlatform: 'Android' | 'iOS' | 'DesktopPWA' | 'MobilePWA' = 'DesktopPWA';
/** 소켓서버용 */
export const SOCKET_SERVER_ADDRESS: string = 'pjcone.ddns.net'; // http:// 와 같은 헤더 없이 주소만
/** 이미지 등 자료 링크용(웹 사이트 host) */
export const SERVER_PATH_ROOT: string = 'https://is2you2.github.io/';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(platform: Platform,
    router: Router,
    ngZone: NgZone,
    noti: LocalNotiService,
    client: WscService,
    bgmode: BackgroundMode,
    nakama: NakamaService,
  ) {
    if (platform.is('desktop'))
      isPlatform = 'DesktopPWA';
    else if (platform.is('mobileweb'))
      isPlatform = 'MobilePWA';
    else if (platform.is('android'))
      isPlatform = 'Android';
    else if (platform.is('iphone'))
      isPlatform = 'iOS';
    noti.initialize();
    client.initialize();
    nakama.initialize();
    // 모바일 기기 특정 설정
    if (isPlatform == 'Android' || isPlatform == 'iOS') {
      App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        ngZone.run(() => {
          // Example url: https://beerswift.app/tabs/tab2
          // slug = /tabs/tab2
          const slug = event.url.split(".app").pop();
          if (slug) {
            router.navigateByUrl(slug);
          }
          // If no match, do nothing - let regular routing
          // logic take over
        });
      });
    }
    bgmode.setDefaults({
      title: '온라인 유지중',
      text: '앱에서 알림을 받을 수 있습니다.',
      icon: 'icon_mono',
      color: 'ffd94e', // 모자 밑단 노란색
    });
    bgmode.enable();
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

  /** 실행중인 iframe-godot 개체를 기억하여 2개 이상 생성될 경우 이전에 진행중인 객체를 삭제, 마지막 실행기만 기억하기 */
  private godot: HTMLIFrameElement;
  /** 마지막에 기록된 프레임 id */
  private last_frame_name: string;
  /** 고도엔진이 시작하자마자 로딩할 내용과 고도 결과물을 담을 iframe id를 전달  
   * 이 함수는 고도엔진이 실행되는 페이지의 ionViewWillEnter()에서 진행되어야 합니다
   * @param _act_name 로딩할 pck 파일의 이름
   * @param _frame_name 고도 결과물을 담으려는 div id
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
  }
}
