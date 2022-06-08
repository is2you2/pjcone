import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { AppComponent } from 'src/app/app.component';
import { NakamaclientService } from '../../nakamaclient.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

  constructor(public nakama: NakamaclientService,
    public modalCtrl: ModalController,
    public deeplink: AppComponent,
    public alert: AlertController,
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

  ngOnInit() {
    let GETs = this.deeplink.CatchGETs();
    if (GETs['target']) {
      try {
        this.user.email = atob(GETs['target']);
      } catch (error) {
        this.UnexceptedAccess();
      }
    } else {
      this.UnexceptedAccess();
    }
  }

  /** 정상적인 접근이 아니라면 알려주고 메인 페이지로 날림 */
  UnexceptedAccess() {
    this.alert.create({
      header: '잘못된 접근',
      message: '올바른 경로로 접근하지 않았습니다',
      backdropDismiss: false,
      buttons: [{
        handler: () => {
          location.href = 'http://172.30.1.49:8100/';
        },
        text: '확인',
      }]
    }).then(v => {
      v.present();
    });
  }

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
