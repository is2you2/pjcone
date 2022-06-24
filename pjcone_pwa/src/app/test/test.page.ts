import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { RemoteControllerService, RemotePage } from '../remote-controller.service';

@Component({
  selector: 'app-test',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
})
export class TestPage implements OnInit, RemotePage {

  constructor(
    public nav: NavController,
    public remote: RemoteControllerService,
  ) { }

  remote_act = {
    'blog': () => {
      this.go_to_login();
    }
  }

  go_to_login() {
    this.nav.navigateForward('login');
  }

  ngOnInit() {
    this.remote.target = this;
  }

}
