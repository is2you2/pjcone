import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { RemoteControllerService, RemotePage } from 'src/app/remote-controller.service';

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
    'blog': () => this.nav.navigateForward('remote/login')
  };

  ngOnInit() { }

  ionViewWillEnter() {
    this.remote.target = this;
  }

  go_to_login() {
    this.remote.client.send('blog');
  }

}
