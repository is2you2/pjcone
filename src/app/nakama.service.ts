import { Injectable } from '@angular/core';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';


@Injectable({
  providedIn: 'root'
})
export class NakamaService {

  constructor() { }

  client: Client;
  session: Session;
  socket: Socket;

  /**
   * Nakama 클라이언트 구성을 진행합니다.
   * @param _address 사설 서버연결시 주소
   */
  initialize(_address: string = SOCKET_SERVER_ADDRESS) {
    this.client = new Client('defaultkey', _address);
  }
}
