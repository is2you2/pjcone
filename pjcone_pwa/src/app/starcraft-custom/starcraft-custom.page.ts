import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-starcraft-custom',
  templateUrl: './starcraft-custom.page.html',
  styleUrls: ['./starcraft-custom.page.scss'],
})
export class StarcraftCustomPage implements OnInit {

  constructor() { }

  ngOnInit() { }

  link_youtube() {
    window.location.href = 'https://www.youtube.com/watch?v=Ieqh27v29xI';
  }

}
