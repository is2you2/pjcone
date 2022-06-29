import { Component, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { RemoteControllerService, RemotePage } from 'src/app/remote-controller.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit, RemotePage {

  constructor(
    public alert: AlertController,
    public nav: NavController,
    public remote: RemoteControllerService,
  ) { }

  ngOnInit(): void { }

  ionViewWillEnter() {
    this.remote.target = this;
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
    // this.nakama.client.authenticateEmail(
    //   this.email, this.password, false
    // ).then((v) => {
    //   this.nakama.AuthSession = v;
    //   this.nav.navigateRoot('portal',
    //     {
    //       animated: true,
    //       animationDirection: 'forward',
    //     });
    // }).catch(e => {
    //   let opt: AlertOptions = {
    //     backdropDismiss: true,
    //   };
    //   switch (e.status) {
    //     case 400: // 누락된 정보가 있음 (비밀번호를 안썼거나 등등)
    //       opt['header'] = '불확실한 정보제공';
    //       opt['message'] = '이메일 형식, 비밀번호 형식을 맞추셨나요?';
    //       opt['buttons'] = ['앗'];
    //     case 401: // 비밀번호가 틀림
    //       opt['header'] = '계정정보 불일치';
    //       opt['message'] = '이메일과 비밀번호가 일치하지 않아요.';
    //       opt['buttons'] = ['음..?'];
    //     case 404: // 존재하지 않는 이메일
    //       opt['header'] = '존재하지 않는 이메일';
    //       opt['message'] = '일치하는 정보를 찾을 수 없습니다.';
    //       opt['buttons'] = ['저런'];
    //       break;
    //     case undefined: // 서버는 휴가중
    //       opt['header'] = '서버가 휴가중?';
    //       opt['message'] = '분명 어떤 이유가 있을꺼에요';
    //       opt['buttons'] = ['그럴 수 있지'];
    //       break;
    //     default: // 휴가중이 아니라면 일하는 것으로 간주
    //       opt['header'] = '개발자가 준비하지 못한 오류';
    //       opt['message'] = e.statusText;
    //       opt['buttons'] = ['이런!'];
    //       break;
    //   }
    //   this.isProgreessing = false;
    //   this.alert.create(opt).then(v => {
    //     v.present();
    //   });
    // });
  }
  /** 회원가입 페이지로 이동 */
  create_account() {
    this.remote.client.send('test');
  }
  remote_act: any = {
    'test': () => this.nav.navigateBack('test/test')
  };
}
