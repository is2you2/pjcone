extends Node
# 웹 소켓으로 DB 운용
# 계정 활동류 행동은 전부 이걸로 관리


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
	var err:= server.listen(PORT)
	if err != OK:
		printerr('MainServer init error: ', err)
	else:
		print('MainServer Opened: ', PORT)

# 자료를 받아서 행동 코드별로 자식 노드에게 일처리 넘김
func _received(id:int):
	var err:= server.get_peer(id).get_packet_error()
	if err == OK:
		var raw_data:= server.get_peer(id).get_packet()
		var data:= raw_data.get_string_from_utf8()
		var json = JSON.parse(data).result
		if json is Dictionary:
			var _act:int = json['act']
			match(_act):
				_: # 준비되지 않은 행동
					printerr(stamp_log(), 'UnExpected Act: ', data)
		else: # 형식 오류
			printerr(stamp_log(), 'UnExpected form: ', data)
	else: # 패킷 오류
		printerr(stamp_log(), 'MainServer packet error: ', err)

# 로그 남기기
func stamp_log() -> String:
	var _time:= OS.get_datetime()
	var _stamp:= '[%04d-%02d-%02d %02d:%02d:%02d] ' % [
		_time['year'],
		_time['month'],
		_time['day'],
		_time['hour'],
		_time['minute'],
		_time['second'],
	]
	return _stamp


func _process(_delta):
	server.poll()


func _exit_tree():
	server.stop()
