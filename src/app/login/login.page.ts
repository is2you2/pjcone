import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { NakamaclientService } from '../nakamaclient.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  constructor(public nakama: NakamaclientService,
    public alert: AlertController) { }

  ngOnInit() { }

  email: string
  password: string

  ionViewDidEnter() {
    this.nakama.client_init();
  }
  /** ### 로그인 시도  
   * 이 함수에서 입력된 정보를 검토해본다
   */
  try_login() {
    console.log('이 자리에서 입력된 정보 검토처리');
    this.login();
  }
  /** 입력된 정보로 로그인하기 */
  login() {
    this.nakama.session_login(
      this.email,
      this.password,
    ).then((_session) => {
      console.log('세션 접속 정보: ', _session);
      if (_session) { // 로그인 성공시
        this.alert.create({
          header: '로그인 성공',
          subHeader: 'sub-header',
          message: 'msg',
          buttons: ['확인'],
          backdropDismiss: true,
          translucent: true,
          animated: true,
          keyboardClose: true,
          id: 'id',
        }).then(v => {
          v.present();
        });
      } else { // 로그인 실패시
        this.alert.create({
          header: '로그인 실패',
          subHeader: 'sub-header',
          message: 'msg',
          buttons: ['이런!'],
          backdropDismiss: true,
          translucent: true,
          animated: true,
          keyboardClose: true,
          id: 'id',
        }).then(v => {
          v.present();
        });
      }
    });
  }
  /** 회원가입 페이지로 이동 */
  create_account() {
    console.log('회원가입 페이지로 이동하기');
  }
}
