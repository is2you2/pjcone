## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT

extends Node
# 핸드폰에서 웹 사이트를 연결하기 위해 구성된 서버
# 웹 사이트에서 QR코드 게시 직전 id를 이곳에 구성하고 핸드폰에서 QR코드에 들어있는 id를 검토하여 두 기기를 연결한다
# 동작순서: QRCode 스캔 -> 폰에서 자기 정보를 전달 -> 전달받은 정보로 폰에 연결

var server:= WebSocketServer.new()

const PORT:= 12020
const HEADER:= 'WebLink'

func _ready():
	if Root.private:
		server.private_key = Root.private
	if Root.public:
		server.ssl_certificate = Root.public
	server.connect("client_connected", self, "_connected")
	server.connect("data_received", self, '_received')
	var err:= server.listen(PORT)
	if err != OK:
		Root.logging(HEADER, str('init error: ', err), Root.LOG_ERR)
	else:
		Root.logging(HEADER, str('Opened: ', PORT))

# 처음 연결되면 자신의 pid를 돌려줍니다
func _connected(id:int, _proto:= 'EMPTY_PROTO'):
	send_to(id, str(id).to_utf8())

func _received(id:int, _try_left:= 5):
	var err:= server.get_peer(id).get_packet_error()
	if err == OK:
		var raw_data:= server.get_peer(id).get_packet()
		var data:= raw_data.get_string_from_utf8()
		var json = JSON.parse(data).result
		if json is Dictionary:
			match(json):
				{ 'from': 'mobile', 'pid': var pid, 'addresses': var addresses }: # 모바일에서 QRCode 스캔 결과와 로컬주소를 보냄
					var result:= {
						'addresses': addresses
					}
					send_to(int(pid), JSON.print(result).to_utf8())
				_: # 그 외 모든 경우
					send_to(int(json['pid']), raw_data)
		else: # 형식 오류
			Root.logging(HEADER, str('UnExpected form: ', data), Root.LOG_ERR)
	else: # 패킷 오류
		Root.logging(HEADER, str('packet error: ', err), Root.LOG_ERR)
		if _try_left > 0:
			Root.logging(HEADER, str('receive packet error with _try_left: ', _try_left))
			yield(get_tree(), 'idle_frame')
			_received(id, _try_left - 1)
		else:
			Root.logging(HEADER, str('receive packet error and try left out.'), Root.LOG_ERR)
			server.disconnect_peer(id, 1011, 'MainServer packet receive try left out.')

func send_to(id:int, msg:PoolByteArray, _try_left:= 5):
	var is_exist:= server.get_peer(id)
	if is_exist:
		var err:= is_exist.put_packet(msg)
		if err != OK:
			if _try_left > 0:
				Root.logging(HEADER, str('send packet error with _try_left: ', _try_left))
				yield(get_tree(), "idle_frame")
				send_to(id, msg, _try_left - 1)
			else:
				Root.logging(HEADER, str('send packet error and try left out.'), Root.LOG_ERR)
				server.disconnect_peer(id, 1011, 'MainServer packet send try left out.')

func _process(_delta):
	server.poll()

func _exit_tree():
	server.stop()
