import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AppComponent, SOCKET_SERVER_ADDRESS } from '../app.component';

/** 회원가입 페이지, 이메일 인증을 통해서만 들어오게 되어있음 */
@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

  /** 입력된 사용자 정보 */
  userInfo = {
    email: '',
  }

  constructor(
    private get: AppComponent,
    private nav: NavController,
  ) { }

  ngOnInit() {
    this.CertificateEmail();
  }

  /** 이메일로 진입한 경우 대처하기 */
  CertificateEmail() {
    let data: any = this.get.CatchGETs();
    // 데이터 형식 검토하기, 일단은 필수요건 검토로 진행
    if ('list' in data && 'token' in data) {
      let CertSocket = new WebSocket(`ws://${SOCKET_SERVER_ADDRESS}:12010`);
      CertSocket.onopen = (_v) => {
        let cert = {
          act: 'register',
          token: data['token'][0],
          list: data['list'][0]
        }
        CertSocket.send(JSON.stringify(cert));
      }
      CertSocket.onclose = (v) => {
        if (v.code == 4000) {
          let l = v.reason.length;
          this.userInfo.email = v.reason.substring(0, l - 1);
        }
      }
    } else { // 필수 요건에 맞지 않으면 돌려보내기
      this.nav.navigateRoot('');
    }
  }

}
