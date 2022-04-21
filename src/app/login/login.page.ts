import { Component, OnInit } from '@angular/core';
import { NakamaclientService } from '../nakamaclient.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  constructor(public nakama: NakamaclientService) { }

  ngOnInit() { }

  ionViewDidEnter() {
    this.nakama.client_init();
    //// 테스트 로그인
    this.nakama.session_login(
      'liss22@hanmail.net',
      'response1!',
    ).then((_session) => {
      console.log('세션 접속 정보: ', _session);
    });
    ///////
  }
}
