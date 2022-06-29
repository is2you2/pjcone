import { Component, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  constructor(
    private alert: AlertController,
    private nav: NavController,
  ) { }

  ngOnInit(): void { }

  ionViewWillEnter() {
    this.isProgreessing = false;
  }

  isServerOnline: boolean = false;

  email: string = '';
  password: string = '';

  isProgreessing: boolean = false;

  email_placeholder: string = '';
  passwd_placeholder: string = '';

  /**
   * 입력칸에서 엔터를 눌러 행동하기
   * @param ev 키값
   */
  inputs(ev: number) {
    if (ev == 13 && !this.isProgreessing && this.email) { // 엔터키를 누르면
      if (this.password)
        this.try_login();
      else this.create_account();
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
  }
  /** 회원가입 페이지로 이동 */
  create_account() {
    if (this.email == '') {
      this.email_placeholder = '이메일을 입력해주세요';
      return;
    }
    this.isProgreessing = true;
  }
}
