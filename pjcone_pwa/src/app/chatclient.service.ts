import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChatclientService {

  constructor() { }

  client: WebSocket;

  initialize(_Address: string) {
    const PORT: number = 12011;
    this.client = new WebSocket(`ws://${_Address}:${PORT}`);
    this.client.onopen = (ev) => {
      console.log('연결됨: ', ev);
    }
    this.client.onclose = (ev) => {
      console.log('연결 끊김: ', ev);
    }
    this.client.onerror = (e) => {
      console.error('오류 발생: ', e);
    }
    this.client.onmessage = (ev) => {
      console.log('메시지 받음: ', ev);
    }
  }

  send(msg: string) {
    this.client.send(msg);
  }
}
