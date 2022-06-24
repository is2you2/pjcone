import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { RemoteControllerService } from 'src/app/remote-controller.service';

@Component({
  selector: 'app-test',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
})
export class TestPage implements OnInit {

  constructor(
    public nav: NavController,
    public remote: RemoteControllerService,
  ) { }

  ngOnInit() { }

  go_to_login() {
    console.log('컴퓨터 화면 변경시키기');
  }

}
