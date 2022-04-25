import { Component, OnInit } from '@angular/core';
import { NakamaclientService } from '../nakamaclient.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

  constructor(public nakama: NakamaclientService) { }

  ngOnInit() { }

}
