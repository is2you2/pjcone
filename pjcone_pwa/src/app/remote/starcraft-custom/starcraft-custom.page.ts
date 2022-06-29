import { Component, OnInit } from '@angular/core';
import { RemoteControllerService, RemotePage } from 'src/app/remote-controller.service';

@Component({
  selector: 'app-starcraft-custom',
  templateUrl: './starcraft-custom.page.html',
  styleUrls: ['./starcraft-custom.page.scss'],
})
export class StarcraftCustomPage implements OnInit, RemotePage {

  constructor(
    private remote: RemoteControllerService,
  ) { }

  ngOnInit() { }

  ionViewDidEnter() {
    this.remote.target = this;
  }

  remote_act: any = {
    'youtube': () => { }
  };
}
