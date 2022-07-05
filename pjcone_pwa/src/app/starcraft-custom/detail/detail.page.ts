import { Component, OnInit } from '@angular/core';
import { NavParams } from '@ionic/angular';
import { SERVER_PATH_ROOT } from 'src/app/app.component';

@Component({
  selector: 'app-detail',
  templateUrl: './detail.page.html',
  styleUrls: ['./detail.page.scss'],
})
export class DetailPage implements OnInit {

  title: string;
  list: string[];
  picked: number;

  constructor(
    params: NavParams,
  ) {
    let data = params.data;
    if (!data['list'])
      location.href = SERVER_PATH_ROOT + 'starcraft_custom'
    this.title = data['title'];
    this.list = data['list'];
    this.picked = data['picked'];
  }

  ngOnInit() {
  }

}
