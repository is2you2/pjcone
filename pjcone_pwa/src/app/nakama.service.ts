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

  initialize() {
    this.client = new Client('defaultkey', SOCKET_SERVER_ADDRESS);
  }
}
