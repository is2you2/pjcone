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
    public navCtrl:NavController,
    ) { }

  ngOnInit() { }

  email: string = '';
  password: string = '';

  isProgreessing:boolean = false;

  email_placeholder:string = ''
  passwd_placeholder:string = ''

  ionViewDidEnter() {
    console.warn('클라이언트 init을 포털 페이지에서 해야합니다');
    this.nakama.client_init();
  }
  /** ### 로그인 시도  
   * 이 함수에서 입력된 정보를 검토해본다
   */
  try_login() {
    let checker:boolean = true;
    if(this.email.trim().length == 0){
      this.email_placeholder = '이메일을 입력해주세요';
      checker = false;
    }
    if(this.password.length == 0){
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
        this.navCtrl.navigateRoot('pjcone',
        {
          animated: true,
          animationDirection: 'forward',
        });
      } else { // 로그인 실패시
        this.isProgreessing = false;
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
    this.isProgreessing = true;
    console.log('회원가입 페이지로 이동하기');
    this.navCtrl.navigateForward('register');
  }
}
