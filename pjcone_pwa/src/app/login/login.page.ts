import { Component, OnInit } from '@angular/core';
import { AlertController, AlertOptions, ModalController, NavController } from '@ionic/angular';
import { EmailCertPage } from '../email-cert/email-cert.page';
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
    public modalCtrl: ModalController,
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
    ).then((_status) => {
      if (_status == 0) { // 로그인 성공시
        this.navCtrl.navigateRoot('portal',
          {
            animated: true,
            animationDirection: 'forward',
          });
      } else { // 어떠한 이유로든 로그인 실패시
        let opt: AlertOptions = {
          backdropDismiss: true,
        };
        switch (_status) {
          case 400: // 누락된 정보가 있음 (비밀번호를 안썼거나 등등)
            opt['header'] = '불확실한 정보제공';
            opt['message'] = '이메일 형식, 비밀번호 형식에 맞추셨나요?'
            opt['buttons'] = ['앗']
          case 401: // 비밀번호가 틀림
            opt['header'] = '계정정보 불일치';
            opt['message'] = '이메일과 비밀번호가 일치하지 않아요.'
            opt['buttons'] = ['음..?']
          case 404: // 존재하지 않는 이메일
            opt['header'] = '존재하지 않는 이메일';
            opt['message'] = '일치하는 정보를 찾을 수 없습니다.'
            opt['buttons'] = ['저런']
            break;
          case undefined: // 서버는 휴가중
            opt['header'] = '서버가 휴가중?';
            opt['message'] = '그럴리가 없습니다. 인터넷 상태를 한 번 더 확인해주세요.'
            opt['buttons'] = ['그래요']
            break;
          default: // 휴가중이 아니라면 일하는 것으로 간주
            break;
        }
        this.isProgreessing = false;
        this.alert.create(opt).then(v => {
          v.present();
        });
      }
    });
  }
  /** 회원가입 페이지로 이동 */
  create_account() {
    this.isProgreessing = true;
    this.modalCtrl.create({
      component: EmailCertPage,
    }).then(v => {
      v.onDidDismiss().then((v) => {
        this.isProgreessing = false;
        if (v.data && v.data['email'])
          this.email = v.data.email;
      }).catch(e => {
        console.error('LoginFromRegisterModalDismiss 오류: ', e);
      });
      v.present();
    });
  }
}
