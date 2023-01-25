import { Component, OnInit } from '@angular/core';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private app: GlobalActService,
    public lang: LanguageSettingService,
  ) { }

  ngOnInit() { }

  ionViewWillEnter() {
    this.app.CreateGodotIFrame('godot-todo', {
      act: 'godot-todo',
      title: 'Todo',
    });
  }
}
