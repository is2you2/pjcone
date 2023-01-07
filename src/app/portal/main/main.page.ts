import { Component, OnInit } from '@angular/core';
import { GlobalActService } from 'src/app/global-act.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private app: GlobalActService,
    private p5toast: P5ToastService,
  ) { }

  ngOnInit() { }

  ionViewWillEnter() {
    this.app.CreateGodotIFrame('godot-todo', {
      act: 'godot-todo',
      title: '해야할 일',
      failed: () => {
        this.p5toast.show({
          text: '기능 다운로드 실패',
        });
      }
    });
  }
}
