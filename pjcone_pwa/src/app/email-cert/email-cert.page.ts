import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { NakamaclientService } from '../nakamaclient.service';

@Component({
  selector: 'app-email-cert',
  templateUrl: './email-cert.page.html',
  styleUrls: ['./email-cert.page.scss'],
})
export class EmailCertPage implements OnInit {

  constructor(public nakama: NakamaclientService,
    public alert: AlertController,
    public modal: ModalController,
  ) { }
  ngOnInit() { }

  email: string = '';
  email_placeholder: string = '';

  OnCertClicked() {
    if (this.email == '') {
      this.email_placeholder = '이메일 주소를 입력해주세요';
      return;
    }
    console.log('이메일 인증 눌림');
    this.nakama.session_login(this.email, 'password').then(v => {
      switch (v) {
        case 400: // 누락된 정보가 있음 (비밀번호를 안썼거나 등등)
          this.alert.create({
            header: '이메일 형식 오류',
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
            this.modal.dismiss({
              email: this.email,
            });
            v.present();
          });
          break;
        case 404: // 존재하지 않는 이메일
          this.alert.create({
            header: '가입 메일 발송 요청됨',
            message: '인증 메일을 발송했습니다. 높은 확률로 스팸 편지함에 분류됩니다.',
            backdropDismiss: false,
            buttons: ['확인해볼께요']
          }).then(v => {
            v.present();
          });
          console.log('아이디가 없음, 이 때 email 발송처리를 하면 됨');
          this.modal.dismiss();
          break;
        case 0: // 정상 로그인? 어림도 없지
        default: // 기타 검토되지 않은 사유
          console.warn('예상하지 못한 세션로그인 반환값: ', v);
          break;
      }
    }).catch(e => {
      console.error('세션 로그인 오류: ', e);
    });
  }
}
