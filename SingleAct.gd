extends Node
# 웹 소켓으로 DB 운용
# 계정 활동류 행동은 전부 이걸로 관리

# 가입된 계정으로 행동하는 서버
var server:= WebSocketServer.new()
const PORT:= 12000
# 데이터베이스 폴더 경로 with '/'
var root_path:String


func _init():
	if OS.is_debug_build():
		root_path = 'res://gd_database/'
	else: # 서버 실행파일이 위치한 경로로부터
		root_path = OS.get_executable_path() + '/gd_database/'
	var dir:= Directory.new()
	if not dir.dir_exists(root_path):
		dir.make_dir_recursive(root_path)


func _ready():
	server.connect("data_received", self, '_received')
	server.connect('client_connected', self, '_connected')
	server.connect('client_disconnected', self, '_disconnected')
	server.connect('client_close_request', self, '_disconnected')
	var err:= server.listen(PORT)
	if err != OK:
		printerr('MainServer init error: ', err)
	else:
		print('MainServer Opened: ', PORT)

# esc를 눌러 끄기
func _input(event):
	if event.is_action_pressed("ui_cancel"):
		get_tree().quit()

# 사이트에 연결 확인됨
func _connected(id:int, _proto:= 'EMPTY'):
	Root.log('MainServer', str('PeerConnected: ', id, ' / proto: ', _proto))

# 사이트로부터 연결 끊어짐
func _disconnected(id:int, _was_clean = null, _reason:= 'EMPTY'):
	Root.log('MainServer', str('PeerDisconnected: ', id, ' / was_clean: ', _was_clean, ' / reason: ', _reason))

# 자료를 받아서 행동 코드별로 자식 노드에게 일처리 넘김
func _received(id:int, _try_left:= 5):
	var err:= server.get_peer(id).get_packet_error()
	if err == OK:
		var raw_data:= server.get_peer(id).get_packet()
		var data:= raw_data.get_string_from_utf8()
		var json = JSON.parse(data).result
		if json is Dictionary:
			var _act:int = json['act']
			match(_act):
				_: # 준비되지 않은 행동
					Root.log('MainServer', str('UnExpected Act: ', data), Root.LOG_ERR)
		else: # 형식 오류
			Root.log('MainServer', str('UnExpected form: ', data), Root.LOG_ERR)
	else: # 패킷 오류
		Root.log('MainServer', str('MainServer packet error: ', err), Root.LOG_ERR)
		if _try_left > 0:
			Root.log('MainServer', str('MainServer receive packet error with _try_left: ', _try_left))
			yield(get_tree(), 'idle_frame')
			_received(id, _try_left - 1)
		else:
			Root.log('MainServer', str('MainServer receive packet error and try left out.'), Root.LOG_ERR)
			server.disconnect_peer(id, 1011, 'MainServer packet receive try left out.')


# 특정 사용자에게 보내기
func send_to(id:int, msg:PoolByteArray, _try_left:= 5):
	var err:= server.get_peer(id).put_packet(msg)
	if err != OK:
		if _try_left > 0:
			Root.log('MainServer', str(stamp_log(), 'MainServer send packet error with _try_left: ', _try_left))
		else:
			Root.log('MainServer', str(stamp_log(), 'MainServer send packet error and try left out.'), Root.LOG_ERR)
			server.disconnect_peer(id, 1011, 'MainServer packet send try left out.')


func _process(_delta):
	server.poll()


func _exit_tree():
	server.stop()
