import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-before-register',
  templateUrl: './before-register.page.html',
  styleUrls: ['./before-register.page.scss'],
})
export class BeforeRegisterPage implements OnInit {

  constructor(public navCtrl: NavController,
  ) { }

  ngOnInit() {
  }

  // 이 곳에서 nakama 서버와 통신하여 이메일 요청을 검토한 후
  // 완료되면 회원 가입 페이지로 연결시킴
  CertificateWell() {
    console.log('정상적으로 인증이 완료됨');
  }

  // 아무 주소로 들어오면 그냥 혼내버려
  CertificateFailed() {
    console.error('누구세요?');
  }
}
