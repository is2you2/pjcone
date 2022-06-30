import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavController } from '@ionic/angular';
import { SERVER_PATH_ROOT } from '../app.component';
import { RemoteControllerService, RemotePage } from '../remote-controller.service';

@Component({
  selector: 'app-starcraft-custom',
  templateUrl: './starcraft-custom.page.html',
  styleUrls: ['./starcraft-custom.page.scss'],
})
export class StarcraftCustomPage implements OnInit, RemotePage {

  constructor(
    private title: Title,
    private remote: RemoteControllerService,
    private nav: NavController,
  ) {
  }

  remote_act = {
    'youtube': () => this.link_youtube()
  };

  ngOnInit() { }

  ionViewDidEnter() {
    this.title.setTitle('스타크래프트 1: 캠페인식 컴까기');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/sc1-custom.png');
    this.remote.target = this;
  }

  link_youtube() {
    window.location.href = 'https://www.youtube.com/watch?v=Ieqh27v29xI';
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
  }

}
