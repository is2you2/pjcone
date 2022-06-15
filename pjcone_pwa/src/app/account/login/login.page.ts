import { Component, OnInit } from '@angular/core';
import { AlertController, AlertOptions, NavController } from '@ionic/angular';
import { NakamaclientService } from '../../nakamaclient.service';
import { WscService } from 'src/app/wsc.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  constructor(public nakama: NakamaclientService,
    public alert: AlertController,
    public nav: NavController,
    public client: WscService,
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
    if (ev == 13 && this.email) { // 엔터키를 누르면
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
    this.nakama.client.authenticateEmail(
      this.email, this.password, false
    ).then((v) => {
      this.nakama.AuthSession = v;
      this.nav.navigateRoot('portal',
        {
          animated: true,
          animationDirection: 'forward',
        });
    }).catch(e => {
      let opt: AlertOptions = {
        backdropDismiss: true,
      };
      switch (e.status) {
        case 400: // 누락된 정보가 있음 (비밀번호를 안썼거나 등등)
          opt['header'] = '불확실한 정보제공';
          opt['message'] = '이메일 형식, 비밀번호 형식을 맞추셨나요?';
          opt['buttons'] = ['앗'];
        case 401: // 비밀번호가 틀림
          opt['header'] = '계정정보 불일치';
          opt['message'] = '이메일과 비밀번호가 일치하지 않아요.';
          opt['buttons'] = ['음..?'];
        case 404: // 존재하지 않는 이메일
          opt['header'] = '존재하지 않는 이메일';
          opt['message'] = '일치하는 정보를 찾을 수 없습니다.';
          opt['buttons'] = ['저런'];
          break;
        case undefined: // 서버는 휴가중
          opt['header'] = '서버가 휴가중?';
          opt['message'] = '분명 어떤 이유가 있을꺼에요';
          opt['buttons'] = ['그럴 수 있지'];
          break;
        default: // 휴가중이 아니라면 일하는 것으로 간주
          opt['header'] = '개발자가 준비하지 못한 오류';
          opt['message'] = e.statusText;
          opt['buttons'] = ['이런!'];
          break;
      }
      this.isProgreessing = false;
      this.alert.create(opt).then(v => {
        v.present();
      });
    });
  }
  /** 회원가입 페이지로 이동 */
  create_account() {
    if (this.email == '') {
      this.email_placeholder = '이메일을 입력해주세요';
      return;
    }
    this.isProgreessing = true;
    this.nakama.client.authenticateEmail(this.email, 'password', false).catch(e => {
      switch (e.status) {
        case 400: // 누락된 정보가 있음 (비밀번호를 안썼거나 등등)
          this.alert.create({
            header: '형식 오류',
            message: '뭔가 잘못 적으신거 같아요',
            buttons: ['어라?']
          }).then(v => {
            v.present();
          });
          break;
        case 401: // 비밀번호가 틀림
          this.alert.create({
            header: '이미 가입된 이메일',
            message: '그렇습니다.',
            buttons: ['그렇습니까?']
          }).then(v => {
            v.present();
          });
          break;
        case 404: // 존재하지 않는 이메일 아이디, 회원가입 가능
          let closeCall = {
            1006: () => {
              this.alert.create({
                header: '메일 서버 점검중',
                message: '관리자에게 문의해주세요.',
                backdropDismiss: false,
                buttons: ['창 닫기']
              }).then(v => {
                v.present();
              })
            },
            4000: () => {
              this.alert.create({
                header: '가입 메일 발송 요청됨',
                message: '인증 메일을 발송했습니다. 높은 확률로 스팸 편지함에 분류됩니다.',
                backdropDismiss: false,
                buttons: ['확인해볼께요']
              }).then(v => {
                console.log('아이디가 없음, 이 때 email 발송처리를 하면 됨');
                v.present();
              });
            }
          }
          this.client.initialize('is2you2.iptime.org', 8888, this.email, closeCall);
          break;
        case undefined: // 연결 끊김
          this.alert.create({
            header: '서버와 연결 끊김',
            message: '서버가 반응하지 않아요..',
            buttons: ['왜 하필 지금..']
          }).then(v => {
            v.present();
          });
          break;
        case 0: // 정상 로그인? 어림도 없지
        default: // 기타 검토되지 않은 사유
          console.warn('예상하지 못한 세션로그인 반환값: ', e);
          break;
      }
      this.isProgreessing = false;
    });
  }
}
