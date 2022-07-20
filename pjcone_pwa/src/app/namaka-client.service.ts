import { Injectable } from '@angular/core';
import { Client, Session } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';

@Injectable({
  providedIn: 'root'
})
export class NamakaClientService {

  constructor() { }

  client: Client;
  AuthSession: Session;

  initialize() {
    this.client = new Client('defaultkey', SOCKET_SERVER_ADDRESS);
  }
}
