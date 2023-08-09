extends Node


var window
var end_of_manage_file_func = JavaScript.create_callback(self, 'end_of_manage_file')
var check_file_partsize_info_func = JavaScript.create_callback(self, 'check_file_partsize_info')
var req_file_part_func = JavaScript.create_callback(self, 'req_file_part')
var req_file_write_func = JavaScript.create_callback(self, 'req_file_write')

var countdown_timer:= 16.0

func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window');
		window.end_of_manage_file = end_of_manage_file_func
		window.check_file_partsize_info = check_file_partsize_info_func
		window.req_file_part = req_file_part_func
		window.req_file_write = req_file_write_func


func _process(delta):
	countdown_timer = countdown_timer - delta
	if countdown_timer < 0:
		window.self_destory()
		get_tree().quit()


# 파일 전체 길이 및 파트 크기 정보 반환
# args[0]: path
func check_file_partsize_info(args):
	var file:= File.new()
	var err:= file.open('user://%s' % args[0], File.READ)
	var result:int
	if err == OK:
		result = file.get_len()
	else: printerr('check_file_partsize_info_open_failed: ', err,': ', args[0])
	file.close()
	window.get_partsize(args[0], result)

# 작업하려는 파일의 경로 재귀 생성하기
func make_recursive(path:String):
	var dir:= Directory.new()
	var dir_sep:= path.find_last('/')
	var dir_rec:= path.substr(0, dir_sep)
	# 폴더가 없으면 폴더 생성
	if not dir.dir_exists(dir_rec):
		dir.make_dir_recursive(dir_rec)
	# 파일이 없으면 파일 생성
	if not dir.file_exists(path):
		var file:= File.new()
		file.open(path, File.WRITE)
		file.flush()
		file.close()

# 전송작업 파일 생성
func make_history_file(path:String, type:String, index:int):
	var file:= File.new()
	var err:= file.open('%s.history' % path, File.WRITE)
	if err == OK:
		var json = {
			'type': type,
			'index': index,
		}
		file.store_string(JSON.print(json))
	file.flush()
	file.close()


# 전송작업 파일 삭제
func remove_history_file(path:String):
	var dir:= Directory.new()
	var err:= dir.remove(path)


# 요청하는 파일 파트 돌려주기
# args[0]: path, [1]: index, [2]: full_len
func req_file_part(args):
	var path:String = 'user://%s' % args[0]
	make_recursive(path)
	var part_len:int = args[2] / 120000
	if args[1] < part_len:
		make_history_file(path, 'upload', args[1])
	else: remove_history_file(path)
	var file:= File.new()
	var base64:String
	var err:= file.open(path, File.READ)
	if err == OK:
		file.seek(120000 * args[1])
		var size:= 120000 if 120000 * (args[1] + 1) < args[2] else args[2] - 120000 * args[1]
		var buf:= file.get_buffer(size)
		base64 = Marshalls.raw_to_base64(buf)
	file.close()
	window.get_part_data(args[0], base64)


# 수신 받은 파일 파트를 이어서 쓰기
# args[0]: path, [1]: index, [2]: full_len, [3]: base64_part
func req_file_write(args):
	var path:String = 'user://%s' % args[0]
	make_recursive(path)
	var part_len:int = args[2] / 120000
	if args[1] < part_len:
		make_history_file(path, 'download', args[1])
	else: remove_history_file(path)
	var file:= File.new()
	var err:= file.open(path, File.READ_WRITE)
	if err == OK:
		file.seek(120000 * args[1])
		var buf:= Marshalls.base64_to_raw(args[2])
		file.store_buffer(buf)
	file.flush()
	file.close()
	window.save_part(args[0])
