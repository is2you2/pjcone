import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-email-cert',
  templateUrl: './email-cert.page.html',
  styleUrls: ['./email-cert.page.scss'],
})
export class EmailCertPage implements OnInit {

  constructor() { }
  ngOnInit() { }

  email: string = ''

  OnCertClicked() {
    console.log('이메일 인증 눌림');
  }
}
