import { Component, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { NakamaclientService } from '../nakamaclient.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  constructor(public nakama: NakamaclientService,
    public alert: AlertController,
    public navCtrl: NavController,
  ) { }

  ngOnInit() { }

  isServerOnline: boolean = false;

  email: string = '';
  password: string = '';

  isProgreessing: boolean = false;

  email_placeholder: string = '';
  passwd_placeholder: string = '';

  ionViewDidEnter() {
    this.initialized_client();
  }
  async initialized_client() {
    if (await this.nakama.client_init()) {
      console.log('initialize 정상 로그, 이제 로그인할 수 있도록 입력을 해제하세요');
      this.isServerOnline = true;
    } else {
      this.alert.create({
        header: '서버 휴가중',
        message: '활동할 수는 없지만 마지막 기록들을 토대로 페이지를 돌아다닐 수 있습니다.',
        backdropDismiss: false,
        buttons: [{
          handler: v => {
            this.navCtrl.navigateRoot('portal', {
              animated: true,
              animationDirection: 'forward',
            });
          },
          text: '오케이~',
        }]
      }).then(v => {
        v.present();
      });
    }
  }
  /** ### 로그인 시도  
   * 이 함수에서 입력된 정보를 검토해본다
   */
  try_login() {
    let checker: boolean = true;
    if (this.email.trim().length == 0) {
      this.email_placeholder = '이메일을 입력해주세요';
      checker = false;
    }
    if (this.password.length == 0) {
      this.passwd_placeholder = '비밀번호를 입력해주세요';
      checker = false;
    }
    if (checker)
      this.login();
  }
  /** 입력된 정보로 로그인하기 */
  login() {
    this.isProgreessing = true;
    this.nakama.session_login(
      this.email,
      this.password,
    ).then((_session) => {
      if (_session) { // 로그인 성공시
        this.navCtrl.navigateRoot('portal',
          {
            animated: true,
            animationDirection: 'forward',
          });
      } else { // 어떠한 이유로든 로그인 실패시
        this.isProgreessing = false;
        this.alert.create({
          header: '로그인 실패',
          message: '일치하는 정보를 찾을 수 없습니다.',
          backdropDismiss: true,
          buttons: ['저런']
        }).then(v => {
          v.present();
        });
      }
    });
  }
  /** 회원가입 페이지로 이동 */
  create_account() {
    this.isProgreessing = true;
    this.navCtrl.navigateForward('register');
  }
}
