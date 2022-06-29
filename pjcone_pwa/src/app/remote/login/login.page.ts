import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { RemoteControllerService, RemotePage } from 'src/app/remote-controller.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit, RemotePage {

  constructor(
    private nav: NavController,
    private remote: RemoteControllerService,
  ) { }

  ngOnInit() { }

  ionViewWillEnter() {
    this.remote.target = this;
  }

  remote_act: any = {
    'test': () => this.nav.navigateBack('remote/test')
  };

}
