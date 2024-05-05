// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';

/** 리스트 판넬에 표시되는 상태들 */
interface PanelStatus {
  [id: string]: 'offline' | 'missing' | 'pending' | 'online' | 'certified';
}

/** status-bar를 가진 모든 개체의 상태를 검토하여 이곳에 기록해둠 */
@Injectable({
  providedIn: 'root'
})
export class StatusManageService {

  /** 각 상황별 색상 기억  
   * ```javascript
   * colors[PanelStatus.value] => return '#000000'; // hex색상값 반환
   * ```
   */
  colors = {
    offline: '#888888',
    missing: '#880000',
    pending: '#dddd0c',
    online: '#4ff14f',
    certified: '#00ffff',
  }
  /** 채팅방 리스트별 연결 상태
   * { group-id: PanelStatus }
   */
  chatroom: { [id: string]: PanelStatus } = {};
  /** 관리중인 프로젝트 */
  project: { [id: string]: PanelStatus } = {};
  /** 업무 리스트 */
  task: { [id: string]: PanelStatus } = {};
  /** 설정에 들어있는 램프판넬, 서버들의 전반적 동향 */
  settings: PanelStatus = {
    /** 그룹 서버 전반적 동향 */
    groupServer: 'offline',
    /** 사설서버 전반적 동향 */
    dedicatedServer: 'offline',
    dedicated_groupchat: 'offline'
  };
  /** 설정에 준비된 공식 지원 툴, 직접 작성하여 관리 */
  tools: PanelStatus = {}
  /** 설정-그룹서버 관리 목록  
   * groupServer[isOfficial][target] = status;
   */
  groupServer: { [id: string]: PanelStatus } = {
    official: {
      default: 'offline',
    },
    unofficial: {},
  }
  /** 설정-사설서버 관리 목록 */
  dedicated: { [id: string]: PanelStatus } = {
    official: {
      groupchat: 'offline',
    },
    unofficial: {},
  };

  constructor() {
    setInterval(() => { }, 350); // services 개체 실시간 업데이트 유도용
  }
}
