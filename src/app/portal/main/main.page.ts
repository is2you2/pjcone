// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { AddTodoMenuPage } from './add-todo-menu/add-todo-menu.page';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private app: GlobalActService,
    public lang: LanguageSettingService,
    private modalCtrl: ModalController,
  ) { }

  ngOnInit() { }

  ionViewWillEnter() {
    this.app.CreateGodotIFrame('godot-todo', {
      act: 'godot-todo',
      title: 'Todo',
      // add_todo: 고도쪽에서 추가됨 (새 해야할 일 등록)
      add_todo_menu: () => {
        this.modalCtrl.create({
          component: AddTodoMenuPage,
          componentProps: {
            godot: this.app.godot.contentWindow || this.app.godot.contentDocument,
          },
        }).then(v => v.present());
      }
    });
  }
}
