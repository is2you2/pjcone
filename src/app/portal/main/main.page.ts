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
      // 아래 주석 처리된 key들은 고도쪽에서 추가됨
      // add_todo: 새 해야할 일 등록
      // remove_todo: 해야할 일 삭제
      /**
       * 해야할 일 추가/수정/열람 메뉴 띄우기
       * @param _data 해당 해야할 일 정보
       */
      add_todo_menu: (_data: string) => {
        this.modalCtrl.create({
          component: AddTodoMenuPage,
          componentProps: {
            godot: this.app.godot.contentWindow || this.app.godot.contentDocument,
            data: _data ? JSON.parse(_data) : undefined,
          },
        }).then(v => v.present());
      }
    });
  }
}
