import { Component, OnInit } from '@angular/core';
import { GlobalActService } from 'src/app/global-act.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private app: GlobalActService,
  ) { }

  ngOnInit() { }

  ionViewWillEnter() {
    this.app.CreateGodotIFrame('godot-todo', { act: 'godot-todo' });
  }
}
