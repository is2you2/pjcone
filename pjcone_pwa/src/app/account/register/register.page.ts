import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { NakamaclientService } from '../../nakamaclient.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

  constructor(public nakama: NakamaclientService,
    public modalCtrl: ModalController,
  ) { }

  /** 사용자 입력 데이터 */
  user = {
    'email': '',
    'password': '',
    'password_retry': '',
    'nickname': '',
    'sex': '',
  };

  placeholder = {
    'email': '',
    'password': '',
    'password_retry': '',
    'nickname': '',
  };

  ngOnInit() { }

  OnClickRegister() {
    console.log('정보 입력됨: ', this.user);

    if (!this.user.email || !this.user.password || !this.user.password_retry || !this.user.nickname) {
      console.log('입력 비어있음');
      return; // 입력이 없는 경우 진행 불가
    }
    if (this.user.password != this.user.password_retry) {
      console.log('비밀번호 확인 실패');
      return; // 비밀번호와 확인이 불일치인 경우 진행 불가
    }

    this.modalCtrl.dismiss({
      'email': this.user.email,
      'password': this.user.password,
    });
  }
}
