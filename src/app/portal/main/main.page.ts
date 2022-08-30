import { Component, OnInit } from '@angular/core';
import { AppComponent } from 'src/app/app.component';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private app: AppComponent,
  ) { }

  ngOnInit() { }

  ionViewWillEnter() {
    this.app.CreateGodotIFrame('godot-test-act', 'godot-main-frame');
  }
}
